import type { Express, Request, Response } from "express";
import {
  insertUserSchema,
  updateUserSchema,
  insertGroupSchema,
  insertCourseSchema,
  insertSettingsSchema,
  loginSchema,
  submitAnswerSchema,
  updateVideoProgressSchema,
} from "@shared/schema";
import { lmsStorage } from "./storage";
import { hashPassword, verifyPassword, generateTempPassword, requireAuth, requireRole, type AuthedRequest } from "./auth";
import { getRoadmap, getCourseProgress, assertProblemIsCurrent } from "./roadmap";
import { runLmsCheck, AiUnavailableError } from "./aiCheck";
import { issueCertificateIfNeeded, objectStorageService } from "./certificate";
import { exportCourseProgress } from "./export";
import { storage } from "../storage";

export function registerLmsRoutes(app: Express): void {
  const requireAdmin = [requireAuth, requireRole("admin")] as const;
  const requireLearner = [requireAuth, requireRole("learner")] as const;

  // ============================================
  // Auth
  // ============================================

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "入力が無効です" });
    }
    const user = await lmsStorage.getUserByEmail(parsed.data.email);
    const genericError = { error: "メールアドレスまたはパスワードが正しくありません" };
    if (!user) {
      return res.status(401).json(genericError);
    }
    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json(genericError);
    }
    req.session.userId = user.id;
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.status(204).send();
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
  });

  // ============================================
  // Admin: Users
  // ============================================

  app.get("/api/admin/users", ...requireAdmin, async (_req, res) => {
    res.json(await lmsStorage.getUsers());
  });

  app.post("/api/admin/users", ...requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
    }
    const existing = await lmsStorage.getUserByEmail(parsed.data.email);
    if (existing) {
      return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = await lmsStorage.createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: "learner",
      passwordHash,
      tempPassword,
      groupIds: parsed.data.groupIds,
    });
    res.status(201).json({ ...user, groupIds: parsed.data.groupIds });
  });

  app.post<{ id: string }>("/api/admin/users/:id/regenerate-password", ...requireAdmin, async (req: Request, res: Response) => {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const updated = await lmsStorage.regeneratePassword((req.params.id as string), passwordHash, tempPassword);
    if (!updated) {
      return res.status(404).json({ error: "ユーザーが見つかりません" });
    }
    res.json(updated);
  });

  app.patch<{ id: string }>("/api/admin/users/:id", ...requireAdmin, async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
    }
    const userId = req.params.id as string;

    if (parsed.data.email) {
      const existing = await lmsStorage.getUserByEmail(parsed.data.email);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
      }
    }

    const updated = await lmsStorage.updateUser(userId, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: "ユーザーが見つかりません" });
    }
    res.json(updated);
  });

  // ============================================
  // Admin: Groups
  // ============================================

  app.get("/api/admin/groups", ...requireAdmin, async (_req, res) => {
    res.json(await lmsStorage.getGroups());
  });

  app.post("/api/admin/groups", ...requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
    }
    res.status(201).json(await lmsStorage.createGroup(parsed.data.name));
  });

  app.delete<{ id: string }>("/api/admin/groups/:id", ...requireAdmin, async (req: Request, res: Response) => {
    await lmsStorage.deleteGroup((req.params.id as string));
    res.status(204).send();
  });

  // ============================================
  // Admin: Courses
  // ============================================

  app.get("/api/admin/courses", ...requireAdmin, async (_req, res) => {
    res.json(await lmsStorage.getCourses());
  });

  app.post("/api/admin/courses", ...requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
    }
    const course = await lmsStorage.createCourse(parsed.data);
    res.status(201).json(course);
  });

  app.get<{ id: string }>("/api/admin/courses/:id", ...requireAdmin, async (req: Request, res: Response) => {
    const course = await lmsStorage.getCourse((req.params.id as string));
    if (!course) {
      return res.status(404).json({ error: "コースが見つかりません" });
    }
    res.json(course);
  });

  app.delete<{ id: string }>("/api/admin/courses/:id", ...requireAdmin, async (req: Request, res: Response) => {
    await lmsStorage.deleteCourse((req.params.id as string));
    res.status(204).send();
  });

  // ============================================
  // Admin: Progress
  // ============================================

  app.get<{ id: string }>("/api/admin/courses/:id/progress", ...requireAdmin, async (req: Request, res: Response) => {
    const course = await lmsStorage.getCourse((req.params.id as string));
    if (!course) {
      return res.status(404).json({ error: "コースが見つかりません" });
    }
    const learners = await lmsStorage.usersForCourse(course.id);
    const summaries = await Promise.all(
      learners.map(async (u) => {
        const progress = await getCourseProgress(u.id, course.id);
        return { userId: u.id, name: u.name, email: u.email, ...progress };
      })
    );
    res.json(summaries);
  });

  app.get<{ id: string; userId: string }>("/api/admin/courses/:id/progress/:userId", ...requireAdmin, async (req: Request, res: Response) => {
    const roadmap = await getRoadmap((req.params.userId as string), (req.params.id as string));
    const details = await Promise.all(
      roadmap.map(async (item) => ({
        ...item,
        submissions: await lmsStorage.getSubmissionsFor((req.params.userId as string), (req.params.id as string), item.problemId),
      }))
    );
    res.json(details);
  });

  app.post<{ id: string }>("/api/admin/courses/:id/export", ...requireAdmin, async (req: Request, res: Response) => {
    try {
      const course = await lmsStorage.getCourse((req.params.id as string));
      if (!course) {
        return res.status(404).json({ error: "コースが見つかりません" });
      }
      const result = await exportCourseProgress(course);
      res.json(result);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "エクスポートに失敗しました。Google Sheets APIが有効化・権限設定されているか確認してください" });
    }
  });

  // ============================================
  // Admin: Settings
  // ============================================

  app.get("/api/admin/settings", ...requireAdmin, async (_req, res) => {
    res.json(await lmsStorage.getSettings());
  });

  app.patch("/api/admin/settings", ...requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "入力が無効です" });
    }
    res.json(await lmsStorage.updateSettings(parsed.data));
  });

  // ============================================
  // Learner: My courses / roadmap / submissions / certificate
  // ============================================

  app.get("/api/my/courses", ...requireLearner, async (req: AuthedRequest, res: Response) => {
    const courses = await lmsStorage.coursesForUser(req.user!.id);
    const withProgress = await Promise.all(
      courses.map(async (c) => ({ ...c, progress: await getCourseProgress(req.user!.id, c.id) }))
    );
    res.json(withProgress);
  });

  app.get<{ id: string }>("/api/my/courses/:id/roadmap", ...requireLearner, async (req: AuthedRequest, res: Response) => {
    res.json(await getRoadmap(req.user!.id, (req.params.id as string)));
  });

  app.get<{ id: string; problemId: string }>(
    "/api/my/courses/:id/problems/:problemId/submissions",
    ...requireLearner,
    async (req: AuthedRequest, res: Response) => {
      res.json(await lmsStorage.getSubmissionsFor(req.user!.id, (req.params.id as string), (req.params.problemId as string)));
    }
  );

  app.post<{ id: string; problemId: string }>(
    "/api/my/courses/:id/problems/:problemId/submissions",
    ...requireLearner,
    async (req: AuthedRequest, res: Response) => {
      const parsed = submitAnswerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
      }

      const { id: courseId, problemId } = req.params as { id: string; problemId: string };
      const userId = req.user!.id;

      try {
        await assertProblemIsCurrent(userId, courseId, problemId);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      const problem = await storage.getProblem(problemId);
      if (!problem) {
        return res.status(404).json({ error: "問題が見つかりません" });
      }
      const problemWithBlocks = await storage.getProblemWithBlocks(problemId);
      const description =
        problemWithBlocks?.blocks
          .filter((b) => b.type === "problem" || b.type === "video")
          .map((b) => (b.type === "video" ? (b.content as any).description : (b.content as any).text))
          .filter(Boolean)
          .join("\n\n") || "";

      let result;
      try {
        result = await runLmsCheck(problem.title, description, parsed.data.code);
      } catch (error) {
        if (error instanceof AiUnavailableError) {
          return res.status(502).json({ error: error.message });
        }
        throw error;
      }

      await lmsStorage.createSubmission({
        userId,
        courseId,
        problemId,
        code: parsed.data.code,
        verdict: result.verdict,
        aiSummary: result.summary,
        aiGood: result.good,
        aiImprove: result.improve,
        aiMustFix: result.mustFix,
      });

      let certificateIssued = false;
      if (result.verdict === "pass") {
        const progress = await getCourseProgress(userId, courseId);
        if (progress.complete) {
          const course = await lmsStorage.getCourse(courseId);
          if (course) {
            await issueCertificateIfNeeded(userId, courseId, course.title, req.user!.name);
            certificateIssued = true;
          }
        }
      }

      res.json({ ...result, certificateIssued });
    }
  );

  app.get<{ id: string }>("/api/my/courses/:id/certificate", ...requireLearner, async (req: AuthedRequest, res: Response) => {
    const cert = await lmsStorage.getCertificate(req.user!.id, (req.params.id as string));
    if (!cert) {
      return res.status(404).json({ error: "修了証はまだ発行されていません" });
    }
    res.json(cert);
  });

  app.get<{ blockId: string }>(
    "/api/my/video-progress/:blockId",
    ...requireLearner,
    async (req: AuthedRequest, res: Response) => {
      const progress = await lmsStorage.getVideoProgress(req.user!.id, (req.params.blockId as string));
      res.json({ positionSeconds: progress?.positionSeconds ?? 0 });
    }
  );

  app.put<{ blockId: string }>(
    "/api/my/video-progress/:blockId",
    ...requireLearner,
    async (req: AuthedRequest, res: Response) => {
      const parsed = updateVideoProgressSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が無効です" });
      }
      const progress = await lmsStorage.upsertVideoProgress(
        req.user!.id,
        (req.params.blockId as string),
        Math.floor(parsed.data.positionSeconds)
      );
      res.json({ positionSeconds: progress.positionSeconds });
    }
  );

  app.get<{ id: string }>("/api/my/certificates/:id/pdf", ...requireLearner, async (req: AuthedRequest, res: Response) => {
    const cert = await lmsStorage.getCertificateById((req.params.id as string));
    if (!cert || cert.userId !== req.user!.id) {
      return res.status(404).json({ error: "修了証が見つかりません" });
    }
    const fileId = await objectStorageService.getObjectEntityFile(cert.pdfObjectPath);
    await objectStorageService.downloadObject(fileId, res);
  });
}
