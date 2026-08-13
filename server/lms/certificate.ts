import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { lmsStorage } from "./storage";
import type { Certificate } from "@shared/schema";

const objectStorageService = new ObjectStorageService();

// pdfkit's built-in fonts (Helvetica etc.) have no Japanese glyphs, so a Japanese-capable
// font must be registered explicitly. See server/lms/assets/NOTICE.md for licensing.
// Resolved from the working directory (not import.meta.dirname) so this keeps working
// after the server is bundled into dist/ by script/build.ts, which does not relocate assets.
const FONT_REGULAR_PATH = path.resolve(process.cwd(), "server/lms/assets/NotoSansJP-Regular.ttf");
const FONT_BOLD_PATH = path.resolve(process.cwd(), "server/lms/assets/NotoSansJP-Bold.ttf");

type FontBuffers = { regular: Buffer; bold: Buffer };
type FontLoader = () => Promise<FontBuffers>;

// Environments without a real filesystem (e.g. Cloudflare Workers) can't read the
// font off disk; they call this to swap in a loader that fetches the bytes another
// way (see server/worker.ts) before any certificate is generated.
let fontLoader: FontLoader = async () => ({
  regular: fs.readFileSync(FONT_REGULAR_PATH),
  bold: fs.readFileSync(FONT_BOLD_PATH),
});

export function setFontLoader(loader: FontLoader): void {
  fontLoader = loader;
}

function generateCertificateNumber(courseId: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `CERT-${courseId.replace(/-/g, "").slice(0, 8).toUpperCase()}-${datePart}-${randomPart}`;
}

const FONT_REGULAR = "NotoSansJP-Regular";
const FONT_BOLD = "NotoSansJP-Bold";

async function renderCertificatePdf(opts: {
  learnerName: string;
  courseTitle: string;
  completedAt: Date;
  companyName: string;
  issuerName: string;
  certificateNumber: string;
}): Promise<Buffer> {
  const fonts = await fontLoader();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    doc.registerFont(FONT_REGULAR, fonts.regular);
    doc.registerFont(FONT_BOLD, fonts.bold);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const accent = "#E8722C";
    const ink = "#241F1B";
    const muted = "#6B6259";
    const width = doc.page.width;
    const height = doc.page.height;

    doc.lineWidth(3).strokeColor(accent).rect(30, 30, width - 60, height - 60).stroke();
    doc.lineWidth(0.75).strokeColor("#D8CFC3").rect(42, 42, width - 84, height - 84).stroke();

    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .fillColor(accent)
      .text("CERTIFICATE OF COMPLETION", 0, 90, { align: "center", characterSpacing: 2 });

    doc.font(FONT_BOLD).fontSize(30).fillColor(ink).text("修 了 証", 0, 115, { align: "center" });

    doc
      .font(FONT_BOLD)
      .fontSize(20)
      .fillColor(ink)
      .text(`${opts.learnerName} 様`, 0, 190, { align: "center" });

    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .fillColor(muted)
      .text("あなたは下記のコースを修了し、すべての課題に合格したことを証します。", 0, 230, { align: "center" });

    doc
      .font(FONT_BOLD)
      .fontSize(16)
      .fillColor(ink)
      .text(`「${opts.courseTitle}」`, 0, 260, { align: "center" });

    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .fillColor(muted)
      .text(
        opts.completedAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
        0,
        290,
        { align: "center" }
      );

    doc.font(FONT_BOLD).fontSize(11).fillColor(ink).text(opts.companyName, 70, height - 100);
    doc.font(FONT_REGULAR).fontSize(10).fillColor(muted).text(opts.issuerName, 70, height - 82);

    doc
      .font(FONT_REGULAR)
      .fontSize(9)
      .fillColor(muted)
      .text(`証明番号: ${opts.certificateNumber}`, width - 280, height - 82, { width: 210, align: "right" });

    doc.end();
  });
}

/** Issues a certificate the first time a course is completed. Returns the existing one if already issued. */
export async function issueCertificateIfNeeded(
  userId: string,
  courseId: string,
  courseTitle: string,
  learnerName: string
): Promise<Certificate> {
  const existing = await lmsStorage.getCertificate(userId, courseId);
  if (existing) return existing;

  const settings = await lmsStorage.getSettings();
  const certificateNumber = generateCertificateNumber(courseId);
  const pdfBuffer = await renderCertificatePdf({
    learnerName,
    courseTitle,
    completedAt: new Date(),
    companyName: settings.companyName,
    issuerName: settings.issuerName,
    certificateNumber,
  });

  const objectPath = await objectStorageService.uploadBuffer(
    pdfBuffer,
    `certificate-${certificateNumber}.pdf`,
    "application/pdf"
  );

  return lmsStorage.createCertificate({
    userId,
    courseId,
    certificateNumber,
    pdfObjectPath: objectPath,
    companyNameSnapshot: settings.companyName,
    issuerNameSnapshot: settings.issuerName,
  });
}

export { objectStorageService };
