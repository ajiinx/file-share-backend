import mongoose from "mongoose";

const sharedFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 180,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      maxlength: 64,
    },
    alias: {
      type: String,
      maxlength: 64,
    },
    storageKey: {
      type: String,
      required: true,
      maxlength: 255,
    },
    contentType: {
      type: String,
      required: true,
      maxlength: 120,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    expiryTime: {
      type: Date,
      required: true,
    },
    maxViews: {
      type: Number,
      required: true,
      default: 0,
    },
    currentViews: {
      type: Number,
      required: true,
      default: 0,
    },
    passwordHash: {
      type: String,
      maxlength: 120,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes mapping to MySQL indexes
sharedFileSchema.index({ expiryTime: 1 });

const SharedFile = mongoose.model("SharedFile", sharedFileSchema);
export default SharedFile;
