// External Dependencies
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

// Relative Dependencies
import { mealRouter } from "./routers/meal";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/meals", mealRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
