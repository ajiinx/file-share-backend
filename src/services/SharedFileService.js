import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import SharedFile from "../models/SharedFile.js";
import { FileStorageService } from "./FileStorageService.js";
import { config } from "../config/config.js";

const TOKEN_LENGTH = 5;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateUniqueToken() {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, TOKEN_ALPHABET.length);
    token += TOKEN_ALPHABET[randomIndex];
  }
  return token;
}

function normalizeAlias(alias) {
  if (!alias || alias.trim() === "") return null;
  
  let normalizedAlias = alias.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  normalizedAlias = normalizedAlias.replace(/-{2,}/g, "-");
  normalizedAlias = normalizedAlias.replace(/^-|-$/g, "");
  
  if (!normalizedAlias) return null;
  
  if (normalizedAlias.length > 40) {
    normalizedAlias = normalizedAlias.substring(0, 40).replace(/-+$/, "");
  }
  
  return normalizedAlias || null;
}

function sanitizeName(originalFilename) {
  let filename = originalFilename ? path.basename(originalFilename) : "upload.bin";
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!filename || filename === "." || filename === "..") {
    return "upload.bin";
  }
  return filename.length > 180 ? filename.substring(filename.length - 180) : filename;
}

function trimTrailingSlash(str) {
  return str.replace(/\/$/, "");
}

function shareUrl(file) {
  const baseUrl = trimTrailingSlash(config.APP_PUBLIC_BASE_URL);
  if (file.alias) {
    return `${baseUrl}/${file.token}/${file.alias}`;
  }
  return `${baseUrl}/${file.token}`;
}

function apiUrl(file, download) {
  const baseUrl = trimTrailingSlash(config.APP_API_BASE_URL);
  return `${baseUrl}/api/files/${file.token}/content?download=${download}`;
}

function qrCodeUrl(file) {
  const baseUrl = trimTrailingSlash(config.APP_API_BASE_URL);
  return `${baseUrl}/api/files/${file.token}/qr`;
}

function toUploadResponse(file) {
  return {
    token: file.token,
    alias: file.alias || null,
    name: file.name,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    expiryTime: file.expiryTime,
    maxViews: file.maxViews,
    currentViews: file.currentViews,
    passwordProtected: !!file.passwordHash,
    shareUrl: shareUrl(file),
    previewUrl: apiUrl(file, false),
    downloadUrl: apiUrl(file, true),
    qrCodeUrl: qrCodeUrl(file)
  };
}

function toMetadataResponse(file, passwordVerified, available) {
  return {
    token: file.token,
    alias: file.alias || null,
    name: file.name,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    expiryTime: file.expiryTime,
    maxViews: file.maxViews,
    currentViews: file.currentViews,
    remainingViews: file.maxViews > 0 ? Math.max(0, file.maxViews - file.currentViews) : -1,
    passwordProtected: !!file.passwordHash,
    passwordVerified,
    available,
    shareUrl: shareUrl(file),
    previewUrl: apiUrl(file, false),
    downloadUrl: apiUrl(file, true),
    qrCodeUrl: qrCodeUrl(file)
  };
}

async function isPasswordVerified(file, password) {
  if (!file.passwordHash) return true;
  if (!password || password.trim() === "") return false;
  return await bcrypt.compare(password, file.passwordHash);
}

function isAvailable(file, now) {
  return file.expiryTime > now && (file.maxViews === 0 || file.currentViews < file.maxViews);
}

