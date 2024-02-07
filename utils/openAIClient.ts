// External Dependencies
import { OpenAI as openai } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const OpenAI = new openai({
  apiKey: process.env.OPENAI_API_KEY,
});

export default OpenAI;
