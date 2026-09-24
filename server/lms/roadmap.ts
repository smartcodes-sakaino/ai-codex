import { lmsStorage } from "./storage";
import { storage } from "../storage";
import { issueCertificateIfNeeded } from "./certificate";
import { toJstDate, addDays, maxDate } from "./dates";
import type { ProblemStatus, RoadmapItem, RoadmapGate as Gate } from "@shared/schema";

interface ProblemMeta {
  gate: Gate;
  hasLecture: boolean;
  videoBlockIds: string[];
}

// What actually gates moving on to the next item, in priority order:
// a configured self-review link always wins (its verdict is the authoritative
// pass/fail once it exists), then a video block (must be watched to the end),
// and only plain problem/code content falls back to the original AI-graded
// code submission gate. Also captures whether the problem has any lecture
// content (a lesson or video block) — a neutral content-type cue, not part
// of gating — computed here too since it needs the same block list.
async function resolveProblemMeta(problemId: string): Promise<ProblemMeta> {
  const [selfReviewLink, blocks] = await Promise.all([
    storage.getSelfReviewLinkByProblemId(problemId),
    storage.getBlocks(problemId),
  ]);
  const videoBlockIds = blocks.filter((b) => b.type === "video").map((b) => b.id);
  const hasLecture = blocks.some((b) => b.type === "lesson" || b.type === "video");
  const gate: Gate = selfReviewLink ? "self_review" : videoBlockIds.length > 0 ? "video" : "submission";
  return { gate, hasLecture, videoBlockIds };
}

// When the learner cleared this problem, or null if they haven't yet. The
// time comes from the passing record itself, so the due-date bookkeeping below
// can use it even when it only notices the pass later.
async function getPassedAt(userId: string, courseId: string, problemId: string, meta: ProblemMeta): Promise<Date | null> {
  if (meta.gate === "self_review") {
    const attempts = await lmsStorage.getSelfReviewSubmissionsFor(userId, problemId);
    return attempts.find((a) => a.verdict === "pass")?.submittedAt ?? null;
  }
  if (meta.gate === "video") {
    if (meta.videoBlockIds.length === 0) return null;
    let latest: Date | null = null;
    for (const blockId of meta.videoBlockIds) {
      const progress = await lmsStorage.getVideoProgress(userId, blockId);
      if (!progress?.completed) return null;
      if (!latest || progress.updatedAt > latest) latest = progress.updatedAt;
    }
    return latest;
  }
  const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, problemId);
  return attempts.find((a) => a.verdict === "pass")?.submittedAt ?? null;
}

// True once any gating video has been watched partway but not finished — a
// lightweight "視聴中" cue on the roadmap, distinct from "not started yet".
async function isVideoStarted(userId: string, meta: ProblemMeta): Promise<boolean> {
  if (meta.gate !== "video") return false;
  for (const blockId of meta.videoBlockIds) {
    const progress = await lmsStorage.getVideoProgress(userId, blockId);
    if (progress && progress.positionSeconds > 0 && !progress.completed) return true;
  }
  return false;
}

// The instructor-facing "admin view" shows every problem in a course
// unlocked and ungated — there's no per-user pass state to compute, just the
// same gate/hasLecture metadata the real roadmap uses to explain what a
// learner would need to do.
export interface AdminViewRoadmapItem {
  chapterId: string;
  chapterTitle: string;
  problemId: string;
  problemTitle: string;
  gate: Gate;
  hasLecture: boolean;
}

export async function getAdminViewRoadmap(courseId: string): Promise<AdminViewRoadmapItem[]> {
  const flat = await lmsStorage.flattenCourse(courseId);
  const metas = await Promise.all(flat.map((item) => resolveProblemMeta(item.problemId)));
  return flat.map((item, i) => ({
    ...item,
    gate: metas[i].gate,
    hasLecture: metas[i].hasLecture,
  }));
}

