import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { config } from "../src/config/config.js";
import SharedFile from "../src/models/SharedFile.js";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const LOCAL_UPLOADS_DIR = "uploads";

async function runMigration() {
  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }

  try {
    const files = await SharedFile.find({});
    console.log(`Found ${files.length} file records in database.`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
      console.log(`Processing file: ${file.storageKey} (Token: ${file.token})`);
      
      // 1. Check if it already exists in S3
      let existsInS3 = false;
      try {
        await s3.send(
          new HeadObjectCommand({
            Bucket: config.AWS_BUCKET_NAME,
            Key: file.storageKey,
          })
        );
        existsInS3 = true;
      } catch (err) {
        if (err.name !== "NotFound") {
          console.error(`  Error checking S3 for ${file.storageKey}:`, err.message);
        }
      }

      if (existsInS3) {
        console.log(`  [SKIPPED] Already exists in S3.`);
        skipped++;
        continue;
      }

      // 2. Read local file
      const localPath = path.join(LOCAL_UPLOADS_DIR, file.storageKey);
      let fileBuffer;
      try {
        fileBuffer = await fs.readFile(localPath);
      } catch (err) {
        console.error(`  [FAILED] Could not read local file ${localPath}:`, err.message);
        failed++;
        continue;
      }

      // 3. Upload to S3
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.AWS_BUCKET_NAME,
            Key: file.storageKey,
            Body: fileBuffer,
            ContentType: file.contentType || "application/octet-stream",
          })
        );
        console.log(`  [SUCCESS] Uploaded to S3.`);
        migrated++;
        
        // Note: we're intentionally not deleting the local file yet to be safe.
        // You can run `rm -rf uploads/` manually after verifying the migration.
      } catch (err) {
        console.error(`  [FAILED] Failed to upload to S3:`, err.message);
        failed++;
      }
    }

    console.log(`\nMigration Summary:`);
    console.log(`Total Records: ${files.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (Already in S3): ${skipped}`);
    console.log(`Failed: ${failed}`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

runMigration();
