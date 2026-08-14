import type { 
  Chapter, 
  Problem, 
  Block, 
  Prompt,
  ChapterWithCount, 
  ProblemWithStatus,
  ProblemWithBlocks, 
  InsertChapter, 
  InsertProblem, 
  InsertBlock,
  InsertPrompt
} from "@shared/schema";
import { apiRequest } from "./queryClient";

// ============================================
// Chapter API
// ============================================

export async function fetchChapters(): Promise<ChapterWithCount[]> {
  const response = await fetch("/api/chapters");
  if (!response.ok) throw new Error("Failed to fetch chapters");
  return response.json();
}

export async function fetchChapter(id: string): Promise<Chapter> {
  const response = await fetch(`/api/chapters/${id}`);
  if (!response.ok) throw new Error("Failed to fetch chapter");
  return response.json();
}

export async function fetchGenres(): Promise<string[]> {
  const response = await fetch("/api/genres");
  if (!response.ok) throw new Error("Failed to fetch genres");
  return response.json();
}

export async function createChapter(data: InsertChapter): Promise<Chapter> {
  const response = await apiRequest("POST", "/api/chapters", data);
  return response.json();
}

export async function updateChapter(id: string, data: Partial<InsertChapter>): Promise<Chapter> {
  const response = await apiRequest("PATCH", `/api/chapters/${id}`, data);
  return response.json();
}

export async function deleteChapter(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/chapters/${id}`);
}

export async function reorderChapters(orderedIds: string[]): Promise<void> {
  await apiRequest("POST", "/api/chapters/reorder", { orderedIds });
}

// ============================================
// Problem API
// ============================================

export async function fetchProblems(chapterId: string): Promise<ProblemWithStatus[]> {
  const response = await fetch(`/api/chapters/${chapterId}/problems`);
  if (!response.ok) throw new Error("Failed to fetch problems");
  return response.json();
}

export async function fetchProblemWithBlocks(id: string): Promise<ProblemWithBlocks> {
  const response = await fetch(`/api/problems/${id}`);
  if (!response.ok) throw new Error("Failed to fetch problem");
  return response.json();
}

export async function createProblem(data: InsertProblem): Promise<Problem> {
  const response = await apiRequest("POST", "/api/problems", data);
  return response.json();
}

export async function updateProblem(id: string, data: Partial<InsertProblem>): Promise<Problem> {
  const response = await apiRequest("PATCH", `/api/problems/${id}`, data);
  return response.json();
}

export async function deleteProblem(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/problems/${id}`);
}

export async function reorderProblems(orderedIds: string[]): Promise<void> {
  await apiRequest("POST", "/api/problems/reorder", { orderedIds });
}

// ============================================
// Block API
// ============================================

export async function fetchBlocks(problemId: string): Promise<Block[]> {
  const response = await fetch(`/api/problems/${problemId}/blocks`);
  if (!response.ok) throw new Error("Failed to fetch blocks");
  return response.json();
}

export async function createBlock(data: InsertBlock): Promise<Block> {
  const response = await apiRequest("POST", "/api/blocks", data);
  return response.json();
}

export async function updateBlock(id: string, data: Partial<InsertBlock>): Promise<Block> {
  const response = await apiRequest("PATCH", `/api/blocks/${id}`, data);
  return response.json();
}

