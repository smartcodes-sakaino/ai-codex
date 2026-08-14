import { lmsStorage } from "./storage";
import { storage } from "../storage";
import { issueCertificateIfNeeded } from "./certificate";
import type { ProblemStatus, RoadmapItem, RoadmapGate as Gate } from "@shared/schema";

// What actually gates moving on to the next item, in priority order:
// a configured self-review link always wins (its verdict is the authoritative
// pass/fail once it exists), then a video block (must be watched to the end),
// and only plain problem/code content falls back to the original AI-graded
// code submission gate.
async function resolveGate(problemId: string): Promise<Gate> {
  const selfReviewLink = await storage.getSelfReviewLinkByProblemId(problemId);
  if (selfReviewLink) return "self_review";
  const blocks = await storage.getBlocks(problemId);
  if (blocks.some((b) => b.type === "video")) return "video";
  return "submission";
}

async function isPassed(userId: string, courseId: string, problemId: string, gate: Gate): Promise<boolean> {
  if (gate === "self_review") {
    const attempts = await lmsStorage.getSelfReviewSubmissionsFor(userId, problemId);
    return attempts.some((a) => a.verdict === "pass");
  }
  if (gate === "video") {
    const blocks = await storage.getBlocks(problemId);
    const videoBlocks = blocks.filter((b) => b.type === "video");
    if (videoBlocks.length === 0) return false;
    for (const block of videoBlocks) {
      const progress = await lmsStorage.getVideoProgress(userId, block.id);
      if (!progress?.completed) return false;
    }
    return true;
  }
  const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, problemId);
  return attempts.some((a) => a.verdict === "pass");
}

export async function getRoadmap(userId: string, courseId: string): Promise<RoadmapItem[]> {
  const flat = await lmsStorage.flattenCourse(courseId);

  const gates = await Promise.all(flat.map((item) => resolveGate(item.problemId)));
  const passedFlags = await Promise.all(
    flat.map((item, i) => isPassed(userId, courseId, item.problemId, gates[i]))
  );

  let currentIndex = passedFlags.findIndex((passed) => !passed);
  if (currentIndex === -1) currentIndex = flat.length;

  const result: RoadmapItem[] = [];
  for (let i = 0; i < flat.length; i++) {
    const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, flat[i].problemId);
    const status: ProblemStatus = passedFlags[i] ? "done" : i === currentIndex ? "current" : "locked";
    result.push({ ...flat[i], status, attempts: attempts.length, gate: gates[i] });
  }
  return result;
}

export async function getCourseProgress(userId: string, courseId: string) {
  const roadmap = await getRoadmap(userId, courseId);
  const passedCount = roadmap.filter((r) => r.status === "done").length;
  return {
    courseId,
    passedCount,
    total: roadmap.length,
    complete: roadmap.length > 0 && passedCount === roadmap.length,
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
