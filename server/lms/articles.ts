import type { Express } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { eq, asc, sql } from "drizzle-orm";
import {
  articleCategories,
  articles,
  insertArticleCategorySchema,
  insertArticleSchema,
  type ArticleCategory,
  type ArticleCategoryWithCount,
  type Article,
  type ArticleWithCategory,
  type InsertArticleCategory,
  type InsertArticle,
} from "@shared/schema";
import { db } from "../db";
import { requireAuth, requireRole } from "./auth";

// ============================================
// Storage
// ============================================

export const articleStorage = {
  async getCategories(): Promise<ArticleCategoryWithCount[]> {
    const result = await db
      .select({
        id: articleCategories.id,
        title: articleCategories.title,
        genre: articleCategories.genre,
        icon: articleCategories.icon,
        colorIndex: articleCategories.colorIndex,
        order: articleCategories.order,
        createdAt: articleCategories.createdAt,
        articleCount: sql<number>`cast(count(${articles.id}) as int)`,
      })
      .from(articleCategories)
      .leftJoin(articles, eq(articleCategories.id, articles.categoryId))
      .groupBy(articleCategories.id)
      .orderBy(asc(articleCategories.order));
    return result.map((r) => ({ ...r, articleCount: r.articleCount || 0 }));
  },

  async getCategory(id: string): Promise<ArticleCategory | undefined> {
    const [category] = await db.select().from(articleCategories).where(eq(articleCategories.id, id));
    return category;
  },

  async getGenres(): Promise<string[]> {
    const result = await db
      .selectDistinct({ genre: articleCategories.genre })
      .from(articleCategories)
      .where(sql`${articleCategories.genre} != ''`);
    return result.map((r) => r.genre);
  },

  async createCategory(data: InsertArticleCategory): Promise<ArticleCategory> {
    const [created] = await db.insert(articleCategories).values({ ...data, id: randomUUID() }).returning();
    return created;
  },

  async updateCategory(id: string, data: Partial<InsertArticleCategory>): Promise<ArticleCategory | undefined> {
    const [updated] = await db.update(articleCategories).set(data).where(eq(articleCategories.id, id)).returning();
    return updated;
  },

  async deleteCategory(id: string): Promise<void> {
    await db.delete(articleCategories).where(eq(articleCategories.id, id));
  },

  async reorderCategories(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(articleCategories).set({ order: i }).where(eq(articleCategories.id, orderedIds[i]));
    }
  },

  async getArticles(categoryId: string): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(eq(articles.categoryId, categoryId))
      .orderBy(asc(articles.order));
  },

  async getArticle(id: string): Promise<ArticleWithCategory | undefined> {
    const [row] = await db
      .select({ article: articles, categoryTitle: articleCategories.title })
      .from(articles)
      .innerJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
      .where(eq(articles.id, id));
    return row ? { ...row.article, categoryTitle: row.categoryTitle } : undefined;
  },

  async createArticle(data: InsertArticle): Promise<Article> {
    const [created] = await db.insert(articles).values({ ...data, id: randomUUID() }).returning();
    return created;
  },

  async updateArticle(id: string, data: Partial<InsertArticle>): Promise<Article | undefined> {
    const [updated] = await db
      .update(articles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return updated;
  },

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  },

  async reorderArticles(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(articles).set({ order: i }).where(eq(articles.id, orderedIds[i]));
    }
  },
};

// ============================================
// Routes
// ============================================

const reorderSchema = z.object({ orderedIds: z.array(z.string()) });

// Only the fields an admin edits after creation — the category an article
// belongs to and the ids/timestamps are never changed through PATCH.
const updateCategorySchema = insertArticleCategorySchema.pick({ title: true, genre: true, icon: true }).partial();
const updateArticleSchema = insertArticleSchema.pick({ title: true, markdown: true }).partial();

