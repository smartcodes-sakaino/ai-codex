import type { Express } from "express";
import express from "express";
import { randomUUID } from "crypto";
import { ObjectStorageService, ObjectNotFoundError, type UploadFolder } from "./objectStorage";

// Both Replit's and Cloudflare's front proxies reject request bodies above
// roughly 32MB with a 413, well below files a real video lesson needs. Small
// files (most images) go through in one shot; anything larger is sent by the
// client in chunks and relayed to Drive's own resumable-upload session, so no
// single hop ever needs to carry more than a few MB.
const DIRECT_UPLOAD_LIMIT = "20mb";

// sessionId -> Drive's resumable upload URL for that in-progress upload.
// Session state is only meaningful within a single server process; that's
// fine for a single-instance deployment, and uploads are short-lived enough
// that losing an in-progress one on a restart is an acceptable tradeoff.
const uploadSessions = new Map<string, { uploadURL: string; objectPath: string }>();

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
   * Upload a file's raw bytes directly to Drive via the server. Only suitable
   * for files under DIRECT_UPLOAD_LIMIT — larger files must use the chunked
   * session endpoints below.
   *
   * Query string: name (required), contentType, folder ("images" | "videos")
   * Body: the raw file bytes.
   */
  app.post(
    "/api/uploads/direct",
    express.raw({ type: "*/*", limit: DIRECT_UPLOAD_LIMIT }),
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
   * Start a chunked upload: opens a resumable session with Drive and hands
   * back an opaque sessionId the client sends chunks to.
   *
   * Body (JSON): { name, contentType, folder }
   */
  app.post("/api/uploads/session/start", async (req, res) => {
    try {
      const { name, contentType, folder } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      const uploadFolder: UploadFolder = folder === "videos" ? "videos" : "images";
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(
        name,
        typeof contentType === "string" ? contentType : "application/octet-stream",
        uploadFolder
      );
      const sessionId = randomUUID();
      uploadSessions.set(sessionId, { uploadURL, objectPath });
      res.json({ sessionId, objectPath });
    } catch (error) {
      console.error("Error starting upload session:", error);
      res.status(500).json({ error: "Failed to start upload session" });
    }
  });

  /**
   * Relay one chunk of a chunked upload to Drive's resumable upload session.
   * The client sets the standard resumable-upload Content-Range header
   * (e.g. "bytes 0-8388607/52428800"); the response mirrors what Drive
   * returns — 308 with a Range header while incomplete, 200 with the file
   * once the last chunk lands.
   */
  app.put(
    "/api/uploads/session/:sessionId/chunk",
    express.raw({ type: "*/*", limit: "15mb" }),
    async (req, res) => {
      const session = uploadSessions.get(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found or already completed" });
      }
      const contentRange = req.headers["content-range"];
      if (typeof contentRange !== "string") {
        return res.status(400).json({ error: "Missing Content-Range header" });
      }
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Empty chunk body" });
      }

      try {
        const driveRes = await fetch(session.uploadURL, {
          method: "PUT",
          headers: {
            "Content-Range": contentRange,
            "Content-Length": String(req.body.length),
          },
          body: req.body,
        });

        if (driveRes.status === 308) {
          const range = driveRes.headers.get("range");
          if (range) res.set("Range", range);
          return res.status(308).end();
        }

        if (driveRes.ok) {
          uploadSessions.delete(req.params.sessionId);
          return res.json({ objectPath: session.objectPath, done: true });
        }

        const text = await driveRes.text();
        console.error("Drive chunk upload failed:", driveRes.status, text);
        uploadSessions.delete(req.params.sessionId);
        return res.status(502).json({ error: "Failed to upload chunk to Drive" });
      } catch (error) {
        console.error("Error relaying upload chunk:", error);
        uploadSessions.delete(req.params.sessionId);
        res.status(500).json({ error: "Failed to upload chunk" });
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
      await objectStorageService.downloadObject(fileId, req, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

