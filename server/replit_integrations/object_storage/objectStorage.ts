import { google } from "googleapis";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { getCachedObject, setCachedObject } from "./objectCache";

// Parses a single-range "bytes=start-end" Range header against a known total
// length. Returns null for anything we don't recognize (multi-range, unit
// other than bytes, unsatisfiable range) so the caller can fall back to a
// full response.
function parseByteRange(rangeHeader: string, totalLength: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;
  if (!startStr) {
    // Suffix range: "bytes=-500" means the last 500 bytes.
    const suffixLength = parseInt(endStr, 10);
    start = Math.max(totalLength - suffixLength, 0);
    end = totalLength - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr ? parseInt(endStr, 10) : totalLength - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalLength) return null;
  return { start, end: Math.min(end, totalLength - 1) };
}

// Loosely parses "bytes=start-end" without needing to know the total file size —
// used only to decide what to ask Drive for, before we know how big the file is.
function parseRangeRequest(rangeHeader: string): { start?: number; end?: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;
  return {
    start: startStr ? parseInt(startStr, 10) : undefined,
    end: endStr ? parseInt(endStr, 10) : undefined,
  };
}

// Replit's proxy kills responses over roughly the same ~32MB it caps request
// bodies at (an opaque 500, discovered the same way the upload limit was: by
// bisecting response sizes against the live deployment). So a single hop to
// Drive never asks for more than this many bytes, regardless of what the
// client's Range header requested — or whether it sent one at all. This is
// exactly how real video streaming already works: the player fetches a large
// file as a sequence of range-limited chunks, not one giant response.
const MAX_RESPONSE_CHUNK_BYTES = 16 * 1024 * 1024;

// Shared Google auth for Drive (image/file storage) and Sheets (progress export).
// Locally, this authenticates via Application Default Credentials: set
// GOOGLE_APPLICATION_CREDENTIALS to the path of a Google Cloud service account key
// JSON file. Environments without a filesystem (e.g. Cloudflare Workers) instead set
// GOOGLE_SERVICE_ACCOUNT_JSON to the key file's raw contents. Either way, the service
// account must be added as a member of the shared Drive folder used for storage.
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const auth = new google.auth.GoogleAuth({
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
  ...(serviceAccountJson ? { credentials: JSON.parse(serviceAccountJson) } : {}),
});

export const driveClient = google.drive({ version: "v3", auth });
export const sheetsClient = google.sheets({ version: "v4", auth });

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export type UploadFolder = "images" | "videos" | "files";

function getImagesFolderId(): string {
  const folderId = process.env.DRIVE_IMAGES_FOLDER_ID || "";
  if (!folderId) {
    throw new Error(
      "DRIVE_IMAGES_FOLDER_ID not set. Set it to the ID of the Google Drive folder " +
        "used for storing images (the folder ID from its share URL)."
    );
  }
  return folderId;
}

function getVideosFolderId(): string {
  const folderId = process.env.DRIVE_VIDEOS_FOLDER_ID || "";
  if (!folderId) {
    throw new Error(
      "DRIVE_VIDEOS_FOLDER_ID not set. Set it to the ID of the Google Drive folder " +
        "used for storing videos (the folder ID from its share URL)."
    );
  }
  return folderId;
}

function getFilesFolderId(): string {
  const folderId = process.env.DRIVE_FILES_FOLDER_ID || "";
  if (!folderId) {
    throw new Error(
      "DRIVE_FILES_FOLDER_ID not set. Set it to the ID of the Google Drive folder " +
        "used for storing downloadable attachments (the folder ID from its share URL)."
    );
  }
  return folderId;
}

function getFolderId(folder: UploadFolder): string {
  if (folder === "videos") return getVideosFolderId();
  if (folder === "files") return getFilesFolderId();
  return getImagesFolderId();
}

// The object storage service stores files in a shared Google Drive folder.
export class ObjectStorageService {
  constructor() {}

