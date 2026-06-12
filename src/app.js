import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import { config } from "./config/config.js";

import fileRouter from "./routes/fileRoutes.js";

const app = express();

// Security & Rate Limiting
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: "draft-7", // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});
app.use(limiter);

// Middlewares
app.use(
  cors({
    origin: config.APP_PUBLIC_BASE_URL.split(",").map((origin) =>
      origin.trim(),
    ),
    methods: ["GET", "POST", "OPTIONS"],
    exposedHeaders: ["Content-Disposition", "Content-Type", "Content-Length"],
    maxAge: 3600,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Media share API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

app.use("/api/files", fileRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
