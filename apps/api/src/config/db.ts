import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log(`[db] Connected to MongoDB`);
  } catch (err) {
    console.error("[db] Connection failed:", err);
    process.exit(1);
  }
}
