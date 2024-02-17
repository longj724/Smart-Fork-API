// External Dependencies
import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import moment from 'moment';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
dotenv.config();

// Relative Dependencies
import { supabaseClient } from '../utils/supabaseClient';
import { summarizeMealAsText } from '../utils/summarizeMealAsText';
import { MealData } from '../types/types';
import OpenAI from '../utils/openAIClient';

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({ storage });

router.get('/all-meals/:userId', async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  const userId = req.params.userId;
  const datetimeAsString = req.query.datetime as string;

  if (!datetimeAsString) {
    res.status(500).send({
      message: 'No datetime provided as query string',
    });
    return;
  }

  const datetimeAsDate = moment(datetimeAsString).toDate();

  const { data } = await supabase.rpc('get_meals_by_year_month', {
    year: datetimeAsDate.getFullYear(),
    month: datetimeAsDate.getMonth() + 1,
    userid: userId,
  });

  res.json(data);
});

router.post('/add-meal', upload.array('images', 3), async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);

  let imageStorageUrls: string[] = [];
  let imageBase64Strings: string[] = [];

  // Need to have this check to please typescript
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      const { error } = await supabase.storage
        .from('Meals')
        .upload(
          `${req.body.userId}/${file.fieldname}_${Date.now()}_${
            file.originalname
          }`,
          file.buffer
        );

      imageBase64Strings.push(file.buffer.toString('base64'));

      // Get public url for frontend
      let { data: storagedImageData } = await supabase.storage
        .from('Meals')
        .getPublicUrl(
          `/${req.body.userId}/${file.fieldname}_${Date.now()}_${
            file.originalname
          }`
        );
      imageStorageUrls.push(storagedImageData.publicUrl);

      if (error) {
        res.status(500).json({
          message: 'Error in storing meal images',
        });
      }
    }
  }

  const { type, notes, date, userId } = req.body;

  const { data, error } = await supabase
    .from('Meals')
    .insert({
      type,
      datetime: date,
      userId,
      notes,
      imageUrls: imageStorageUrls,
    })
    .select('*');

  if (data) {
    const meal = data[0];
    // Assumption made that we are only adding one meal at a time
    const mealData: MealData = {
      createdAt: meal.createdAt,
      datetime: meal.datetime,
      id: meal.id,
      imageBase64Strings: imageBase64Strings,
      notes: meal.notes,
      type: meal.type,
      userId: meal.userId,
    };

    // Excluding for now. This looked at the image and added notes about the meal
    // In most cases I don't think this adds much value
    // const summarizedMealText = await summarizeMealAsText(mealData);

    const embeddingResponse = await OpenAI.embeddings.create({
      model: 'text-embedding-ada-002',
      input: notes,
    });

    const [responseData] = embeddingResponse.data;

    if (!embeddingResponse.data) {
      console.error('Could not embed meal');
    }

    const { error: embeddingError } = await supabase
      .from('Meal_Embeddings')
      .insert({
        user_id: meal.userId,
        meal_id: meal.id,
        // Can't pass in embedding type - https://github.com/supabase/postgres-meta/issues/578
        embedding: JSON.stringify(responseData.embedding),
        token_count: embeddingResponse.usage.total_tokens,
        content: notes,
      })
      .select('*');

    if (embeddingError) {
      console.log('embedding error is', embeddingError);
    }
  }

  if (error) {
    res.status(500).json({
      message: 'Error in storing meal data',
    });
  }

  res.json(data);
});

router.post('/update-meal', async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);

  const { mealId, type, notes, datetime } = req.body;

  const { data: updatedMeal, error: mealUpdateError } = await supabase
    .from('Meals')
    .update({ notes: notes, type: type, datetime: datetime })
    .eq('id', mealId)
    .select('*');

  if (mealUpdateError) {
    res.status(500).json({
      message: 'Error in updating meal data',
    });
    return;
  }

  // TODO: Update Embeddings
  // const { data: embeddingsUpdate, error: embeddingsUpdateError } =
  //   await supabase
  //     .from("Meal_Embeddings")
  //     .update({ content: notes })
  //     .eq("meal_id", mealId);

  res.json({
    message: 'Update Successful',
    updateMeal: updatedMeal,
  });
});

router.post(
  '/quick-add',
  upload.single('audio-meal-note'),
  async (req, res) => {
    const supabase = await supabaseClient(req.headers.authorization as string);

    if (req.file) {
      const formData = new FormData();
      const audioFile = req.file;
      const audioStream = Readable.from(audioFile.buffer);

      formData.append('file', audioStream, {
        filename: audioFile.originalname,
        contentType: audioFile.mimetype,
      });
      formData.append('model', 'whisper-1');
      const config = {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      };

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        config
      );
      const transcription = response.data.text;

      const prompt = `
        You are an assistant who helps people keep track of the food they eat.
        You will be given a transcription of text of a meal that they ate.
        Convert that transcription into a concise summary of the food that they ate
        written in first person. Also don't use adjectives to describe the meal unless
        they are in the transcription.

        Here is the transcription: 
        ${transcription}`;

      const completion = await OpenAI.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: prompt,
          },
        ],
        model: 'gpt-3.5-turbo',
      });

      const { datetime, userId } = req.body;

      const { data, error } = await supabase
        .from('Meals')
        .insert({
          datetime: datetime,
          userId,
          notes: completion.choices[0].message.content,
        })
        .select('*');

      if (error) {
        res.status(500).json({
          message: 'Error in storing meal data',
        });
      } else {
        res.status(200).json(data);
      }
      return;
    }
    res.status(500).json({
      message: 'No audio file present',
    });
  }
);

export { router as mealRouter };
