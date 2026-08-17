import { pgTable, text, integer, boolean, jsonb, timestamp, primaryKey, unique } from "drizzle-orm/pg-core";
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
  colorIndex: integer("color_index").notNull().default(0),
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

// AI Prompts table
export const prompts = pgTable("prompts", {
  id: text("id").primaryKey(), // "explanation" | "review" | "self_review"
  name: text("name").notNull(),
  template: text("template").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Self Review Links table
export const selfReviewLinks = pgTable("self_review_links", {
  id: text("id").primaryKey(),
  problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// LMS: Users / Groups / Courses / Submissions / Certificates / Settings
// ============================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tempPassword: text("temp_password"),
  name: text("name").notNull(),
  role: text("role").notNull().default("learner"), // "admin" | "learner"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userGroups = pgTable("user_groups", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);

export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courseChapters = pgTable("course_chapters", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  order: integer("order").notNull().default(0),
});

export const courseAssignments = pgTable("course_assignments", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // "user" | "group"
  targetId: text("target_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  verdict: text("verdict").notNull(), // "pass" | "fail"
  aiSummary: text("ai_summary").notNull().default(""),
  aiGood: text("ai_good"),
  aiImprove: text("ai_improve"),
  aiMustFix: text("ai_must_fix"),
  attemptNumber: integer("attempt_number").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  certificateNumber: text("certificate_number").notNull().unique(),
  pdfObjectPath: text("pdf_object_path").notNull(),
  companyNameSnapshot: text("company_name_snapshot").notNull(),
  issuerNameSnapshot: text("issuer_name_snapshot").notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.userId, table.courseId),
]);

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  companyName: text("company_name").notNull().default(""),
  issuerName: text("issuer_name").notNull().default(""),
  logoObjectPath: text("logo_object_path"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Per-learner watch position for video blocks, so playback can resume where they left off.
// `completed` is sticky (set once on reaching the end, never cleared) — it's what gates
// roadmap progress for e-learning items that have no self-review link configured.
export const videoProgress = pgTable("video_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockId: text("block_id").notNull().references(() => blocks.id, { onDelete: "cascade" }),
  positionSeconds: integer("position_seconds").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.userId, table.blockId),
]);

// Self Review Submissions table — only recorded when a logged-in learner submits
// through the in-app self-review flow (the anonymous, token-only external link
// never has a userId to attach one to, and isn't roadmap-gated anyway).
export const selfReviewSubmissions = pgTable("self_review_submissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  verdict: text("verdict").notNull(), // "pass" | "fail"
  review: text("review").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
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

export const selfReviewLinksRelations = relations(selfReviewLinks, ({ one }) => ({
  problem: one(problems, {
    fields: [selfReviewLinks.problemId],
    references: [problems.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userGroups: many(userGroups),
  submissions: many(submissions),
  certificates: many(certificates),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  userGroups: many(userGroups),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroups.groupId], references: [groups.id] }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  courseChapters: many(courseChapters),
  courseAssignments: many(courseAssignments),
  submissions: many(submissions),
  certificates: many(certificates),
}));

export const courseChaptersRelations = relations(courseChapters, ({ one }) => ({
  course: one(courses, { fields: [courseChapters.courseId], references: [courses.id] }),
  chapter: one(chapters, { fields: [courseChapters.chapterId], references: [chapters.id] }),
}));

export const courseAssignmentsRelations = relations(courseAssignments, ({ one }) => ({
  course: one(courses, { fields: [courseAssignments.courseId], references: [courses.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  user: one(users, { fields: [submissions.userId], references: [users.id] }),
  course: one(courses, { fields: [submissions.courseId], references: [courses.id] }),
  problem: one(problems, { fields: [submissions.problemId], references: [problems.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
}));

export const videoProgressRelations = relations(videoProgress, ({ one }) => ({
  user: one(users, { fields: [videoProgress.userId], references: [users.id] }),
  block: one(blocks, { fields: [videoProgress.blockId], references: [blocks.id] }),
}));

export const selfReviewSubmissionsRelations = relations(selfReviewSubmissions, ({ one }) => ({
  user: one(users, { fields: [selfReviewSubmissions.userId], references: [users.id] }),
  problem: one(problems, { fields: [selfReviewSubmissions.problemId], references: [problems.id] }),
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

export const insertPromptSchema = createInsertSchema(prompts).omit({
  updatedAt: true
});

export const insertSelfReviewLinkSchema = createInsertSchema(selfReviewLinks).omit({
  id: true,
  createdAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  tempPassword: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "氏名が必要です").max(200),
  email: z.string().email("有効なメールアドレスを入力してください"),
  groupIds: z.array(z.string()).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "氏名が必要です").max(200).optional(),
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
  groupIds: z.array(z.string()).optional(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "グループ名が必要です").max(200),
});

export const insertCourseSchema = z.object({
  title: z.string().min(1, "コース名が必要です").max(200),
  chapterIds: z.array(z.string()).min(1, "チャプターを1つ以上選択してください"),
  assignments: z.array(z.object({
    type: z.enum(["user", "group"]),
    id: z.string(),
  })).default([]),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const submitAnswerSchema = z.object({
  code: z.string().min(1, "コードを入力してください").max(200000, "コードが長すぎます"),
});

export const updateVideoProgressSchema = z.object({
  positionSeconds: z.number().min(0),
  completed: z.boolean().optional(),
});

export const submitSelfReviewSchema = z.object({
  token: z.string().min(1, "トークンが必要です"),
  reviewCode: z.string().min(1, "レビュー対象のコードが必要です").max(200000, "コードが長すぎます"),
});

// Block types
export const blockTypeSchema = z.enum(["problem", "code", "text", "video", "lesson", "file"]);
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

// Video block content (e-learning: video lesson + description)
export const videoBlockContentSchema = z.object({
  title: z.string(),
  videoObjectPath: z.string(),
  description: z.string(),
});

// Lesson block content (授業: Markdown lesson material, shown to learners)
export const lessonBlockContentSchema = z.object({
  title: z.string(),
  markdown: z.string(),
});

// File block content (ファイル: a downloadable attachment, e.g. a starter-code zip)
export const fileBlockContentSchema = z.object({
  title: z.string(),
  fileObjectPath: z.string(),
  fileName: z.string(),
});

// Union of all block content types
export const blockContentSchema = z.union([
  problemBlockContentSchema,
  codeBlockContentSchema,
  textBlockContentSchema,
  videoBlockContentSchema,
  lessonBlockContentSchema,
  fileBlockContentSchema,
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

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;

export type SelfReviewLink = typeof selfReviewLinks.$inferSelect;
export type InsertSelfReviewLink = z.infer<typeof insertSelfReviewLinkSchema>;

export type ProblemBlockContent = z.infer<typeof problemBlockContentSchema>;
export type CodeBlockContent = z.infer<typeof codeBlockContentSchema>;
export type TextBlockContent = z.infer<typeof textBlockContentSchema>;
export type VideoBlockContent = z.infer<typeof videoBlockContentSchema>;
export type LessonBlockContent = z.infer<typeof lessonBlockContentSchema>;
export type FileBlockContent = z.infer<typeof fileBlockContentSchema>;
export type AnyBlockContent =
  | ProblemBlockContent
  | CodeBlockContent
  | TextBlockContent
  | VideoBlockContent
  | LessonBlockContent
  | FileBlockContent;

// API response types
export interface ChapterWithCount extends Chapter {
  problemCount: number;
}

export interface ProblemWithStatus extends Problem {
  hasExplanation: boolean;
  /** Whether this problem has any lecture content (a lesson block or a video block). */
  hasLecture: boolean;
}

export interface ProblemWithBlocks extends Problem {
  blocks: Block[];
  hasExplanation: boolean;
  hasLecture: boolean;
}

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;

export type CourseChapter = typeof courseChapters.$inferSelect;
export type CourseAssignment = typeof courseAssignments.$inferSelect;

export type Submission = typeof submissions.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type VideoProgress = typeof videoProgress.$inferSelect;
export type SelfReviewSubmission = typeof selfReviewSubmissions.$inferSelect;

export type LoginInput = z.infer<typeof loginSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type UpdateVideoProgressInput = z.infer<typeof updateVideoProgressSchema>;
export type SubmitSelfReviewInput = z.infer<typeof submitSelfReviewSchema>;

export interface UserWithGroups extends User {
  groupIds: string[];
}

export interface CourseWithDetails extends Course {
  chapterIds: string[];
  assignments: { type: "user" | "group"; id: string }[];
}

export type ProblemStatus = "done" | "current" | "locked";

// What actually needs to happen to unlock the next item: passing a self-review
// (if one is configured), watching an e-learning video to the end (if there's no
// self-review), or otherwise the original AI-graded code submission.
export type RoadmapGate = "self_review" | "video" | "submission";

export interface RoadmapItem {
  chapterId: string;
  chapterTitle: string;
  problemId: string;
  problemTitle: string;
  status: ProblemStatus;
  attempts: number;
  gate: RoadmapGate;
  /** Whether this problem has a lesson or video block (shown as a neutral content-type cue, not a warning). */
  hasLecture: boolean;
  /** True when the gating video has been started but not yet finished, for a "視聴中" cue on the current item. */
  videoStarted: boolean;
}

export interface CourseProgressSummary {
  courseId: string;
  passedCount: number;
  total: number;
  complete: boolean;
}
