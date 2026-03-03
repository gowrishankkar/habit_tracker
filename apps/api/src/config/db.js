import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection failed", { message: err.message });
    process.exit(1);
  }
}