// Due dates: each problem is due estimatedHours calendar days after the day
// the previous one was cleared (the first one counts from the day the course
// was assigned). A learner on "pend" gets no due date; one who has come back
// from pend has the current problem's clock restart from that day.
export async function getRoadmap(userId: string, courseId: string): Promise<RoadmapItem[]> {
  const [flat, user, completions, assignedAt] = await Promise.all([
    lmsStorage.flattenCourse(courseId),
    lmsStorage.getUserById(userId),
    lmsStorage.getCompletionsFor(userId, courseId),
    lmsStorage.getAssignedAt(userId, courseId),
  ]);
  const onPend = user?.learnerStatus === "pend";
  const resumedAt = user?.resumedAt ?? null;
  const completionByProblem = new Map(completions.map((c) => [c.problemId, c]));

  const metas = await Promise.all(flat.map((item) => resolveProblemMeta(item.problemId)));
  const passedAts = await Promise.all(
    flat.map((item, i) => getPassedAt(userId, courseId, item.problemId, metas[i]))
  );

  let currentIndex = passedAts.findIndex((at) => !at);
  if (currentIndex === -1) currentIndex = flat.length;

  let prevDate = toJstDate(assignedAt ?? user?.createdAt ?? new Date());
  const result: RoadmapItem[] = [];
  for (let i = 0; i < flat.length; i++) {
    const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, flat[i].problemId);
    const passedAt = passedAts[i];
    const status: ProblemStatus = passedAt ? "done" : i === currentIndex ? "current" : "locked";
    // Only the current item's watch-in-progress state is useful to show — a
    // locked item can't be watched yet, and a done one no longer needs it.
    const videoStarted = status === "current" ? await isVideoStarted(userId, metas[i]) : false;

    let dueDate: string | null = null;
    let completedDate: string | null = null;
    let onTime: boolean | null = null;
    if (passedAt) {
      let record = completionByProblem.get(flat[i].problemId);
      if (!record) {
        // First time this pass is seen: freeze the due date that applied and
        // whether it was met, so later changes (estimated hours, pend) don't
        // rewrite history.
        const resumedBeforePass = resumedAt && resumedAt <= passedAt ? toJstDate(resumedAt) : null;
        const due = onPend ? null : addDays(maxDate(prevDate, resumedBeforePass), flat[i].estimatedHours);
        const done = toJstDate(passedAt);
        const data = {
          userId,
          courseId,
          problemId: flat[i].problemId,
          dueDate: due,
          completedAt: passedAt,
          onTime: due ? done <= due : null,
        };
        await lmsStorage.createCompletion(data);
        record = { id: "", ...data };
      }
      dueDate = record.dueDate;
      completedDate = toJstDate(record.completedAt);
      onTime = record.onTime;
      prevDate = completedDate;
    } else if (status === "current" && !onPend) {
      const resumedDate = resumedAt ? toJstDate(resumedAt) : null;
      dueDate = addDays(maxDate(prevDate, resumedDate), flat[i].estimatedHours);
    }

    result.push({
      ...flat[i],
      status,
      attempts: attempts.length,
      gate: metas[i].gate,
      hasLecture: metas[i].hasLecture,
      videoStarted,
      dueDate,
      completedDate,
      onTime,
    });
  }
  return result;
}

export async function getCourseProgress(userId: string, courseId: string) {
  const roadmap = await getRoadmap(userId, courseId);
  const passedCount = roadmap.filter((r) => r.status === "done").length;
  const current = roadmap.find((r) => r.status === "current");
  return {
    courseId,
    passedCount,
    total: roadmap.length,
    complete: roadmap.length > 0 && passedCount === roadmap.length,
    currentProblemTitle: current?.problemTitle ?? null,
    currentDueDate: current?.dueDate ?? null,
  };
}

/** Throws if the given problem is not currently solvable (locked or not part of the course). */
export async function assertProblemIsCurrent(userId: string, courseId: string, problemId: string): Promise<void> {
  const roadmap = await getRoadmap(userId, courseId);
  const item = roadmap.find((r) => r.problemId === problemId);
  if (!item || item.status === "locked") {
    throw new Error("まだ挑戦できない問題です");
  }
}

// Passing a problem can complete a course through any of the three gates (a code
// submission, a video watch-through, or a self-review) — not just the submission
// endpoint that historically triggered certificate issuance. A problem can also
// belong to more than one course, so every course the learner is enrolled in that
// contains it needs to be checked, not just one fixed courseId.
export async function checkAndIssueCertificatesForProblem(
  userId: string,
  problemId: string,
  userName: string
): Promise<void> {
  const problem = await storage.getProblem(problemId);
  if (!problem) return;

  const enrolledCourses = await lmsStorage.coursesForUser(userId);
  const relevantCourses = enrolledCourses.filter((c) => c.chapterIds.includes(problem.chapterId));

  for (const course of relevantCourses) {
    const progress = await getCourseProgress(userId, course.id);
    if (progress.complete) {
      await issueCertificateIfNeeded(userId, course.id, course.title, userName);
    }
  }
}
