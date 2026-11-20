import { AiUnavailableError } from "./aiCheck";
import type { SelfManualVariant } from "@shared/selfManual";
import { createGeminiClient, GEMINI_TEXT_MODEL } from "../geminiClient";

const ai = createGeminiClient();

// The 取扱説明書 image is a fixed template with blank boxes that each field is poured into.
// Box sizes are decided first, so every field has a character budget the AI writes to.
// Keep the keys in sync with client/src/lib/selfManualSheet.ts.
// The two 総まとめ problems number their answers differently, so each variant says
// which part of the answer feeds each box. A field with no source for a variant is
// not asked of the AI (the light version's 心理機能 comes from the type table instead).
export const SHEET_FIELDS: { key: string; label: string; maxChars: number; source: Record<SelfManualVariant, string | null> }[] = [
  {
    key: "cognitive",
    label: "認知タイプ",
    maxChars: 26,
    source: {
      full: "③ 認知タイプ。「1位 〇〇／2位 〇〇／低 〇〇」の形で、タイプ名だけ（「タイプ」は付けない）",
      light: "① 入力層の認知特性。「1位 〇〇／2位 〇〇／低 〇〇」の形で、タイプ名だけ（「タイプ」は付けない）。書かれていない順位は省く",
    },
  },
  {
    key: "functions",
    label: "心理機能",
    maxChars: 24,
    source: {
      full: "④ 心理機能。「Si → Te → Fi → Ne」のように、主機能から劣等機能まで、英字2文字を「 → 」でつなぐ",
      light: null,
    },
  },
  {
    key: "study",
    label: "私の勉強法",
    maxChars: 140,
    source: {
      full: "⑤ 私の勉強法。4つの工程（受け取る → 処理する → 自分のものにする → 確かめる）でやることを、この順に短く",
      light: "④ 自分の勉強法。4つの工程（受け取る → 処理する → 自分のものにする → 確かめる）でやることを、この順に短く",
    },
  },
  {
    key: "confidence",
    label: "私の自信",
    maxChars: 110,
    source: {
      full: "⑥ 私の自信。できるようになったことを、数字や出来事を残して3つまで",
      light: "⑤ 成長の流れのうち「自信」（できるようになった事実）だけ。数字や出来事を残して3つまで。段や未来の自分は使わない",
    },
  },
  {
    key: "immature",
    label: "私の未熟な点",
    maxChars: 110,
    source: {
      full: "⑦ 私の未熟な点。まだできていないことと、その今の備え（「〇〇のときは、〇〇する」）",
      light: "③ のうち劣等機能への備え。「劣等機能（〇〇）が出やすい〇〇のときは、〇〇する」の形で、場面と備えを1〜2文に。納得の条件は使わない",
    },
  },
];

// The answer part the sheet is built from, and the part it must ignore.
const ANSWER_SCOPE: Record<SelfManualVariant, string> = {
  full: "回答の「1. 私の取説」だけを使います。「2. 架空のケース」の回答は使いません",
  light: "回答の「1. 自分の取扱説明書」だけを使います。「2. 3か月後のシーン」の回答は使いません",
};

// 主機能→補助機能→第三機能→劣等機能, as listed in the course's reference table.
const FUNCTION_ORDER: Record<string, string[]> = {
  ISTJ: ["Si", "Te", "Fi", "Ne"], ISFJ: ["Si", "Fe", "Ti", "Ne"], INFJ: ["Ni", "Fe", "Ti", "Se"], INTJ: ["Ni", "Te", "Fi", "Se"],
  ISTP: ["Ti", "Se", "Ni", "Fe"], ISFP: ["Fi", "Se", "Ni", "Te"], INFP: ["Fi", "Ne", "Si", "Te"], INTP: ["Ti", "Ne", "Si", "Fe"],
  ESTP: ["Se", "Ti", "Fe", "Ni"], ESFP: ["Se", "Fi", "Te", "Ni"], ENFP: ["Ne", "Fi", "Te", "Si"], ENTP: ["Ne", "Ti", "Fe", "Si"],
  ESTJ: ["Te", "Si", "Ne", "Fi"], ESFJ: ["Fe", "Si", "Ne", "Ti"], ENFJ: ["Fe", "Ni", "Se", "Ti"], ENTJ: ["Te", "Ni", "Se", "Fi"],
};

export function functionsForType(typeCode: string): string {
  const order = FUNCTION_ORDER[typeCode.trim().toUpperCase()];
  return order ? order.join(" → ") : "";
}

export interface SelfManualSheet {
  typeCode: string;
  fields: Record<string, string>;
}

async function generateJson(prompt: string, properties: Record<string, unknown>): Promise<any> {
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
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
- {{scope}}
- 研修生本人の言葉で、回答に書かれた内容だけを使ってください。回答にない理由・効果（「確実に残ります」「すぐに動けます」など）や言葉を足さないでください
- 「私は」で書き始めないでください。説明的な言い方（「〜と自覚しています」など）は避け、どの欄も自然な文で終えてください
- 各欄は、指定の字数の8〜10割の長さで書き、字数をこえないでください。入りきらないときは、受け取る人にとって大事な点から順に残してください
- 残した内容の数字・条件・程度は、回答のとおりにしてください。条件の言い回しも変えないでください（「なくなった」を「減った」にしない、など）
- 「・」や番号、改行は使わないでください。工程や項目の区切りは句点「。」で区切ってください。1つの工程・項目は1文にし、出来事と数字を別の文に分けないでください
- 体言止めを続けたり、電報のように助詞を削ったりせず、話し言葉に近い文にしてください。回答にない略語（「NW」など）を作らないでください
- 数字は回答のとおり算用数字で書いてください（「30分」を「三十分」にしない）。回答の「」はそのまま残してかまいません
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
- 縮めるときは、項目の数を減らしてください。体言止めや助詞を削った電報のような言い方、略語にはしないでください
- 「・」や番号、改行は使わないでください。項目の区切りは句点「。」で区切ってください

#各欄（キー：字数／今の文）
{{fields}}`;

export async function extractSelfManualSheet(answer: string, variant: SelfManualVariant): Promise<SelfManualSheet> {
  const asked = SHEET_FIELDS.filter((f) => f.source[variant] !== null);
  const fieldList = asked.map((f) => `- ${f.key}：${f.label}／${f.source[variant]}／${f.maxChars}字以内`).join("\n");
  const prompt = SHEET_PROMPT.replace("{{scope}}", ANSWER_SCOPE[variant])
    .replace("{{fields}}", fieldList)
    .replace("{{answer}}", answer);
  const parsed = await generateJson(prompt, {
    typeCode: { type: "string" },
    ...Object.fromEntries(asked.map((f) => [f.key, { type: "string" }])),
  });
  const typeCode = String(parsed.typeCode || "").trim();
  const fields: Record<string, string> = Object.fromEntries(
    SHEET_FIELDS.map((f) => [f.key, String(parsed[f.key] || "").replace(/\s*\n\s*/g, "").trim()])
  );
  if (variant === "light") fields.functions = functionsForType(typeCode);
  // The box is narrow; the model sometimes keeps the 「タイプ」 suffix it was told to drop.
  fields.cognitive = fields.cognitive.replace(/タイプ/g, "");

  // The model often overshoots the budget; give over-budget fields one more pass.
  const tooLong = asked.filter((f) => fields[f.key].length > f.maxChars);
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

  return { typeCode, fields };
}