export const SharedFileService = {
  async upload(fileObj, expiryDurationMs, maxViews, alias, password) {
    if (!fileObj || !fileObj.path) {
      const error = new Error("Upload a non-empty file");
      error.statusCode = 400;
      throw error;
    }

    const normalizedMaxViews = maxViews == null ? 1 : Math.max(0, maxViews);
    
    // Generate unique token
    let token;
    let exists = true;
    while (exists) {
      token = generateUniqueToken();
      const existingToken = await SharedFile.findOne({ token }).lean();
      exists = !!existingToken;
    }

    const normalizedAlias = normalizeAlias(alias);
    const originalName = sanitizeName(fileObj.originalname);
    const storageKey = `${token}-${originalName}`;
    const contentType = fileObj.mimetype && fileObj.mimetype.trim() !== "" ? fileObj.mimetype : "application/octet-stream";
    const now = new Date();
    const expiryTime = new Date(now.getTime() + expiryDurationMs);
    const passwordHash = password && password.trim() !== "" ? await bcrypt.hash(password, 10) : null;

    let storedObject = null;
    try {
      storedObject = await FileStorageService.store(fileObj.path, storageKey, contentType);
      
      const sharedFile = new SharedFile({
        name: originalName,
        token,
        alias: normalizedAlias,
        storageKey: storedObject.storageKey,
        contentType,
        sizeBytes: storedObject.sizeBytes,
        expiryTime,
        maxViews: normalizedMaxViews,
        passwordHash,
        currentViews: 0
      });
      
      const saved = await sharedFile.save();
      console.log(`Stored temporary file sizeBytes=${storedObject.sizeBytes} expiresAt=${expiryTime}`);
      return toUploadResponse(saved);
    } catch (err) {
      if (storedObject) {
        await FileStorageService.deleteQuietly(storedObject.storageKey);
      }
      if (!storedObject && fileObj.path) {
          try { fs.unlinkSync(fileObj.path); } catch(e) {}
      }
      if (!err.statusCode) {
        err.statusCode = 500;
        err.message = "Unable to store uploaded file";
      }
      throw err;
    }
  },

  async metadata(token, password) {
    const file = await SharedFile.findOne({ token }).lean();
    if (!file) {
      const error = new Error("File link was not found");
      error.statusCode = 404;
      throw error;
    }

    const passwordVerified = await isPasswordVerified(file, password);
    const available = isAvailable(file, new Date());

    if (file.passwordHash && !passwordVerified) {
      return {
        token: file.token,
        alias: file.alias || null,
        name: null,
        contentType: null,
        sizeBytes: 0,
        expiryTime: file.expiryTime,
        maxViews: file.maxViews,
        currentViews: file.currentViews,
        remainingViews: file.maxViews > 0 ? Math.max(0, file.maxViews - file.currentViews) : -1,
        passwordProtected: true,
        passwordVerified: false,
        available,
        shareUrl: shareUrl(file),
        previewUrl: null,
        downloadUrl: null,
        qrCodeUrl: qrCodeUrl(file)
      };
    }

    return toMetadataResponse(file, passwordVerified, available);
  },

  async publicShareUrl(token) {
    const file = await SharedFile.findOne({ token }).lean();
    if (!file) {
      const error = new Error("File link was not found");
      error.statusCode = 404;
      throw error;
    }
    return shareUrl(file);
  },

  async prepareAccess(token, password) {
    // First find the file to check password
    const file = await SharedFile.findOne({ token }).lean();
    if (!file) {
      const error = new Error("File link was not found");
      error.statusCode = 404;
      throw error;
    }

    // Check expiry
    const now = new Date();
    if (file.expiryTime <= now) {
      const error = new Error("This file link has expired");
      error.statusCode = 410;
      throw error;
    }

    // Check password
    const passwordVerified = await isPasswordVerified(file, password);
    if (!passwordVerified) {
      const error = new Error("Password is required or incorrect");
      error.statusCode = 401;
      throw error;
    }

    // Atomically increment view count with condition check
    const query = { token };
    if (file.maxViews > 0) {
      query.currentViews = { $lt: file.maxViews };
    }
    const updated = await SharedFile.findOneAndUpdate(
      query,
      { $inc: { currentViews: 1 } },
      { new: true }
    );

    if (!updated) {
      const error = new Error("This file has reached its view limit");
      error.statusCode = 410;
      throw error;
    }

    const download = false; // We can set default download false or handle it in controller. 
    // Wait, prepareAccess is called by the controller which knows if it's a download. 
    // Let's change prepareAccess signature: `async prepareAccess(token, password, download)`
    // Or just return the storageKey and let the controller generate the URL.
    // Yes, returning storageKey is cleaner.
    return {
      fileName: updated.name,
      contentType: updated.contentType,
      sizeBytes: updated.sizeBytes,
      storageKey: updated.storageKey
    };
  },

  async cleanupExpiredAndExhausted() {
    const now = new Date();
    const filesToCleanup = await SharedFile.find({
      $or: [
        { expiryTime: { $lte: now } },
        { $and: [{ maxViews: { $gt: 0 } }, { $expr: { $gte: ["$currentViews", "$maxViews"] } }] }
      ]
    });

    for (const file of filesToCleanup) {
      await FileStorageService.deleteQuietly(file.storageKey);
      await SharedFile.deleteOne({ _id: file._id });
    }

    if (filesToCleanup.length > 0) {
      console.log(`Cleaned up ${filesToCleanup.length} temporary files`);
    }
    return filesToCleanup.length;
  }
};
