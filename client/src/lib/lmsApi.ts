import { apiRequest } from "./queryClient";

// ============================================
// Types (kept local — the server response shapes are additive to shared/schema)
// ============================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "learner";
  mustChangePassword: boolean;
}

export interface LmsUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "learner";
  tempPassword: string | null;
  groupIds: string[];
  createdAt: string;
}

export interface LmsGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface LmsCourse {
  id: string;
  title: string;
  createdAt: string;
  chapterIds: string[];
  assignments: { type: "user" | "group"; id: string }[];
}

export interface LmsCourseWithProgress extends LmsCourse {
  progress: { courseId: string; passedCount: number; total: number; complete: boolean };
}

export type ProblemStatus = "done" | "current" | "locked";
export type RoadmapGate = "self_review" | "video" | "submission";

export interface RoadmapItem {
  chapterId: string;
  chapterTitle: string;
  problemId: string;
  problemTitle: string;
  status: ProblemStatus;
  attempts: number;
  gate: RoadmapGate;
  hasLecture: boolean;
  videoStarted: boolean;
}

export interface SubmissionResult {
  verdict: "pass" | "fail";
  summary: string;
  good: string;
  improve: string;
  mustFix: string;
  certificateIssued: boolean;
}

export interface Submission {
  id: string;
  code: string;
  verdict: "pass" | "fail";
  aiSummary: string;
  aiGood: string | null;
  aiImprove: string | null;
  aiMustFix: string | null;
  attemptNumber: number;
  submittedAt: string;
}

export interface ProgressSummaryRow {
  userId: string;
  name: string;
  email: string;
  courseId: string;
  passedCount: number;
  total: number;
  complete: boolean;
}

export interface LmsSettings {
  id: string;
  companyName: string;
  issuerName: string;
  logoObjectPath: string | null;
  updatedAt: string;
}

// ============================================
// Auth
// ============================================

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  return res.json();
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
  return res.json();
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch current user");
  return res.json();
}

// ============================================
// Admin: Users
// ============================================

export async function fetchUsers(): Promise<LmsUser[]> {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function createUser(data: { name: string; email: string; groupIds: string[] }): Promise<LmsUser> {
  const res = await apiRequest("POST", "/api/admin/users", data);
  return res.json();
}

export async function regenerateUserPassword(id: string): Promise<LmsUser> {
  const res = await apiRequest("POST", `/api/admin/users/${id}/regenerate-password`);
  return res.json();
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; groupIds?: string[] }
): Promise<LmsUser> {
  const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
  return res.json();
}

// ============================================
// Admin: Groups
// ============================================

export async function fetchGroupsLms(): Promise<LmsGroup[]> {
  const res = await fetch("/api/admin/groups", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

export async function createGroupLms(name: string): Promise<LmsGroup> {
  const res = await apiRequest("POST", "/api/admin/groups", { name });
  return res.json();
}

export async function deleteGroupLms(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/groups/${id}`);
}

// ============================================
// Admin: Courses
// ============================================

export async function fetchAdminCourses(): Promise<LmsCourse[]> {
  const res = await fetch("/api/admin/courses", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export async function createCourseLms(data: {
  title: string;
  chapterIds: string[];
  assignments: { type: "user" | "group"; id: string }[];
}): Promise<LmsCourse> {
  const res = await apiRequest("POST", "/api/admin/courses", data);
  return res.json();
}

export async function updateCourseLms(
  id: string,
  data: {
    title: string;
    chapterIds: string[];
    assignments: { type: "user" | "group"; id: string }[];
  }
): Promise<LmsCourse> {
  const res = await apiRequest("PATCH", `/api/admin/courses/${id}`, data);
  return res.json();
}

export async function deleteCourseLms(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/courses/${id}`);
}

// ============================================
// Admin: Progress / Export
// ============================================

export async function fetchCourseProgress(courseId: string): Promise<ProgressSummaryRow[]> {
  const res = await fetch(`/api/admin/courses/${courseId}/progress`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch progress");
  return res.json();
}

export interface ProgressDetailItem extends RoadmapItem {
  submissions: Submission[];
}

export async function fetchCourseProgressDetail(courseId: string, userId: string): Promise<ProgressDetailItem[]> {
  const res = await fetch(`/api/admin/courses/${courseId}/progress/${userId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch progress detail");
  return res.json();
}

export async function exportCourseProgressSheet(courseId: string): Promise<{ url: string; fileName: string }> {
  const res = await apiRequest("POST", `/api/admin/courses/${courseId}/export`);
  return res.json();
}

// ============================================
// Admin: Settings
// ============================================

export async function fetchLmsSettings(): Promise<LmsSettings> {
  const res = await fetch("/api/admin/settings", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateLmsSettings(data: {
  companyName?: string;
  issuerName?: string;
  logoObjectPath?: string | null;
}): Promise<LmsSettings> {
  const res = await apiRequest("PATCH", "/api/admin/settings", data);
  return res.json();
}

// ============================================
// Learner
// ============================================

export async function fetchMyCourses(): Promise<LmsCourseWithProgress[]> {
  const res = await fetch("/api/my/courses", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export async function fetchMyRoadmap(courseId: string): Promise<RoadmapItem[]> {
  const res = await fetch(`/api/my/courses/${courseId}/roadmap`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch roadmap");
  return res.json();
}

export async function fetchMySubmissions(courseId: string, problemId: string): Promise<Submission[]> {
  const res = await fetch(`/api/my/courses/${courseId}/problems/${problemId}/submissions`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

export async function submitAnswer(courseId: string, problemId: string, code: string): Promise<SubmissionResult> {
  const res = await apiRequest("POST", `/api/my/courses/${courseId}/problems/${problemId}/submissions`, { code });
  return res.json();
}

export interface CertificateMeta {
  id: string;
  certificateNumber: string;
  issuedAt: string;
}

export async function fetchMyCertificate(courseId: string): Promise<CertificateMeta | null> {
  const res = await fetch(`/api/my/courses/${courseId}/certificate`, { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch certificate");
  return res.json();
}

export function certificatePdfUrl(certificateId: string): string {
  return `/api/my/certificates/${certificateId}/pdf`;
}

// ============================================
// Learner: Video progress
// ============================================

export async function fetchVideoProgress(blockId: string): Promise<number> {
  const res = await fetch(`/api/my/video-progress/${blockId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch video progress");
  const data = await res.json();
  return data.positionSeconds ?? 0;
}

export async function saveVideoProgress(blockId: string, positionSeconds: number, completed?: boolean): Promise<void> {
  await apiRequest("PUT", `/api/my/video-progress/${blockId}`, { positionSeconds, completed });
}
