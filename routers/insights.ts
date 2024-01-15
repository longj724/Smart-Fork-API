// External Dependencies
import express from "express";
import dotenv from "dotenv";
dotenv.config();

// Relative Dependencies
import { supabaseClient } from "../utils/supabaseClient";
import OpenAI from "../utils/openAIClient";

const router = express.Router();

router.post("/ask-question", async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  const { question } = req.body;

  // TODO: implement moderation checking

  const embeddingResponse = await OpenAI.embeddings.create({
    model: "text-embedding-ada-002",
    input: question.replaceAll("\n", " "),
  });

  const [{ embedding }] = embeddingResponse.data;

  const { error: matchError, data: matchingMeals } = await supabase
    .rpc("meal_simliarity_search", {
      query_embedding: JSON.stringify(embedding),
      similarity_threshold: 0.5,
      match_count: 10,
    })
    .select("*");

  console.log("error is", matchError);
  console.log("matching meals are", matchingMeals);

  const prompt = `
    You are an assistant who helps people keep track of the food they eat.
    You will be given data regarding the food consumed by an individual.
    The data will be in json format and will be a list of "Meal" objects,
    The meal objects will have a "content" field that will contain information
    about a given meal that they ate. When you are asked a question abouf the 
    food eaten recently, give a response.

    Here is the meal data: 
    ${JSON.stringify(matchingMeals)}

  `;

  const completion = await OpenAI.chat.completions.create({
    messages: [
      {
        role: "system",
        content: prompt,
      },
      { role: "user", content: question },
    ],
    model: "gpt-4",
  });

  return res.json({ completion: completion.choices[0].message.content });
});

export { router as insightsRouter };
