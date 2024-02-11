// External Dependencies
import express from 'express';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';
import dotenv from 'dotenv';
dotenv.config();

// Relative Dependencies
import { supabaseClient } from '../utils/supabaseClient';
import OpenAI from '../utils/openAIClient';

const systemPrompt = `
    You are an assistant who helps people meet their health goals.
    You will be given data regarding the food consumed by an individual.
    The data will be in json format and will be a list of "Meal" objects,
    The meal objects will have a "content" field that will contain information
    about a given meal that they ate.

    Here is the individual's meal data: 
    {mealData}
  `;

const systemPromptGoalAddOn = `
You will also be given a health goal that 
the individual has. Some example goals are: "Lose weight", "Gain muscle",
"Eat more protein", "Train for a marathon".

Here is the individual's goal: Gain muscle. 
The individual will ask you health-related questions. If applicable use their goals
and meal data to guide your response.
`;

const getRecentMealData = async (userId: string, authorization: string) => {
  const supabase = await supabaseClient(authorization as string);
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(
    currentDate.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  const { data: recentMealData, error } = await supabase
    .from('Meals')
    .select('*')
    .eq('userId', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  return { recentMealData, error };
};

const router = express.Router();

router.get('/messages/:userId', async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  const userId = req.params.userId;

  const { recentMealData } = await getRecentMealData(
    userId,
    req.headers.authorization as string
  );

  const { data: messageHistory } = await supabase
    .from('Messages')
    .select('*')
    .eq('user_id', userId);

  if (messageHistory?.length === 0 || !messageHistory) {
    // Need to create an intro message
    const systemPromptWithMealData = systemPrompt.replace(
      '{mealData}',
      JSON.stringify(recentMealData)
    );

    const { data: messageInsertResponse, error } = await supabase
      .from('Messages')
      .insert({
        user_id: userId,
        token_count: 0,
        messages: JSON.stringify([
          {
            role: 'system',
            content: JSON.stringify(systemPromptWithMealData),
          },
          {
            role: 'system',
            content:
              'Hello! Ask me questions about your diet to meet your health goals.',
          },
        ]),
      })
      .select('*');

    res.json({
      messages: messageInsertResponse
        ? messageInsertResponse[0].messages
        : JSON.stringify([]),
    });
  } else {
    res.json({ messages: messageHistory[0].messages });
  }
});

export { router as insightsRouter };
