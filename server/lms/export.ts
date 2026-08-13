import { driveClient, sheetsClient } from "../replit_integrations/object_storage";
import { lmsStorage } from "./storage";
import type { CourseWithDetails } from "@shared/schema";

// Shared Drive folder "エクスポート" inside "AI-Codex". Service accounts have no storage
// quota of their own, so the file must be created directly inside a shared drive folder.
const EXPORT_FOLDER_ID = "1YqnwB59ewOj5s1SVm4DwK0S0Yx8xPVHZ";

async function problemStatusLabel(userId: string, courseId: string, problemId: string): Promise<string> {
  const attempts = await lmsStorage.getSubmissionsFor(userId, courseId, problemId);
  if (attempts.some((a) => a.verdict === "pass")) return "学習完了";
  if (attempts.length > 0) return "学習中";
  return "未着手";
}

function buildFileName(courseTitle: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${courseTitle}_${stamp}`;
}

export async function exportCourseProgress(course: CourseWithDetails): Promise<{ url: string; fileName: string }> {
  const flat = await lmsStorage.flattenCourse(course.id);
  const learners = await lmsStorage.usersForCourse(course.id);

  const header = [
    "ログインID",
    "氏名",
    "該当数",
    "全体数",
    ...flat.map((f) => f.problemTitle),
    `${course.title}認定証`,
    "学習完了日時",
  ];

  const rows: (string | number)[][] = [header];
  for (const learner of learners) {
    const cells = await Promise.all(flat.map((f) => problemStatusLabel(learner.id, course.id, f.problemId)));
    const cert = await lmsStorage.getCertificate(learner.id, course.id);
    rows.push([
      learner.email,
      learner.name,
      flat.length,
      flat.length,
      ...cells,
      cert ? "合格" : "",
      cert ? new Date(cert.issuedAt).toLocaleString("ja-JP") : "",
    ]);
  }

  const fileName = buildFileName(course.title);

  // Create the spreadsheet directly inside the shared drive folder via the Drive API
  // (Sheets API's spreadsheets.create has no "parents" option and would otherwise try
  // to place the file in the service account's own — nonexistent — My Drive).
  const created = await driveClient.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [EXPORT_FOLDER_ID],
    },
    supportsAllDrives: true,
    fields: "id",
  });

  const spreadsheetId = created.data.id;
  if (!spreadsheetId) {
    throw new Error("スプレッドシートの作成に失敗しました");
  }

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  const meta = await driveClient.files.get({
    fileId: spreadsheetId,
    fields: "webViewLink",
    supportsAllDrives: true,
  });

  return {
    url: meta.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    fileName,
  };
}
