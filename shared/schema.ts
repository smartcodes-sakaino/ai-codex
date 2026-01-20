import { z } from "zod";

// Chapter schema
export const chapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  genre: z.string(),
  icon: z.string().optional(),
  order: z.number(),
  createdAt: z.string(),
});

export const insertChapterSchema = chapterSchema.omit({ id: true, createdAt: true });

export type Chapter = z.infer<typeof chapterSchema>;
export type InsertChapter = z.infer<typeof insertChapterSchema>;

// Problem schema
export const problemSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  title: z.string(),
  order: z.number(),
  createdAt: z.string(),
});

export const insertProblemSchema = problemSchema.omit({ id: true, createdAt: true });

export type Problem = z.infer<typeof problemSchema>;
export type InsertProblem = z.infer<typeof insertProblemSchema>;

// Block types
export const blockTypeSchema = z.enum(["problem", "code", "text"]);
export type BlockType = z.infer<typeof blockTypeSchema>;

// Problem block
export const problemBlockContentSchema = z.object({
  text: z.string(),
  images: z.array(z.string()),
  videoUrl: z.string().optional(),
});

// Code block
export const codeBlockContentSchema = z.object({
  code: z.string(),
  language: z.string(),
});

// Text block
export const textBlockContentSchema = z.object({
  text: z.string(),
});

// Union of all block content types
export const blockContentSchema = z.union([
  problemBlockContentSchema,
  codeBlockContentSchema,
  textBlockContentSchema,
]);

// Block schema
export const blockSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  type: blockTypeSchema,
  content: blockContentSchema,
  order: z.number(),
});

export const insertBlockSchema = blockSchema.omit({ id: true });

export type Block = z.infer<typeof blockSchema>;
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type ProblemBlockContent = z.infer<typeof problemBlockContentSchema>;
export type CodeBlockContent = z.infer<typeof codeBlockContentSchema>;
export type TextBlockContent = z.infer<typeof textBlockContentSchema>;

// App settings
export const settingsSchema = z.object({
  geminiApiKey: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

// API response types
export interface ChapterWithCount extends Chapter {
  problemCount: number;
}

export interface ProblemWithBlocks extends Problem {
  blocks: Block[];
  hasExplanation: boolean;
}
