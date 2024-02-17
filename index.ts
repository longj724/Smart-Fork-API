// External Dependencies
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

// Relative Dependencies
import { mealRouter } from './routers/meal';
import { insightsRouter } from './routers/insights';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/meals', mealRouter);
app.use('/insights', insightsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
