// External Dependencies
import { z } from 'zod';

export const allMealsSchema = z.object({
  query: z.object({
    datetime: z.string().datetime(),
  }),
  params: z.object({
    userId: z.string(),
  }),
});

export const addMealSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    userId: z.string(),
  }),
});

export const quickAddSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    userId: z.string(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    message: z.string(),
    userId: z.string(),
  }),
});
