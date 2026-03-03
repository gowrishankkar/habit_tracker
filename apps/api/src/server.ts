import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";

async function bootstrap(): Promise<void> {
  await connectDB();

  app.listen(env.API_PORT, () => {
    console.log(
      `[api] Running on http://localhost:${env.API_PORT} (${env.NODE_ENV})`,
    );
  });
}

bootstrap();
