import { lmsStorage } from "./storage";
import type { ProblemStatus, RoadmapItem } from "@shared/schema";

export async function getRoadmap(userId: string, courseId: string): Promise<RoadmapItem[]> {
  const flat = await lmsStorage.flattenCourse(courseId);

  const passedFlags: boolean[] = [];
  for (const item of flat) {
    const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, item.problemId);
    passedFlags.push(attempts.some((a) => a.verdict === "pass"));
  }

  let currentIndex = passedFlags.findIndex((passed) => !passed);
  if (currentIndex === -1) currentIndex = flat.length;

  const result: RoadmapItem[] = [];
  for (let i = 0; i < flat.length; i++) {
    const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, flat[i].problemId);
    const status: ProblemStatus = passedFlags[i] ? "done" : i === currentIndex ? "current" : "locked";
    result.push({ ...flat[i], status, attempts: attempts.length });
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
