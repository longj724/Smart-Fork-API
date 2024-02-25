// External Dependencies
import express from 'express';
import {
  Run,
  RunSubmitToolOutputsParams,
} from 'openai/resources/beta/threads/runs/runs';
import { MessageContentText } from 'openai/resources/beta/threads/messages/messages';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Relative Dependencies
import { supabaseClient } from '../utils/supabaseClient';
import OpenAI from '../utils/openAIClient';
import {
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';
import { validate } from '../middleware/middleware';
import { sendMessageSchema } from '../middleware/schemas';

const systemPromptGoalAddOn = `
You will also be given a health goal that 
the individual has. Some example goals are: "Lose weight", "Gain muscle",
"Eat more protein", "Train for a marathon".

Here is the individual's goal: Gain muscle. 
The individual will ask you health-related questions. If applicable use their goals
and meal data to guide your response.
`;

// const ASSISTANT_ID = 'asst_NsYEypkkcqm8KG9JuaU7MDLN';
const ASSISTANT_ID = 'asst_BpkT10b8JIuRzdcNDKnLs7Y3';

const getRecentMeals = async (userId: string, authorization: string) => {
  const supabase = await supabaseClient(authorization as string);
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(
    currentDate.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  const { data: recentMealData, error } = await supabase
    .from('Meals')
    .select('*')
    .eq('userId', userId)
    .gte('createdAt', thirtyDaysAgo.toISOString());

  return { recentMealData, error };
};

const getRecentStravaActivities = async (
  userId: string,
  accessToken: string
) => {
  const { data } = await axios.get(
    `http://localhost:3000/workouts/strava-activities/${userId}`,
    {
      headers: {
        Authorization: accessToken,
      },
    }
  );
  return data;
};

const router = express.Router();

router.get('/messages/:userId', async (req, res, next) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  const userId = req.params.userId;

  const { data: messageHistory, error } = await supabase
    .from('Messages')
    .select('*')
    .eq('user_id', userId);

  if (error) return next(new Error('Unable to retrieve messages'));

  if (messageHistory?.length === 0 || !messageHistory) {
    const thread = await OpenAI.beta.threads.create();

    const { data: messageInsertResponse } = await supabase
      .from('Messages')
      .insert({
        user_id: userId,
        token_count: 0,
        thread_id: thread.id,
        messages: JSON.stringify([
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

router.post(
  '/send-message',
  validate(sendMessageSchema),
  async (req, res, next) => {
    const supabase = await supabaseClient(req.headers.authorization as string);
    const { message, userId } = req.body;

    const { data: messageHistory, error } = await supabase
      .from('Messages')
      .select('*')
      .eq('user_id', userId);

    if (error) return next(error);

    if (messageHistory && messageHistory[0]?.thread_id) {
      const threadId = messageHistory[0]?.thread_id;

      await OpenAI.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message,
      });

      const run = await OpenAI.beta.threads.runs.create(threadId, {
        assistant_id: ASSISTANT_ID,
      });

      let runStatus = await OpenAI.beta.threads.runs.retrieve(threadId, run.id);

      while (runStatus.status !== 'completed') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await OpenAI.beta.threads.runs.retrieve(threadId, run.id);

        if (runStatus.status === 'requires_action') {
          const toolCalls = (runStatus?.required_action as Run.RequiredAction)
            .submit_tool_outputs.tool_calls;
          const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = [];

          for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;

            let output;

            if (functionName === 'getRecentMeals') {
              output = await getRecentMeals(
                userId,
                req.headers.authorization as string
              );
            } else {
              output = await getRecentStravaActivities(
                userId,
                req.headers.authorization as string
              );
            }

            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(output),
            });

            await OpenAI.beta.threads.runs.submitToolOutputs(threadId, run.id, {
              tool_outputs: toolOutputs,
            });
            continue;
          }
        }

        if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
          next(new Error('Unable to send message'));
        }
      }

      const messages = await OpenAI.beta.threads.messages.list(threadId);
      const lastMessageForRun = messages.data
        .filter(
          (message) => message.run_id === run.id && message.role === 'assistant'
        )
        .pop();

      if (lastMessageForRun) {
        let existingMessages: Array<
          ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam
        > = JSON.parse(messageHistory[0].messages);

        const userQuestionMessage:
          | ChatCompletionSystemMessageParam
          | ChatCompletionUserMessageParam = {
          role: 'user',
          content: message,
        };
        existingMessages.push(userQuestionMessage);

        const assistantResponseMessage:
          | ChatCompletionSystemMessageParam
          | ChatCompletionUserMessageParam = {
          role: 'system',
          content: (lastMessageForRun.content[0] as MessageContentText).text
            .value,
        };
        existingMessages.push(assistantResponseMessage);

        const { error } = await supabase
          .from('Messages')
          .update({
            messages: JSON.stringify(existingMessages),
          })
          .eq('user_id', userId)
          .eq('thread_id', threadId);

        if (error) next(new Error('Unable to send message'));
        res.json({ message: assistantResponseMessage });
      } else if (
        !['failed', 'cancelled', 'expired'].includes(runStatus.status)
      ) {
        next(new Error('Unable to send message'));
      }
    }
  }
);

export { router as insightsRouter };
