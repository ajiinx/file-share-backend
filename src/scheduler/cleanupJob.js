import cron from "node-cron";
import { SharedFileService } from "../services/SharedFileService.js";
import { config } from "../config/config.js";

const cronSchedule = config.APP_CLEANUP_CRON;

export function startCleanupJob() {
  const task = cron.schedule(cronSchedule, async () => {
    try {
      await SharedFileService.cleanupExpiredAndExhausted();
    } catch (err) {
      console.error("Cleanup job failed:", err);
    }
  });
  console.log(`Scheduled cleanup job with cron: ${cronSchedule}`);
  return task;
}
