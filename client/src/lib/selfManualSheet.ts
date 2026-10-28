import type { SelfManualSheetData } from "./lmsApi";

// The 取扱説明書 image: a template drawn by NotebookLM with blank boxes, into which
// the learner's fields are poured. Box coordinates are in the template's own pixels.
// Keep the field keys in sync with SHEET_FIELDS in server/lms/selfManual.ts.
const TEMPLATE_URL = "/self-manual/template.jpg";

type Box = { x: number; y: number; w: number; h: number };
const BOXES: Record<string, Box> = {
  name: { x: 160, y: 677, w: 655, h: 120 },
  typeCode: { x: 919, y: 673, w: 460, h: 119 },
  cognitive: { x: 161, y: 1016, w: 556, h: 106 },
  functions: { x: 820, y: 1014, w: 558, h: 107 },
  study: { x: 165, y: 1345, w: 1208, h: 257 },
  confidence: { x: 165, y: 1815, w: 1207, h: 259 },
  immature: { x: 165, y: 2288, w: 1208, h: 258 },
};

// Single-line fields are centered and shrunk to fit; the rest wrap.
const SINGLE_LINE = new Set(["name", "typeCode", "cognitive", "functions"]);
const MAX_SIZE: Record<string, number> = { name: 58, typeCode: 66, cognitive: 40, functions: 44, study: 48, confidence: 48, immature: 48 };
const MIN_SIZE = 20;
const LINE_HEIGHT = 1.45;
// Canvas "middle" sits the glyphs a little above the visual center of these boxes; nudge them down.
const OFFSET_Y = 20;
const INK = "#4A2C1A";
const ACCENT = "#C8561A";
const FONT_FAMILY = '"Zen Maru Gothic"';
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&display=swap";

// Characters that must not start a line (kept at the end of the previous one instead).
const NO_LINE_START = new Set(Array.from("、。，．・：；？！）」』】ー〜っゃゅょァィゥェォッャュョ"));

// Times like 12:00〜13:00 and numbers with their unit (5分, 3か月) are never split.
const UNBREAKABLE = /\d{1,2}:\d{2}〜\d{1,2}:\d{2}|\d+(?:か月|ヶ月|週間|時間|分|日|行|つ|回|人|段|字|時|%|％)?|[A-Za-z:.]+/g;
const HIRAGANA_ONLY = /^[ぁ-ゟ]+$/;
const KANJI = /[一-鿿々]/;
const segmenter: { segment(text: string): Iterable<{ segment: string }> } | null =
  "Segmenter" in Intl ? new (Intl as any).Segmenter("ja", { granularity: "word" }) : null;

// Splits text into chunks that are never broken across lines: roughly bunsetsu,
// i.e. words with the hiragana that follows them (理由, 期限を, 開かず).
function tokens(text: string): string[] {
  const normalized = text.replace(/(\d{1,2}:\d{2})\s*[-－~]\s*(\d{1,2}:\d{2})/g, "$1〜$2");
  const pieces: string[] = [];
  let last = 0;
  const pushWords = (part: string) => {
    if (!part) return;
    if (!segmenter) {
      pieces.push(...Array.from(part));
      return;
    }
    for (const { segment } of Array.from(segmenter.segment(part))) pieces.push(segment);
  };
  for (const m of Array.from(normalized.matchAll(UNBREAKABLE))) {
    pushWords(normalized.slice(last, m.index));
    pieces.push(m[0]);
    last = m.index! + m[0].length;
  }
  pushWords(normalized.slice(last));

  const chunks: string[] = [];
  for (const p of pieces) {
    const prev = chunks[chunks.length - 1];
    // Line-start-forbidden marks always stick to the previous chunk; hiragana-only pieces
    // (particles, okurigana) do too, unless the previous chunk already ends a phrase.
    // A run of kanji split by the segmenter (面倒｜事, 口｜開か) is joined back into one word.
    const attach =
      NO_LINE_START.has(p[0]) ||
      (HIRAGANA_ONLY.test(p) && !/[。、」』）]$/.test(prev ?? "")) ||
      (KANJI.test(p[0]) && KANJI.test((prev ?? "").slice(-1)));
    if (prev && attach) {
      chunks[chunks.length - 1] = prev + p;
    } else {
      chunks.push(p);
    }
  }
  return chunks;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, size: number): string[] {
  // Leave one character of room so trailing punctuation never touches the frame.
  const limit = width - size;
  const lines: string[] = [];
  let line = "";
  const push = (tok: string) => {
    if (ctx.measureText(line + tok).width <= limit) {
      line += tok;
    } else if (line && ctx.measureText(tok).width <= limit) {
      lines.push(line);
      line = tok;
    } else {
      // A chunk wider than the line: fall back to breaking it character by character.
      for (const ch of Array.from(tok)) {
        if (line && ctx.measureText(line + ch).width > limit && !NO_LINE_START.has(ch)) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
  };
  for (const tok of tokens(text)) push(tok);
  if (line) lines.push(line);
  return lines;
}

function setFont(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `700 ${size}px ${FONT_FAMILY}, "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
}

function drawSingleLine(ctx: CanvasRenderingContext2D, text: string, box: Box, maxSize: number, color: string) {
  let size = maxSize;
  setFont(ctx, size);
  while (ctx.measureText(text).width > box.w && size > MIN_SIZE) {
    size -= 2;
    setFont(ctx, size);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, box.x + (box.w - ctx.measureText(text).width) / 2, box.y + box.h / 2 + OFFSET_Y);
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, box: Box, maxSize: number) {
  let size = maxSize;
  let lines: string[] = [];
  for (; size > MIN_SIZE; size--) {
    setFont(ctx, size);
    lines = wrap(ctx, text, box.w, size);
    // Avoid a last line of only one to five characters.
    if (lines.length > 1 && Array.from(lines[lines.length - 1]).length <= 5) continue;
    if (lines.length * size * LINE_HEIGHT + OFFSET_Y <= box.h) break;
  }
  setFont(ctx, size);
  const blockWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
  // Center the block in the box, keeping lines left-aligned.
  const x = box.x + (box.w - blockWidth) / 2;
  // Each line is placed by its vertical middle, so the block sits at the box's center.
  const lineHeight = size * LINE_HEIGHT;
  let y = box.y + (box.h - lines.length * lineHeight) / 2 + lineHeight / 2 + OFFSET_Y;
  ctx.fillStyle = INK;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

async function loadFont(text: string) {
  if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_CSS;
    document.head.appendChild(link);
    await new Promise((resolve) => {
      link.onload = resolve;
      link.onerror = resolve;
    });
  }
  // Google Fonts splits Japanese into ranges; loading with the actual text fetches the ones needed.
  await document.fonts.load(`700 40px ${FONT_FAMILY}`, text).catch(() => undefined);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("取扱説明書の型の画像を読み込めませんでした"));
    img.src = src;
  });
}

export async function renderSelfManualSheet(data: SelfManualSheetData): Promise<Blob> {
  const values: Record<string, string> = { name: data.name, typeCode: data.typeCode, ...data.fields };
  const [img] = await Promise.all([loadImage(TEMPLATE_URL), loadFont(Object.values(values).join(""))]);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.textBaseline = "middle";

  for (const [key, box] of Object.entries(BOXES)) {
    const text = (values[key] || "").trim();
    if (!text) continue;
    if (SINGLE_LINE.has(key)) {
      drawSingleLine(ctx, text, box, MAX_SIZE[key], key === "typeCode" ? ACCENT : INK);
    } else {
      drawWrapped(ctx, text, box, MAX_SIZE[key]);
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像の作成に失敗しました"))), "image/png")
  );
}