  // Uploads a buffer directly (e.g. an AI-generated icon) and returns its object path.
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options: { public?: boolean; folder?: UploadFolder } = {}
  ): Promise<string> {
    const fileId = await this.generateFileId();

    await driveClient.files.create({
      requestBody: { id: fileId, name: filename, parents: [getFolderId(options.folder ?? "images")] },
      media: { mimeType, body: Readable.from(buffer) },
      supportsAllDrives: true,
      fields: "id",
    });

    if (options.public) {
      await this.makePublic(fileId);
    }

    return `/objects/${fileId}`;
  }

  // Grants "anyone with the link" read access to an uploaded file.
  async makePublic(fileId: string): Promise<void> {
    await driveClient.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  }

  // Starts a resumable upload session and returns a URL the client can PUT the file to directly.
  async getObjectEntityUploadURL(
    name: string,
    contentType: string,
    folder: UploadFolder = "images"
  ): Promise<{ uploadURL: string; objectPath: string }> {
    const fileId = await this.generateFileId();

    const authClient = await auth.getClient();
    const { token: accessToken } = await authClient.getAccessToken();

    const initResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
        },
        body: JSON.stringify({ id: fileId, name, parents: [getFolderId(folder)] }),
      }
    );

    if (!initResponse.ok) {
      throw new Error(
        `Failed to start Drive upload session (status ${initResponse.status})`
      );
    }

    const uploadURL = initResponse.headers.get("Location");
    if (!uploadURL) {
      throw new Error("Drive did not return an upload session URL");
    }

    return { uploadURL, objectPath: `/objects/${fileId}` };
  }

  // Confirms an object exists and returns its Drive file ID.
  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const fileId = objectPath.slice("/objects/".length);
    if (!fileId) {
      throw new ObjectNotFoundError();
    }

    try {
      await driveClient.files.get({ fileId, fields: "id", supportsAllDrives: true });
    } catch {
      throw new ObjectNotFoundError();
    }

    return fileId;
  }

  // Downloads an object to the response. Uses a bounded in-memory cache so repeat
  // requests for the same file (chapter icons, certificates) skip Google Drive entirely.
  //
  // Honors Range requests: <video> playback depends on it — browsers probe with
  // a Range request before they'll play a file at all, not just for seeking.
  async downloadObject(fileId: string, req: Request, res: Response, cacheTtlSec: number = 3600) {
    try {
      const rangeHeader = req.headers.range;

      const cached = getCachedObject(fileId);
      if (cached) {
        const { buffer, contentType } = cached;
        const range = typeof rangeHeader === "string" ? parseByteRange(rangeHeader, buffer.length) : null;
        if (range) {
          res.status(206).set({
            "Content-Type": contentType,
            "Content-Range": `bytes ${range.start}-${range.end}/${buffer.length}`,
            "Content-Length": String(range.end - range.start + 1),
            "Accept-Ranges": "bytes",
            "Cache-Control": `public, max-age=${cacheTtlSec}`,
          });
          res.end(buffer.subarray(range.start, range.end + 1));
          return;
        }
        res.set({
          "Content-Type": contentType,
          "Content-Length": String(buffer.length),
          "Accept-Ranges": "bytes",
          "Cache-Control": `public, max-age=${cacheTtlSec}`,
        });
        res.end(buffer);
        return;
      }

      // Always ask Drive for an explicit, capped range — never the client's raw
      // Range header as-is, and never "no range at all" — so a single hop to
      // Drive can never return more than MAX_RESPONSE_CHUNK_BYTES. The client's
      // requested end (if any) is honored as long as it fits under the cap.
      const requested = typeof rangeHeader === "string" ? parseRangeRequest(rangeHeader) : null;
      const start = requested?.start ?? 0;
      const end =
        requested?.end !== undefined
          ? Math.min(requested.end, start + MAX_RESPONSE_CHUNK_BYTES - 1)
          : start + MAX_RESPONSE_CHUNK_BYTES - 1;

      const response = await driveClient.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream", headers: { Range: `bytes=${start}-${end}` } }
      );

      // googleapis' fetch-based transport returns a Headers instance here, not
      // a plain object — bracket access silently returns undefined, which was
      // causing every download to fall back to application/octet-stream.
      const rawHeaders = response.headers as unknown;
      const getHeader = (name: string): string | null =>
        typeof (rawHeaders as Headers)?.get === "function"
          ? (rawHeaders as Headers).get(name)
          : ((rawHeaders as Record<string, string> | undefined)?.[name] ?? null);

      const contentType = getHeader("content-type") || "application/octet-stream";
      const contentRange = getHeader("content-range"); // "bytes start-end/total"
      const rangeMatch = contentRange ? /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange) : null;

      response.data.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      // The client didn't ask for a range, and the chunk we happened to fetch
      // (capped at MAX_RESPONSE_CHUNK_BYTES) turned out to cover the whole
      // file — i.e. the file is smaller than the cap. Respond exactly like a
      // normal full download, and cache it (only whole files are cached).
      const isWholeFile =
        typeof rangeHeader !== "string" &&
        rangeMatch !== null &&
        rangeMatch[1] === "0" &&
        Number(rangeMatch[2]) + 1 === Number(rangeMatch[3]);

      if (isWholeFile) {
        res.status(200).set({
          "Content-Type": contentType,
          "Content-Length": rangeMatch![3],
          "Accept-Ranges": "bytes",
          "Cache-Control": `public, max-age=${cacheTtlSec}`,
        });
        const chunks: Buffer[] = [];
        response.data.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.data.on("end", () => {
          setCachedObject(fileId, { buffer: Buffer.concat(chunks), contentType });
        });
        response.data.pipe(res);
        return;
      }

      // Otherwise relay Drive's partial response as-is — this is the common
      // case for anything bigger than one chunk, whether or not the client
      // actually sent a Range header itself.
      res.status(response.status && response.status !== 200 ? response.status : 206);
      res.set({
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      if (contentRange) res.set("Content-Range", contentRange);
      const contentLength = getHeader("content-length");
      if (contentLength) res.set("Content-Length", contentLength);
      response.data.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  private async generateFileId(): Promise<string> {
    const { data } = await driveClient.files.generateIds({ count: 1 });
    const fileId = data.ids?.[0];
    if (!fileId) {
      throw new Error("Failed to generate a Drive file ID");
    }
    return fileId;
  }
}
