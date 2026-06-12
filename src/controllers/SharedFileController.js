import QRCode from "qrcode";
import { SharedFileService } from "../services/SharedFileService.js";
import { FileStorageService } from "../services/FileStorageService.js";

const EXPIRY_MAP = {
  TEN_MINUTES: 10 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,
};

export const SharedFileController = {
  async upload(req, res, next) {
    try {
      const file = req.file;
      let expiryStr = req.body.expiry || "TEN_MINUTES";
      let expiryDurationMs = EXPIRY_MAP[expiryStr] || EXPIRY_MAP.TEN_MINUTES;
      
      let maxViews = parseInt(req.body.maxViews, 10);
      if (isNaN(maxViews)) maxViews = 1;

      const alias = req.body.alias;
      const password = req.body.password;

      const response = await SharedFileService.upload(file, expiryDurationMs, maxViews, alias, password);
      res.status(200).json({ success: true, data: response });
    } catch (err) {
      next(err);
    }
  },

  async metadata(req, res, next) {
    try {
      const { token } = req.params;
      const passwordHeader = req.header("X-File-Password");
      const passwordQuery = req.query.password;
      const password = passwordHeader || passwordQuery;

      const response = await SharedFileService.metadata(token, password);
      res.set("Cache-Control", "no-store");
      res.status(200).json({ success: true, data: response });
    } catch (err) {
      next(err);
    }
  },

  async content(req, res, next) {
    const DANGEROUS_MIME_TYPES = new Set([
      'text/html', 'application/xhtml+xml', 'application/javascript',
      'text/javascript', 'image/svg+xml', 'application/xml', 'text/xml',
    ]);

    try {
      const { token } = req.params;
      const download = req.query.download === "true";
      const passwordHeader = req.header("X-File-Password");
      const passwordQuery = req.query.password;
      const password = passwordHeader || passwordQuery;

      const access = await SharedFileService.prepareAccess(token, password);

      const url = await FileStorageService.getPresignedUrl(
        access.storageKey,
        download,
        access.fileName,
        access.contentType
      );

      res.set("Cache-Control", "no-store");
      res.status(200).json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },

  async qrCode(req, res, next) {
    try {
      const { token } = req.params;

      const shareUrl = await SharedFileService.publicShareUrl(token);
      
      const qrImageBuffer = await QRCode.toBuffer(shareUrl, {
        type: "png",
        width: 320,
        margin: 1,
      });

      res.set("Cache-Control", "no-store");
      res.set("Content-Type", "image/png");
      res.status(200).send(qrImageBuffer);
    } catch (err) {
      next(err);
    }
  }
};
