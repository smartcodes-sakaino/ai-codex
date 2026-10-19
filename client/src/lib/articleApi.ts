import type {
  Article,
  ArticleCategory,
  ArticleCategoryWithCount,
  ArticleWithCategory,
  InsertArticle,
  InsertArticleCategory,
} from "@shared/schema";
import { apiRequest } from "./queryClient";

// ============================================
// Article Category API (admin)
// ============================================

export async function fetchArticleCategories(): Promise<ArticleCategoryWithCount[]> {
  const response = await apiRequest("GET", "/api/article-categories");
  return response.json();
}

export async function fetchArticleCategory(id: string): Promise<ArticleCategory> {
  const response = await apiRequest("GET", `/api/article-categories/${id}`);
  return response.json();
}

export async function fetchArticleGenres(): Promise<string[]> {
  const response = await apiRequest("GET", "/api/article-genres");
  return response.json();
}

export async function createArticleCategory(data: InsertArticleCategory): Promise<ArticleCategory> {
  const response = await apiRequest("POST", "/api/article-categories", data);
  return response.json();
}

export async function updateArticleCategory(
  id: string,
  data: Partial<Pick<InsertArticleCategory, "title" | "genre" | "icon">>
): Promise<ArticleCategory> {
  const response = await apiRequest("PATCH", `/api/article-categories/${id}`, data);
  return response.json();
}

export async function deleteArticleCategory(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/article-categories/${id}`);
}

export async function reorderArticleCategories(orderedIds: string[]): Promise<void> {
  await apiRequest("POST", "/api/article-categories/reorder", { orderedIds });
}

// ============================================
// Article API
// ============================================

export async function fetchArticles(categoryId: string): Promise<Article[]> {
  const response = await apiRequest("GET", `/api/article-categories/${categoryId}/articles`);
  return response.json();
}

/** Readable by any signed-in account — this is what a shared link opens. */
export async function fetchArticle(id: string): Promise<ArticleWithCategory> {
  const response = await apiRequest("GET", `/api/articles/${id}`);
  return response.json();
}

export async function createArticle(data: InsertArticle): Promise<Article> {
  const response = await apiRequest("POST", "/api/articles", data);
  return response.json();
}

export async function updateArticle(
  id: string,
  data: Partial<Pick<InsertArticle, "title" | "markdown">>
): Promise<Article> {
  const response = await apiRequest("PATCH", `/api/articles/${id}`, data);
  return response.json();
}

export async function deleteArticle(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/articles/${id}`);
}

export async function reorderArticles(orderedIds: string[]): Promise<void> {
  await apiRequest("POST", "/api/articles/reorder", { orderedIds });
}

/** The address to paste into a lesson or chat to share an article. */
export function articleShareUrl(id: string): string {
  return `${window.location.origin}/articles/${id}`;
}
