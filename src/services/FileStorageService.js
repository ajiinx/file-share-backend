import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/config.js";

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export const FileStorageService = {
  async store(tempPath, storageKey, contentType) {
    try {
      const fileBuffer = await fs.readFile(tempPath);
      const command = new PutObjectCommand({
        Bucket: config.AWS_BUCKET_NAME,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: contentType || "application/octet-stream",
      });

      await s3.send(command);
      
      const stats = await fs.stat(tempPath);
      const sizeBytes = stats.size;
      
      // Clean up the temp file
      await fs.unlink(tempPath);

      return {
        storageKey,
        sizeBytes,
      };
    } catch (err) {
      console.error("Failed to store file in S3:", err);
      throw err;
    }
  },

  async deleteQuietly(storageKey) {
    if (!storageKey) return;
    try {
      const command = new DeleteObjectCommand({
        Bucket: config.AWS_BUCKET_NAME,
        Key: storageKey,
      });
      await s3.send(command);
    } catch (err) {
      console.warn(`Failed to delete S3 object ${storageKey}:`, err.message);
    }
  },

  async getPresignedUrl(storageKey, download, filename, contentType) {
    if (!storageKey) throw new Error("Storage key must not be blank");
    
    let disposition = download ? "attachment" : "inline";
    if (!download) {
      const DANGEROUS_MIME_TYPES = new Set([
        "text/html", "application/xhtml+xml", "application/javascript",
        "text/javascript", "image/svg+xml", "application/xml", "text/xml",
      ]);
      if (DANGEROUS_MIME_TYPES.has(contentType)) {
        disposition = "attachment";
      }
    }
    
    const command = new GetObjectCommand({
      Bucket: config.AWS_BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(filename)}"`,
      ResponseContentType: contentType || "application/octet-stream",
    });

    // URL expires in 15 minutes
    return await getSignedUrl(s3, command, { expiresIn: 900 });
  },
};
