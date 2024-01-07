// External Dependencies
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import moment from "moment";
dotenv.config();

// Relative Dependencies
import { supabaseClient } from "../utils/supabaseClient";

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

      // Get public url
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

  const { data, error } = await supabase.from("Meals").insert({
    type,
    datetime: date,
    userId,
    notes,
    imageUrls: imageStorageUrls,
  });

  if (error) {
    res.status(500).json({
      message: "Error in storing meal data",
    });
  }

  res.status(200).json(data);
});

export { router as mealRouter };
