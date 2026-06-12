import express from "express";
import multer from "multer";
import fs from "fs";
import { body, param, validationResult } from "express-validator";
import { rateLimit } from "express-rate-limit";
import { SharedFileController } from "../controllers/SharedFileController.js";
import { config } from "../config/config.js";

// Ensure a temp directory for multer
const tempDir = "uploads/temp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({ 
  dest: tempDir,
  limits: {
    fileSize: config.APP_MAX_FILE_SIZE,
  }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: "Too many uploads, please try again later." }
});

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(400).json({ success: false, error: errors.array()[0].msg });
  }
  next();
};

const uploadValidation = [
  body("expiry").optional().isString().isIn(["TEN_MINUTES", "ONE_HOUR", "TWENTY_FOUR_HOURS"]),
  body("maxViews").optional().isInt({ min: 0 }),
  body("alias").optional().isString().matches(/^[a-zA-Z0-9-]{0,40}$/).withMessage("Alias must be alphanumeric and dashes only, up to 40 characters"),
  body("password").optional().isString().isLength({ max: 72 }).withMessage("Password must be 72 characters or fewer"),
  validateRequest
];

const tokenValidation = [
  param("token").isString().matches(/^[A-Za-z0-9]{5}$/).withMessage("Invalid token format"),
  validateRequest
];

const fileRouter = express.Router();

fileRouter.post("/",
  uploadLimiter,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ success: false, error: "File is too large" });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      if (err) return next(err);
      next();
    });
  },
  uploadValidation,
  SharedFileController.upload
);
fileRouter.get("/:token", tokenValidation, SharedFileController.metadata);
fileRouter.get("/:token/content", tokenValidation, SharedFileController.content);
fileRouter.get("/:token/qr", tokenValidation, SharedFileController.qrCode);

export default fileRouter;
