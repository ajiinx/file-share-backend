import app from "./src/app.js";
import { config } from "./src/config/config.js";
import connectDB from "./src/config/db.js";
import { startCleanupJob } from "./src/scheduler/cleanupJob.js";

const PORT = config.PORT || 8081;

async function startServer() {
  await connectDB();

  const cleanupTask = startCleanupJob();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("HTTP server closed.");
      if (cleanupTask) cleanupTask.stop();
      import("mongoose").then((mongoose) => {
        mongoose.default.disconnect().then(() => {
          console.log("MongoDB disconnected.");
          process.exit(0);
        });
      });
    });

    setTimeout(() => {
      console.error("Forceful shutdown after timeout.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