export async function deleteBlock(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/blocks/${id}`);
}

export async function reorderBlocks(orderedIds: string[]): Promise<void> {
  await apiRequest("POST", "/api/blocks/reorder", { orderedIds });
}

// ============================================
// AI API
// ============================================

export async function generateExplanation(data: {
  problem: string;
  code?: string;
  imageUrl?: string;
}): Promise<{ explanation: string }> {
  const response = await apiRequest("POST", "/api/ai/explain", data);
  return response.json();
}

export async function generateReview(data: {
  problem: string;
  modelCode?: string;
  explanation?: string;
  reviewCode: string;
}): Promise<{ review: string }> {
  const response = await apiRequest("POST", "/api/ai/review", data);
  return response.json();
}

export async function generateIcon(data: {
  title: string;
  genre?: string;
  colorIndex?: number;
}): Promise<{ iconUrl: string }> {
  const response = await apiRequest("POST", "/api/ai/generate-icon", data);
  return response.json();
}

export async function getIconPrompt(data: {
  title: string;
  genre?: string;
  colorIndex?: number;
}): Promise<{ prompt: string }> {
  const response = await apiRequest("POST", "/api/ai/icon-prompt", data);
  return response.json();
}

// ============================================
// File Upload API
// ============================================

// Above this size, upload in chunks instead: hosting front proxies (Replit,
// Cloudflare) reject request bodies past roughly 32MB with a 413, so a
// single-shot upload silently caps out well below what a real video needs.
const DIRECT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
// Must be a multiple of 256KB per Drive's resumable-upload chunk requirement.
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

export async function uploadFile(file: File, folder: "images" | "videos" | "files" = "images"): Promise<string> {
  if (file.size <= DIRECT_UPLOAD_MAX_BYTES) {
    return uploadFileDirect(file, folder);
  }
  return uploadFileChunked(file, folder);
}

// Uploaded through our own server (which then pushes the bytes to Drive)
// rather than PUT directly to Google's resumable URL, since Drive's upload
// endpoint does not allow direct browser uploads from arbitrary origins (CORS).
async function uploadFileDirect(file: File, folder: "images" | "videos" | "files"): Promise<string> {
  const params = new URLSearchParams({
    name: file.name,
    contentType: file.type || "application/octet-stream",
    folder,
  });

  const response = await fetch(`/api/uploads/direct?${params.toString()}`, {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to upload file");
  }

  const { objectPath } = await response.json();
  return objectPath;
}

// Opens a resumable upload session on the server (which talks to Drive), then
// streams the file to it in fixed-size chunks so no single request is large
// enough to be rejected by a front proxy's body-size limit.
async function uploadFileChunked(file: File, folder: "images" | "videos" | "files"): Promise<string> {
  const startRes = await apiRequest("POST", "/api/uploads/session/start", {
    name: file.name,
    contentType: file.type || "application/octet-stream",
    folder,
  });
  const { sessionId, objectPath } = await startRes.json();

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE_BYTES, file.size);
    const chunk = file.slice(offset, end);
    const response = await fetch(`/api/uploads/session/${sessionId}/chunk`, {
      method: "PUT",
      body: chunk,
      headers: {
        "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
        // Blob.slice() drops the source File's MIME type, so without this the
        // browser sends no Content-Type header at all and express.raw's type
        // matcher never fires, leaving req.body empty on the server.
        "Content-Type": "application/octet-stream",
      },
      credentials: "include",
    });

    if (response.status !== 308 && !response.ok) {
      throw new Error("Failed to upload file");
    }

    offset = end;
  }

  return objectPath;
}

// ============================================
// Prompt API
// ============================================

export async function fetchPrompts(): Promise<Prompt[]> {
  const response = await fetch("/api/prompts");
  if (!response.ok) throw new Error("Failed to fetch prompts");
  return response.json();
}

export async function fetchPrompt(id: string): Promise<Prompt> {
  const response = await fetch(`/api/prompts/${id}`);
  if (!response.ok) throw new Error("Failed to fetch prompt");
  return response.json();
}

export async function savePrompt(id: string, data: Omit<InsertPrompt, "id">): Promise<Prompt> {
  const response = await apiRequest("PUT", `/api/prompts/${id}`, data);
  return response.json();
}

// ============================================
// Self Review Links API
// ============================================

export async function createSelfReviewLink(problemId: string): Promise<{ id: string; problemId: string; token: string }> {
  const response = await apiRequest("POST", "/api/self-review-links", { problemId });
  return response.json();
}

export async function getSelfReviewLinkByProblemId(problemId: string): Promise<{ id: string; problemId: string; token: string } | null> {
  try {
    const response = await fetch(`/api/self-review-links/problem/${problemId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to fetch self-review link");
    return response.json();
  } catch {
    return null;
  }
}

export async function getSelfReviewInfo(token: string): Promise<{ problemTitle: string; chapterTitle: string }> {
  const response = await fetch(`/api/self-review/${token}`);
  if (!response.ok) throw new Error("Failed to fetch self-review info");
  return response.json();
}

export async function submitSelfReview(data: { token: string; reviewCode: string }): Promise<{ review: string; verdict: "pass" | "fail" }> {
  const response = await apiRequest("POST", "/api/ai/self-review", data);
  return response.json();
}
