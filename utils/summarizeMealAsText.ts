// External Dependencies

// Relative Dependencies
import { MealData } from '../types/types';
import OpenAI from './openAIClient';

export const summarizeMealAsText = async (meal: MealData) => {
  let imageNotes: string[] = [];
  if (meal.imageBase64Strings?.length) {
    for (const url of meal.imageBase64Strings) {
      if (typeof url === 'string') {
        const text = await getTextFromMealImage(url);
        imageNotes.push(text as string);
      }
    }
  }

  let mealInfoToEmbed = `
    Meal Type: ${meal.type}
    Meal DateTime: ${meal.datetime}
    Meal Notes: "${meal.notes}" 
    "${imageNotes.reduce((acc: string, note: string) => acc + note, '')}"
  `;

  return mealInfoToEmbed;
};

const getTextFromMealImage = async (url: string) => {
  const response = await OpenAI.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are given an image of a meal a person ate. Describe what food you see in this image.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${url}`, detail: 'auto' },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
};
