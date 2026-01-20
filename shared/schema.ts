import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ============================================
// Drizzle Table Definitions
// ============================================

// Chapters table
export const chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  genre: text("genre").notNull().default(""),
  icon: text("icon"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Problems table
export const problems = pgTable("problems", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Blocks table
export const blocks = pgTable("blocks", {
  id: text("id").primaryKey(),
  problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "problem" | "code" | "text"
  content: jsonb("content").notNull(),
  order: integer("order").notNull().default(0),
});

// ============================================
// Relations
// ============================================

export const chaptersRelations = relations(chapters, ({ many }) => ({
  problems: many(problems),
}));

export const problemsRelations = relations(problems, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [problems.chapterId],
    references: [chapters.id],
  }),
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  problem: one(problems, {
    fields: [blocks.problemId],
    references: [problems.id],
  }),
}));

// ============================================
// Zod Schemas and Types
// ============================================

// Insert schemas from Drizzle
export const insertChapterSchema = createInsertSchema(chapters).omit({ 
  id: true, 
  createdAt: true 
});

export const insertProblemSchema = createInsertSchema(problems).omit({ 
  id: true, 
  createdAt: true 
});

export const insertBlockSchema = createInsertSchema(blocks).omit({ 
  id: true 
});

// Block types
export const blockTypeSchema = z.enum(["problem", "code", "text"]);
export type BlockType = z.infer<typeof blockTypeSchema>;

// Problem block content
export const problemBlockContentSchema = z.object({
  text: z.string(),
  images: z.array(z.string()),
  videoUrl: z.string().optional(),
});

// Code block content
export const codeBlockContentSchema = z.object({
  code: z.string(),
  language: z.string(),
});

// Text block content
export const textBlockContentSchema = z.object({
  text: z.string(),
});

// Union of all block content types
export const blockContentSchema = z.union([
  problemBlockContentSchema,
  codeBlockContentSchema,
  textBlockContentSchema,
]);

// ============================================
// Types
// ============================================

export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;

export type Problem = typeof problems.$inferSelect;
export type InsertProblem = z.infer<typeof insertProblemSchema>;

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = z.infer<typeof insertBlockSchema>;

export type ProblemBlockContent = z.infer<typeof problemBlockContentSchema>;
export type CodeBlockContent = z.infer<typeof codeBlockContentSchema>;
export type TextBlockContent = z.infer<typeof textBlockContentSchema>;

// App settings (for local storage only)
export const settingsSchema = z.object({
  geminiApiKey: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

// API response types
export interface ChapterWithCount extends Chapter {
  problemCount: number;
}

export interface ProblemWithStatus extends Problem {
  hasExplanation: boolean;
}

export interface ProblemWithBlocks extends Problem {
  blocks: Block[];
  hasExplanation: boolean;
}
