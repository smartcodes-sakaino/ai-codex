import {
  chapters,
  problems,
  blocks,
  prompts,
  selfReviewLinks,
  type Chapter,
  type InsertChapter,
  type Problem,
  type InsertProblem,
  type Block,
  type InsertBlock,
  type Prompt,
  type InsertPrompt,
  type SelfReviewLink,
  type InsertSelfReviewLink,
  type ChapterWithCount,
  type ProblemWithStatus,
  type ProblemWithBlocks,
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Chapters
  getChapters(): Promise<ChapterWithCount[]>;
  getChapter(id: string): Promise<Chapter | undefined>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, data: Partial<InsertChapter>): Promise<Chapter | undefined>;
  deleteChapter(id: string): Promise<void>;
  reorderChapters(orderedIds: string[]): Promise<void>;
  getGenres(): Promise<string[]>;

  // Problems
  getProblems(chapterId: string): Promise<ProblemWithStatus[]>;
  getProblem(id: string): Promise<Problem | undefined>;
  createProblem(problem: InsertProblem): Promise<Problem>;
  updateProblem(id: string, data: Partial<InsertProblem>): Promise<Problem | undefined>;
  deleteProblem(id: string): Promise<void>;
  reorderProblems(orderedIds: string[]): Promise<void>;

  // Blocks
  getBlocks(problemId: string): Promise<Block[]>;
  getBlock(id: string): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  updateBlock(id: string, data: Partial<InsertBlock>): Promise<Block | undefined>;
  deleteBlock(id: string): Promise<void>;
  reorderBlocks(orderedIds: string[]): Promise<void>;

  // Combined
  getProblemWithBlocks(problemId: string): Promise<ProblemWithBlocks | undefined>;

  // Prompts
  getPrompts(): Promise<Prompt[]>;
  getPrompt(id: string): Promise<Prompt | undefined>;
  upsertPrompt(prompt: InsertPrompt): Promise<Prompt>;

  // Self Review Links
  getSelfReviewLinkByProblemId(problemId: string): Promise<SelfReviewLink | undefined>;
  getSelfReviewLinkByToken(token: string): Promise<SelfReviewLink | undefined>;
  createSelfReviewLink(data: InsertSelfReviewLink): Promise<SelfReviewLink>;
}

export class DatabaseStorage implements IStorage {
  // ============================================
  // Chapters
  // ============================================

