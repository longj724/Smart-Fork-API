// External Dependencies
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
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

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';
  res.status(error.statusCode).json({
    message: error.message,
  });
});

app.use('*', (_req, res) => {
  res.status(404).send('404 Not Found: The requested resource does not exist.');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
