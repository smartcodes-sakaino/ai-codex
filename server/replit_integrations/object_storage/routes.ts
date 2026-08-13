import type { Express } from "express";
import express from "express";
import { ObjectStorageService, ObjectNotFoundError, type UploadFolder } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * Uploads are proxied through this server rather than PUT directly from the
 * browser to Google's resumable upload URL: Drive's upload endpoint does not
 * send CORS headers for arbitrary origins, so a direct browser PUT is blocked.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Upload a file's raw bytes directly to Drive via the server.
   *
   * Query string: name (required), contentType, folder ("images" | "videos")
   * Body: the raw file bytes.
   */
  app.post(
    "/api/uploads/direct",
    express.raw({ type: "*/*", limit: "300mb" }),
    async (req, res) => {
      try {
        const name = typeof req.query.name === "string" ? req.query.name : "";
        const contentType =
          typeof req.query.contentType === "string" ? req.query.contentType : "application/octet-stream";
        const folder: UploadFolder = req.query.folder === "videos" ? "videos" : "images";

        if (!name) {
          return res.status(400).json({ error: "Missing required field: name" });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "Empty file body" });
        }

        const objectPath = await objectStorageService.uploadBuffer(req.body, name, contentType, { folder });
        res.json({ objectPath });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  );

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/*path", async (req, res) => {
    try {
      const fileId = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(fileId, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