  async getChapters(): Promise<ChapterWithCount[]> {
    const result = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        genre: chapters.genre,
        icon: chapters.icon,
        colorIndex: chapters.colorIndex,
        order: chapters.order,
        createdAt: chapters.createdAt,
        problemCount: sql<number>`cast(count(${problems.id}) as int)`,
      })
      .from(chapters)
      .leftJoin(problems, eq(chapters.id, problems.chapterId))
      .groupBy(chapters.id)
      .orderBy(asc(chapters.order));

    return result.map((r) => ({
      ...r,
      problemCount: r.problemCount || 0,
    }));
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter || undefined;
  }

  async createChapter(chapter: InsertChapter): Promise<Chapter> {
    const id = randomUUID();
    const [created] = await db
      .insert(chapters)
      .values({ ...chapter, id })
      .returning();
    return created;
  }

  async updateChapter(id: string, data: Partial<InsertChapter>): Promise<Chapter | undefined> {
    const [updated] = await db
      .update(chapters)
      .set(data)
      .where(eq(chapters.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteChapter(id: string): Promise<void> {
    await db.delete(chapters).where(eq(chapters.id, id));
  }

  async reorderChapters(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(chapters).set({ order: i }).where(eq(chapters.id, orderedIds[i]));
    }
  }

  async getGenres(): Promise<string[]> {
    const result = await db
      .selectDistinct({ genre: chapters.genre })
      .from(chapters)
      .where(sql`${chapters.genre} != ''`);
    return result.map((r) => r.genre);
  }

  // ============================================
  // Problems
  // ============================================

  async getProblems(chapterId: string): Promise<ProblemWithStatus[]> {
    const problemList = await db
      .select()
      .from(problems)
      .where(eq(problems.chapterId, chapterId))
      .orderBy(asc(problems.order));
    
    const result: ProblemWithStatus[] = [];
    for (const problem of problemList) {
      const problemBlocks = await db
        .select()
        .from(blocks)
        .where(eq(blocks.problemId, problem.id));
      
      const hasExplanation = problemBlocks.some((block) => {
        if (block.type === "text") {
          const content = block.content as { text?: string };
          return content.text && content.text.trim().length > 0;
        }
        return false;
      });
      
      result.push({ ...problem, hasExplanation });
    }
    return result;
  }

  async getProblem(id: string): Promise<Problem | undefined> {
    const [problem] = await db.select().from(problems).where(eq(problems.id, id));
    return problem || undefined;
  }

  async createProblem(problem: InsertProblem): Promise<Problem> {
    const id = randomUUID();
    const [created] = await db
      .insert(problems)
      .values({ ...problem, id })
      .returning();
    return created;
  }

  async updateProblem(id: string, data: Partial<InsertProblem>): Promise<Problem | undefined> {
    const [updated] = await db
      .update(problems)
      .set(data)
      .where(eq(problems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProblem(id: string): Promise<void> {
    await db.delete(problems).where(eq(problems.id, id));
  }

  async reorderProblems(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(problems).set({ order: i }).where(eq(problems.id, orderedIds[i]));
    }
  }

  // ============================================
  // Blocks
  // ============================================

  async getBlocks(problemId: string): Promise<Block[]> {
    return await db
      .select()
      .from(blocks)
      .where(eq(blocks.problemId, problemId))
      .orderBy(asc(blocks.order));
  }

  async getBlock(id: string): Promise<Block | undefined> {
    const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
    return block || undefined;
  }

  async createBlock(block: InsertBlock): Promise<Block> {
    const id = randomUUID();
    const [created] = await db
      .insert(blocks)
      .values({ ...block, id })
      .returning();
    return created;
  }

  async updateBlock(id: string, data: Partial<InsertBlock>): Promise<Block | undefined> {
    const [updated] = await db
      .update(blocks)
      .set(data)
      .where(eq(blocks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBlock(id: string): Promise<void> {
    await db.delete(blocks).where(eq(blocks.id, id));
  }

  async reorderBlocks(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(blocks).set({ order: i }).where(eq(blocks.id, orderedIds[i]));
    }
  }

  // ============================================
  // Combined
  // ============================================

  async getProblemWithBlocks(problemId: string): Promise<ProblemWithBlocks | undefined> {
    const problem = await this.getProblem(problemId);
    if (!problem) return undefined;

    const problemBlocks = await this.getBlocks(problemId);
    const hasExplanation = problemBlocks.some((b) => b.type === "text");

    return {
      ...problem,
      blocks: problemBlocks,
      hasExplanation,
    };
  }

  // ============================================
  // Prompts
  // ============================================

  async getPrompts(): Promise<Prompt[]> {
    return await db.select().from(prompts);
  }

  async getPrompt(id: string): Promise<Prompt | undefined> {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id));
    return prompt || undefined;
  }

  async upsertPrompt(prompt: InsertPrompt): Promise<Prompt> {
    const existing = await this.getPrompt(prompt.id);
    if (existing) {
      const [updated] = await db
        .update(prompts)
        .set({ ...prompt, updatedAt: new Date() })
        .where(eq(prompts.id, prompt.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(prompts)
        .values(prompt)
        .returning();
      return created;
    }
  }

  // ============================================
  // Self Review Links
  // ============================================

  async getSelfReviewLinkByProblemId(problemId: string): Promise<SelfReviewLink | undefined> {
    const [link] = await db.select().from(selfReviewLinks).where(eq(selfReviewLinks.problemId, problemId));
    return link || undefined;
  }

  async getSelfReviewLinkByToken(token: string): Promise<SelfReviewLink | undefined> {
    const [link] = await db.select().from(selfReviewLinks).where(eq(selfReviewLinks.token, token));
    return link || undefined;
  }

  async createSelfReviewLink(data: InsertSelfReviewLink): Promise<SelfReviewLink> {
    const id = randomUUID();
    const [created] = await db
      .insert(selfReviewLinks)
      .values({ ...data, id })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
