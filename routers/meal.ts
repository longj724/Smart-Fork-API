// External Dependencies
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
dotenv.config();

// Relative Dependencies
import { supabaseClient } from "../utils/supabaseClient";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({ storage });

router.post("/add-meal", upload.array("images", 3), async (req, res) => {
  const supabase = await supabaseClient(req.headers.authorization as string);

  let imageStorageUrls: string[] = [];
  // Need to have this check to please typescript
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      const { data, error } = await supabase.storage
        .from("Meals")
        .upload(
          `/${req.body.userId}/${file.fieldname}_${Date.now()}_${
            file.originalname
          }`,
          file.buffer
        );

      imageStorageUrls.push(data?.path as string);

      if (error) {
        console.log(error);
        res.status(500).json({
          message: "there was an error",
        });
        return;
      }
    }
  }

  const { type, notes, date, userId } = req.body;

  const { data, error } = await supabase.from("Meals").insert({
    type,
    time: date,
    user_id: userId,
    notes,
    imageUrls: imageStorageUrls,
  });

  console.log(data);
  console.log(error);

  res.status(200).json({
    message: "things worked",
  });
});

export { router as mealRouter };
