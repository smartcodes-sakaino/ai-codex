import PDFDocument from "pdfkit";
import { GoogleGenAI } from "@google/genai";
import { loadPdfFonts } from "./certificate";
import { AiUnavailableError } from "./aiCheck";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The 10 fields of the 取扱説明書 problem (see the problem text), grouped into its 4 parts.
const SECTIONS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: "A. 自分を知る",
    fields: [
      { key: "f1", label: "入力層" },
      { key: "f2", label: "重み" },
      { key: "f3", label: "今の自分のタイプと、理想のタイプ像" },
    ],
  },
  {
    title: "B. 学び方と進み方",
    fields: [
      { key: "f4", label: "自分の勉強法" },
      { key: "f5", label: "成長の流れ" },
    ],
  },
  {
    title: "C. 考え方と仕事の進め方",
    fields: [
      { key: "f6", label: "思考の深さ" },
      { key: "f7", label: "完了・報告・ヘルプのルール" },
      { key: "f8", label: "時間・休憩・エネルギーのルール" },
    ],
  },
  {
    title: "D. 人との関係",
    fields: [
      { key: "f9", label: "信頼と断る力" },
      { key: "f10", label: "周りの人へ：私への伝え方" },
    ],
  },
];

const FIELD_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

export interface SelfManualContent {
  typeCode: string;
  reviewDate: string;
  fields: Record<string, string>;
}

const EXTRACT_PROMPT = `#命令書:
研修生が書いた「自分の取扱説明書」の回答を、1枚の資料に載せるために欄ごとに整理してください。

#制約条件
- 回答の「1. 自分の取扱説明書」の①〜⑩だけを使います。「2. 架空のケース」の回答は使いません
- 研修生の言葉をできるだけそのまま使ってください。縮めるのは言い回しだけで、意味を変えたり、回答に書かれていないことを足したりしないでください
- 各欄は100〜180字ほどにまとめ、要素ごとに改行して「・」で始まる行に分けてください（1欄5行まで）
- 数字（時間・回数・期限・段数・人数など）と、条件（「〇〇のときは」「〇〇か」などの判定方法）は、省いたり言い換えたりせずに残してください
- 各欄では、次の要素を1つも落とさないでください（回答に書かれているものだけ）
  - f1 入力層：認知特性の上位2つと一番低いタイプ／入りやすい情報の形／苦手な形の情報の変換のしかた
  - f2 重み：4つの機能の順番／納得の条件／劣等機能が出る場面と備え／崩れかけのサインと立て直し方
  - f3：今のタイプ／理想のタイプ像の行動3つ／今の自分とのずれ／自分の個性
  - f4 勉強法：4つの工程それぞれでやること／型を直した記録（何がうまくいかず、どこを、どう直したか）
  - f5 成長の流れ：できるようになったこと・まだできないこと／各段の内容・期限・判定方法／登れた未来の自分
  - f6 思考の深さ：浅くなりやすい状況と、そのときの仕掛け
  - f7：頼まれたときに確かめること／報告のルール（数字）／ヘルプのルール（数字）
  - f8：開始・休憩・終業のルール（数字）／エネルギーを使うものと回復するもの／集中が切れやすい時間帯と仕事の置き方
  - f9：守り続ける約束3つ／断り方の実際の言葉
  - f10：伝え方のお願い3つ
- 書かれていない欄は空文字にしてください
- typeCode は③に書かれた今の自分のタイプ（英字4文字）。書かれていなければ空文字
- reviewDate は「3. 取扱説明書を育てる」に書かれた、次に見直す日。書かれていなければ空文字

#回答
\`\`\`
{{answer}}
\`\`\``;

export async function extractSelfManual(answer: string): Promise<SelfManualContent> {
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: EXTRACT_PROMPT.replace("{{answer}}", answer) }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            typeCode: { type: "string" },
            reviewDate: { type: "string" },
            ...Object.fromEntries(FIELD_KEYS.map((k) => [k, { type: "string" }])),
          },
          required: ["typeCode", "reviewDate", ...FIELD_KEYS],
        },
      },
    });
    text = response.text;
  } catch (error) {
    console.error("Self manual: Gemini API call failed:", error);
    throw new AiUnavailableError("取扱説明書の整理に失敗しました。時間をおいてもう一度お試しください。");
  }

  try {
    if (!text) throw new Error("empty response");
    const parsed = JSON.parse(text);
    return {
      typeCode: String(parsed.typeCode || "").trim(),
      reviewDate: String(parsed.reviewDate || "").trim(),
      fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, String(parsed[k] || "").trim()])),
    };
  } catch (error) {
    console.error("Self manual: failed to parse AI response:", error, text);
    throw new AiUnavailableError("取扱説明書の整理に失敗しました。もう一度お試しください。");
  }
}

const FONT_REGULAR = "NotoSansJP-Regular";
const FONT_BOLD = "NotoSansJP-Bold";

const CIRCLED_DIGITS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const GLYPH_FALLBACKS: Record<string, string> = { "→": "＞", "⇒": "＞", "➡": "＞", "←": "＜", "⇐": "＜" };

// The bundled Noto Sans JP is a subset (no arrows or circled digits), and pdfkit
// draws a box for any missing glyph — so swap those characters for ones it has.
function fitToFont(text: string, hasGlyph: (codePoint: number) => boolean): string {
  return Array.from(text)
    .map((ch) => {
      if (ch === "\n" || hasGlyph(ch.codePointAt(0)!)) return ch;
      if (GLYPH_FALLBACKS[ch]) return GLYPH_FALLBACKS[ch];
      const circled = CIRCLED_DIGITS.indexOf(ch);
      if (circled >= 0) return `(${circled + 1})`;
      return " ";
    })
    .join("");
}

