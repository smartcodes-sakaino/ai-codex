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
}): Promise<{ iconUrl: string }> {
  const response = await apiRequest("POST", "/api/ai/generate-icon", data);
  return response.json();
}

// ============================================
// File Upload API
// ============================================

export async function uploadFile(file: File): Promise<string> {
  // Step 1: Request presigned URL
  const urlResponse = await apiRequest("POST", "/api/uploads/request-url", {
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  });
  const { uploadURL, objectPath } = await urlResponse.json();

  // Step 2: Upload file to presigned URL
  const uploadResponse = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file");
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