export function registerArticleRoutes(app: Express): void {
  const requireAdmin = [requireAuth, requireRole("admin")] as const;
  // Articles are plain reading material shared by link, outside any course,
  // so every signed-in account can open one — no assignment check.
  const requireSignedIn = [requireAuth, requireRole(["learner", "admin"])] as const;

  // ---------- Categories (admin) ----------

  app.get("/api/article-categories", ...requireAdmin, async (_req, res) => {
    try {
      res.json(await articleStorage.getCategories());
    } catch (error) {
      console.error("Error fetching article categories:", error);
      res.status(500).json({ error: "記事カテゴリの取得に失敗しました" });
    }
  });

  app.get("/api/article-genres", ...requireAdmin, async (_req, res) => {
    try {
      res.json(await articleStorage.getGenres());
    } catch (error) {
      console.error("Error fetching article genres:", error);
      res.status(500).json({ error: "ジャンルの取得に失敗しました" });
    }
  });

  app.post("/api/article-categories/reorder", ...requireAdmin, async (req, res) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }
    try {
      await articleStorage.reorderCategories(parsed.data.orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering article categories:", error);
      res.status(500).json({ error: "記事カテゴリの並び替えに失敗しました" });
    }
  });

  app.get<{ id: string }>("/api/article-categories/:id", ...requireAdmin, async (req, res) => {
    try {
      const category = await articleStorage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "記事カテゴリが見つかりません" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching article category:", error);
      res.status(500).json({ error: "記事カテゴリの取得に失敗しました" });
    }
  });

  app.post("/api/article-categories", ...requireAdmin, async (req, res) => {
    const parsed = insertArticleCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "無効なデータです", details: parsed.error });
    }
    try {
      res.status(201).json(await articleStorage.createCategory(parsed.data));
    } catch (error) {
      console.error("Error creating article category:", error);
      res.status(500).json({ error: "記事カテゴリの作成に失敗しました" });
    }
  });

  app.patch<{ id: string }>("/api/article-categories/:id", ...requireAdmin, async (req, res) => {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "無効なデータです", details: parsed.error });
    }
    try {
      const category = await articleStorage.updateCategory(req.params.id, parsed.data);
      if (!category) {
        return res.status(404).json({ error: "記事カテゴリが見つかりません" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating article category:", error);
      res.status(500).json({ error: "記事カテゴリの更新に失敗しました" });
    }
  });

  app.delete<{ id: string }>("/api/article-categories/:id", ...requireAdmin, async (req, res) => {
    try {
      await articleStorage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting article category:", error);
      res.status(500).json({ error: "記事カテゴリの削除に失敗しました" });
    }
  });

  app.get<{ id: string }>("/api/article-categories/:id/articles", ...requireAdmin, async (req, res) => {
    try {
      res.json(await articleStorage.getArticles(req.params.id));
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: "記事の取得に失敗しました" });
    }
  });

  // ---------- Articles ----------

  app.post("/api/articles/reorder", ...requireAdmin, async (req, res) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }
    try {
      await articleStorage.reorderArticles(parsed.data.orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering articles:", error);
      res.status(500).json({ error: "記事の並び替えに失敗しました" });
    }
  });

  // The one read route open to learners: the page behind a shared link.
  app.get<{ id: string }>("/api/articles/:id", ...requireSignedIn, async (req, res) => {
    try {
      const article = await articleStorage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ error: "記事が見つかりません" });
      }
      res.json(article);
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ error: "記事の取得に失敗しました" });
    }
  });

  app.post("/api/articles", ...requireAdmin, async (req, res) => {
    const parsed = insertArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "無効なデータです", details: parsed.error });
    }
    try {
      if (!(await articleStorage.getCategory(parsed.data.categoryId))) {
        return res.status(404).json({ error: "記事カテゴリが見つかりません" });
      }
      res.status(201).json(await articleStorage.createArticle(parsed.data));
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: "記事の作成に失敗しました" });
    }
  });

  app.patch<{ id: string }>("/api/articles/:id", ...requireAdmin, async (req, res) => {
    const parsed = updateArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "無効なデータです", details: parsed.error });
    }
    try {
      const article = await articleStorage.updateArticle(req.params.id, parsed.data);
      if (!article) {
        return res.status(404).json({ error: "記事が見つかりません" });
      }
      res.json(article);
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: "記事の更新に失敗しました" });
    }
  });

  app.delete<{ id: string }>("/api/articles/:id", ...requireAdmin, async (req, res) => {
    try {
      await articleStorage.deleteArticle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "記事の削除に失敗しました" });
    }
  });
}