// The AI sometimes runs "・" items together on one line; break them onto their own
// lines (only a "・" at the start or after a space/。, not one joining two words like 完了・報告).
function splitBullets(text: string): string {
  return text.replace(/(^|[ 　。])・/g, (_, before) => (before === "" ? "・" : `${before === "。" ? "。" : ""}\n・`)).trim();
}

export async function renderSelfManualPdf(opts: {
  learnerName: string;
  content: SelfManualContent;
  createdAt: Date;
}): Promise<Buffer> {
  const fonts = await loadPdfFonts();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: 0 });
    doc.registerFont(FONT_REGULAR, fonts.regular);
    doc.registerFont(FONT_BOLD, fonts.bold);
    // pdfkit keeps the fontkit font of the current font on _font.font (not in its typings).
    const fontkitFont = (doc.font(FONT_REGULAR) as any)._font.font;
    const fit = (text: string) => fitToFont(text, (cp) => fontkitFont.hasGlyphForCodePoint(cp));
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Same palette as the certificate.
    const accent = "#E8722C";
    const ink = "#241F1B";
    const muted = "#6B6259";
    const soft = "#FFF4EC";
    const width = doc.page.width;
    const height = doc.page.height;
    const margin = 36;

    // Header
    doc.rect(0, 0, width, 92).fill(soft);
    doc.rect(0, 92, width, 3).fill(accent);
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(accent)
      .text("MY USER MANUAL", margin, 24, { characterSpacing: 2 });
    doc
      .font(FONT_BOLD)
      .fontSize(22)
      .fillColor(ink)
      .text(fit(`${opts.learnerName} の取扱説明書`), margin, 38, { width: width - margin * 2 - 120 });
    if (opts.content.typeCode) {
      doc.roundedRect(width - margin - 96, 36, 96, 34, 17).fill(accent);
      doc
        .font(FONT_BOLD)
        .fontSize(16)
        .fillColor("#FFFFFF")
        .text(opts.content.typeCode, width - margin - 96, 43, { width: 96, align: "center", characterSpacing: 1 });
    }
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(muted)
      .text(
        `作成日 ${opts.createdAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`,
        margin,
        72
      );

    // Body: A・B in the left column, C・D in the right column.
    const top = 110;
    const bottom = height - 50;
    const gap = 16;
    const colWidth = (width - margin * 2 - gap) / 2;
    const columns = [SECTIONS.slice(0, 2), SECTIONS.slice(2, 4)];

    const layoutColumn = (sections: typeof SECTIONS, x: number, bodySize: number, draw: boolean): number => {
      let y = top;
      for (const section of sections) {
        if (draw) {
          doc.rect(x, y, colWidth, 20).fill(accent);
          doc.font(FONT_BOLD).fontSize(10.5).fillColor("#FFFFFF").text(section.title, x + 8, y + 4, { width: colWidth - 16 });
        }
        y += 26;
        for (const field of section.fields) {
          // The bundled Noto Sans JP subset has no ①〜⑩ glyphs, so the number is drawn in a circle.
          doc.font(FONT_BOLD).fontSize(bodySize + 1);
          const labelHeight = doc.heightOfString(field.label, { width: colWidth - 20 });
          if (draw) {
            const r = (bodySize + 3) / 2;
            const num = field.key.slice(1);
            const numSize = num.length > 1 ? bodySize - 2.5 : bodySize - 1;
            doc.circle(x + r, y + labelHeight / 2, r).fill(accent);
            doc
              .fontSize(numSize)
              .fillColor("#FFFFFF")
              .text(num, x, y + labelHeight / 2 - numSize * 0.72, { width: r * 2, align: "center", lineBreak: false });
            doc.fontSize(bodySize + 1).fillColor(accent).text(field.label, x + 20, y, { width: colWidth - 20 });
          }
          y += labelHeight + 2;
          const body = fit(splitBullets(opts.content.fields[field.key] || "")) || "（未記入）";
          doc.font(FONT_REGULAR).fontSize(bodySize);
          const bodyHeight = doc.heightOfString(body, { width: colWidth - 12, lineGap: 1.5 });
          if (draw) {
            doc.rect(x, y, 2, bodyHeight).fill("#F2C9A8");
            doc.fillColor(ink).text(body, x + 12, y, { width: colWidth - 12, lineGap: 1.5 });
          }
          y += bodyHeight + 9;
        }
        y += 4;
      }
      return y;
    };

    // Shrink the body text until both columns fit on one page — AI summaries vary in length.
    let bodySize = 9;
    while (bodySize > 6.5 && columns.some((c) => layoutColumn(c, 0, bodySize, false) > bottom)) {
      bodySize -= 0.25;
    }
    columns.forEach((c, i) => layoutColumn(c, margin + i * (colWidth + gap), bodySize, true));

    // Footer
    doc.moveTo(margin, height - 38).lineTo(width - margin, height - 38).lineWidth(0.5).strokeColor("#D8CFC3").stroke();
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(muted)
      .text(fit(`次に見直す日：${opts.content.reviewDate || "（未設定）"}`), margin, height - 30, {
        width: width - margin * 2,
        lineBreak: false,
      });

    doc.end();
  });
}
