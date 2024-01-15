// External Dependencies
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import moment from "moment";
dotenv.config();

// Relative Dependencies
import { supabaseClient } from "../utils/supabaseClient";
import { summarizeMealAsText } from "../utils/summarizeMealAsText";
import { MealData } from "../types/types";
import OpenAI from "../utils/openAIClient";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({ storage });

router.get("/all-meals/:userId", async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  const userId = req.params.userId;
  const datetimeAsString = req.query.datetime as string;

  if (!datetimeAsString) {
    res.status(500).send({
      message: "No datetime provided as query string",
    });
    return;
  }

  const datetimeAsDate = moment(datetimeAsString).toDate();

  const { data } = await supabase.rpc("get_meals_by_year_month", {
    year: datetimeAsDate.getFullYear(),
    month: datetimeAsDate.getMonth() + 1,
    userid: userId,
  });

  res.json(data);
});

router.post("/add-meal", upload.array("images", 3), async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);

  let imageStorageUrls: string[] = [];
  let imageBase64Strings: string[] = [];
  // Need to have this check to please typescript
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      const { error } = await supabase.storage
        .from("Meals")
        .upload(
          `${req.body.userId}/${file.fieldname}_${Date.now()}_${
            file.originalname
          }`,
          file.buffer
        );

      imageBase64Strings.push(file.buffer.toString("base64"));

      // Get public url for frontend
      let { data: storagedImageData } = await supabase.storage
        .from("Meals")
        .getPublicUrl(
          `/${req.body.userId}/${file.fieldname}_${Date.now()}_${
            file.originalname
          }`
        );
      imageStorageUrls.push(storagedImageData.publicUrl);

      if (error) {
        res.status(500).json({
          message: "Error in storing meal images",
        });
        return;
      }
    }
  }

  const { type, notes, date, userId } = req.body;

  const { data, error } = await supabase
    .from("Meals")
    .insert({
      type,
      datetime: date,
      userId,
      notes,
      imageUrls: imageStorageUrls,
    })
    .select("*");

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

    const summarizedMealText = await summarizeMealAsText(mealData);

    const embeddingResponse = await OpenAI.embeddings.create({
      model: "text-embedding-ada-002",
      input: summarizedMealText,
    });

    const [responseData] = embeddingResponse.data;

    if (!embeddingResponse.data) {
      console.log("Could not embed meal");
    }

    // Put embedding in db
    const { data: supabaseEmbedding, error: embeddingError } = await supabase
      .from("Meal_Embeddings")
      .insert({
        user_id: meal.userId,
        meal_id: meal.id,
        // Can't pass in embedding type - https://github.com/supabase/postgres-meta/issues/578
        embedding: JSON.stringify(responseData.embedding),
        token_count: embeddingResponse.usage.total_tokens,
        content: summarizedMealText,
      })
      .select("*");

    if (embeddingError) {
      console.log("embedding error is", embeddingError);
    }
  }

  if (error) {
    res.status(500).json({
      message: "Error in storing meal data",
    });
  }

  res.status(200).json(data);
});

router.post("/update-meal", async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);

  const { mealId, type, notes, datetime } = req.body;

  const { data: updatedMeal, error: mealUpdateError } = await supabase
    .from("Meals")
    .update({ notes: notes, type: type, datetime: datetime })
    .eq("id", mealId)
    .select("*");

  if (mealUpdateError) {
    res.status(500).json({
      message: "Error in updating meal data",
    });
  }

  // TODO: Update Embeddings
  // const { data: embeddingsUpdate, error: embeddingsUpdateError } =
  //   await supabase
  //     .from("Meal_Embeddings")
  //     .update({ content: notes })
  //     .eq("meal_id", mealId);

  res.json({
    message: "Update Successful",
    updateMeal: updatedMeal,
  });
});

export { router as mealRouter };
