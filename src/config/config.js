import { config as configEnv } from "dotenv";

configEnv();

const required = ["MONGO_URI", "APP_PUBLIC_BASE_URL", "APP_API_BASE_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const _config = {
  PORT: process.env.PORT || "8081",
  MONGO_URI: process.env.MONGO_URI,
  NODE_ENV: process.env.NODE_ENV || "development",
  APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL,
  APP_API_BASE_URL: process.env.APP_API_BASE_URL,
  APP_MAX_FILE_SIZE: parseInt(process.env.APP_MAX_FILE_SIZE, 10) || 50 * 1024 * 1024,
  APP_CLEANUP_CRON: process.env.APP_CLEANUP_CRON || "0 */2 * * * *",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
};

export const config = Object.freeze(_config);
