import { lmsStorage } from "./storage";
import { getCourseProgress } from "./roadmap";
import { isSlackConfigured, postSlackMessage } from "./slack";
import { toJstDate, todayJst, diffDays } from "./dates";
import type { User } from "@shared/schema";

/** A learner counts as stalled after this many days with no activity at all. */
export const STAGNATION_DAYS = 14;

export interface StagnationInfo {
  stagnant: boolean;
  /** "YYYY-MM-DD" (JST) of the last activity (or of the latest assignment / return from pend, if later). */
  lastActivityDate: string | null;
  lastActivityAt: Date | null;
  daysIdle: number | null;
}

// "Activity" is anything the learner did themselves. Being assigned a course
// or coming back from pend also resets the clock, so someone who just got
// their first course (or just resumed) isn't immediately flagged. Admins,
// disabled accounts and learners on pend are never monitored, and neither is
// anyone with nothing left to do (every assigned course complete).
export async function getStagnation(user: User): Promise<StagnationInfo> {
  const none: StagnationInfo = { stagnant: false, lastActivityDate: null, lastActivityAt: null, daysIdle: null };
  if (user.role !== "learner" || !user.isActive || user.learnerStatus === "pend") return none;

  const [activityAt, assignedAt] = await Promise.all([
    lmsStorage.getLastActivityAt(user.id),
    lmsStorage.getLatestAssignedAt(user.id),
  ]);
  if (!assignedAt) return none;
  const candidates = [activityAt, assignedAt, user.resumedAt].filter((d): d is Date => !!d);
  const lastActivityAt = new Date(Math.max(...candidates.map((d) => d.getTime())));
  const lastActivityDate = toJstDate(lastActivityAt);
  const daysIdle = diffDays(lastActivityDate, todayJst());
  if (daysIdle < STAGNATION_DAYS) return { stagnant: false, lastActivityDate, lastActivityAt, daysIdle };

  // Only checked once the cheap date test says "maybe" — progress is expensive.
  const courses = await lmsStorage.coursesForUser(user.id);
  for (const course of courses) {
    const progress = await getCourseProgress(user.id, course.id);
    if (!progress.complete) return { stagnant: true, lastActivityDate, lastActivityAt, daysIdle };
  }
  return { stagnant: false, lastActivityDate, lastActivityAt, daysIdle };
}

export async function countStagnantLearners(): Promise<number> {
  const users = await lmsStorage.getUsers();
  let count = 0;
  for (const u of users) {
    if ((await getStagnation(u)).stagnant) count++;
  }
  return count;
}

function formatMd(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

async function buildMessage(user: User, info: StagnationInfo): Promise<string> {
  const lines = [
    `:warning: 【学習停滞のお知らせ】${user.name} さんの学習が ${info.daysIdle}日間 止まっています（最終活動: ${formatMd(info.lastActivityDate!)}）`,
  ];
  const courses = await lmsStorage.coursesForUser(user.id);
  for (const course of courses) {
    const progress = await getCourseProgress(user.id, course.id);
    if (progress.complete || !progress.currentProblemTitle) continue;
    const due = progress.currentDueDate ? `（期限 ${formatMd(progress.currentDueDate)}）` : "";
    lines.push(`• ${course.title}: 「${progress.currentProblemTitle}」${due} ${progress.passedCount}/${progress.total}`);
  }
  return lines.join("\n");
}

export interface StagnationCheckResult {
  stagnant: number;
  notified: number;
  errors: { userId: string; error: string }[];
}

// Run nightly (00:00 JST) by the GitHub Actions workflow. Each stalled stretch
// alerts once: stagnationNotifiedAt is compared against the last activity, so
// a learner who picks things back up and then stalls again alerts again.
// Learners without a Slack channel are only surfaced by the in-app badge.
export async function runStagnationCheck(): Promise<StagnationCheckResult> {
  const result: StagnationCheckResult = { stagnant: 0, notified: 0, errors: [] };
  const users = await lmsStorage.getUsers();
  for (const user of users) {
    const info = await getStagnation(user);
    if (!info.stagnant) continue;
    result.stagnant++;
    if (!user.slackChannelId || !isSlackConfigured()) continue;
    if (user.stagnationNotifiedAt && info.lastActivityAt && user.stagnationNotifiedAt > info.lastActivityAt) continue;
    try {
      await postSlackMessage(user.slackChannelId, await buildMessage(user, info));
      await lmsStorage.setStagnationNotifiedAt(user.id, new Date());
      result.notified++;
    } catch (error: any) {
      console.error(`Stagnation Slack notify failed for ${user.id}:`, error);
      result.errors.push({ userId: user.id, error: error?.message ?? String(error) });
    }
  }
  return result;
}
