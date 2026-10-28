import { GoogleGenAI } from "@google/genai";
import { AiUnavailableError } from "./aiCheck";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The 取扱説明書 image is a fixed template with blank boxes that each field is poured into.
// Box sizes are decided first, so every field has a character budget the AI writes to.
// Keep the keys in sync with client/src/lib/selfManualSheet.ts.
export const SHEET_FIELDS: { key: string; label: string; source: string; maxChars: number }[] = [
  {
    key: "cognitive",
    label: "認知タイプ",
    source: "③ 認知タイプ。「1位 〇〇／2位 〇〇／低 〇〇」の形で、タイプ名だけ（「タイプ」は付けない）",
    maxChars: 26,
  },
  {
    key: "functions",
    label: "心理機能",
    source: "④ 心理機能。「Si → Te → Fi → Ne」のように、主機能から劣等機能まで、英字2文字を「 → 」でつなぐ",
    maxChars: 24,
  },
  {
    key: "study",
    label: "私の勉強法",
    source: "⑤ 私の勉強法。4つの工程（受け取る → 処理する → 自分のものにする → 確かめる）でやることを、この順に短く",
    maxChars: 140,
  },
  {
    key: "confidence",
    label: "私の自信",
    source: "⑥ 私の自信。できるようになったことを、数字や出来事を残して3つまで",
    maxChars: 110,
  },
  {
    key: "immature",
    label: "私の未熟な点",
    source: "⑦ 私の未熟な点。まだできていないことと、その今の備え（「〇〇のときは、〇〇する」）",
    maxChars: 110,
  },
];

export interface SelfManualSheet {
  typeCode: string;
  fields: Record<string, string>;
}

async function generateJson(prompt: string, properties: Record<string, unknown>): Promise<any> {
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: "object", properties, required: Object.keys(properties) },
      },
    });
    text = response.text;
  } catch (error) {
    console.error("Self manual: Gemini API call failed:", error);
    throw new AiUnavailableError("取扱説明書の整理に失敗しました。時間をおいてもう一度お試しください。");
  }
  try {
    if (!text) throw new Error("empty response");
    return JSON.parse(text);
  } catch (error) {
    console.error("Self manual: failed to parse AI response:", error, text);
    throw new AiUnavailableError("取扱説明書の整理に失敗しました。もう一度お試しください。");
  }
}

const SHEET_PROMPT = `#命令書:
研修生が書いた「自分の取扱説明書」の回答から、上司や同僚に渡すプロフィール帳の各欄を書いてください。

#制約条件
- 回答の「1. 私の取説」だけを使います。「2. 架空のケース」の回答は使いません
- 研修生本人の言葉で、回答に書かれた内容だけを使ってください。回答にない理由・効果（「確実に残ります」「すぐに動けます」など）や言葉を足さないでください
- 「私は」で書き始めないでください。説明的な言い方（「〜と自覚しています」など）は避け、どの欄も自然な文で終えてください
- 各欄は、指定の字数の8〜10割の長さで書き、字数をこえないでください。入りきらないときは、受け取る人にとって大事な点から順に残してください
- 残した内容の数字・条件・程度は、回答のとおりにしてください。条件の言い回しも変えないでください（「なくなった」を「減った」にしない、など）
- 「・」や番号、改行は使わないでください
- 回答に書かれていない欄は空文字にしてください
- typeCode は、回答の②に書かれたタイプ（英字4文字）。書かれていなければ空文字

#各欄（キー：欄の名前／使う回答の部分／字数）
{{fields}}

#回答
\`\`\`
{{answer}}
\`\`\``;

const SHORTEN_PROMPT = `#命令書:
次の各欄が字数をこえています。それぞれ指定の字数以内に縮めてください。

#制約条件
- 大事な点に絞ってかまいませんが、残した内容の数字・条件・程度は変えないでください。書かれていないことを足さないでください
- 「・」や番号、改行は使わないでください

#各欄（キー：字数／今の文）
{{fields}}`;

export async function extractSelfManualSheet(answer: string): Promise<SelfManualSheet> {
  const fieldList = SHEET_FIELDS.map((f) => `- ${f.key}：${f.label}／${f.source}／${f.maxChars}字以内`).join("\n");
  const parsed = await generateJson(SHEET_PROMPT.replace("{{fields}}", fieldList).replace("{{answer}}", answer), {
    typeCode: { type: "string" },
    ...Object.fromEntries(SHEET_FIELDS.map((f) => [f.key, { type: "string" }])),
  });
  const fields: Record<string, string> = Object.fromEntries(
    SHEET_FIELDS.map((f) => [f.key, String(parsed[f.key] || "").replace(/\s*\n\s*/g, "").trim()])
  );

  // The model often overshoots the budget; give over-budget fields one more pass.
  const tooLong = SHEET_FIELDS.filter((f) => fields[f.key].length > f.maxChars);
  if (tooLong.length > 0) {
    const shortened = await generateJson(
      SHORTEN_PROMPT.replace("{{fields}}", tooLong.map((f) => `- ${f.key}：${f.maxChars}字以内／${fields[f.key]}`).join("\n")),
      Object.fromEntries(tooLong.map((f) => [f.key, { type: "string" }]))
    );
    for (const f of tooLong) {
      const text = String(shortened[f.key] || "").trim();
      if (text && text.length < fields[f.key].length) fields[f.key] = text;
    }
  }

  return { typeCode: String(parsed.typeCode || "").trim(), fields };
}
