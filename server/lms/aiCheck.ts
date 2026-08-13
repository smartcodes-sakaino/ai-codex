import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LMS_CHECK_PROMPT_ID = "lms_check";

export const DEFAULT_LMS_CHECK_TEMPLATE = `#命令書:
あなたは教育のスペシャリストであり、プロのWebエンジニアです。
研修生が提出したコードを、問題文をもとに採点してください。この採点結果によって、研修生が次の課題に進めるかどうかが決まります。

#制約条件
- 対象は初学者の研修生です。丁寧でわかりやすい言い回しを使ってください
- 問題文の要件を満たしていれば合格、満たしていなければ不合格としてください
- 些細な書き方の違い(変数名、コメントの有無など)だけでは不合格にしないでください

#入力文
・問題
{{problem}}

・研修生の提出コード
\`\`\`
{{code}}
\`\`\`

#出力
総評、良かった点、改善点、修正が必要な点(不合格の場合)、そして最終的な合否を判定してください。`;

interface LmsCheckResult {
  verdict: "pass" | "fail";
  summary: string;
  good: string;
  improve: string;
  mustFix: string;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

/** Thrown when the AI call itself fails (quota, network, etc.) — the caller should NOT record a submission for this. */
export class AiUnavailableError extends Error {}

export async function runLmsCheck(problemTitle: string, problemDescription: string, code: string): Promise<LmsCheckResult> {
  const savedPrompt = await storage.getPrompt(LMS_CHECK_PROMPT_ID);
  const template = savedPrompt?.template || DEFAULT_LMS_CHECK_TEMPLATE;
  const prompt = fillTemplate(template, {
    problem: `${problemTitle}\n${problemDescription}`,
    code,
  });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["pass", "fail"] },
            summary: { type: "string" },
            good: { type: "string" },
            improve: { type: "string" },
            mustFix: { type: "string" },
          },
          required: ["verdict", "summary"],
        },
      },
    });
    text = response.text;
  } catch (error) {
    console.error("LMS AI check: Gemini API call failed:", error);
    throw new AiUnavailableError("AIによる採点に失敗しました。時間をおいてもう一度お試しください。");
  }

  // The API call succeeded, but the model didn't follow the response format — record as a failed attempt
  // rather than silently discarding it, since this is a content issue, not an availability issue.
  try {
    if (!text) throw new Error("empty response");
    const parsed = JSON.parse(text);
    if (parsed.verdict !== "pass" && parsed.verdict !== "fail") {
      throw new Error("missing verdict");
    }
    return {
      verdict: parsed.verdict,
      summary: parsed.summary || "",
      good: parsed.good || "",
      improve: parsed.improve || "",
      mustFix: parsed.mustFix || "",
    };
  } catch (error) {
    console.error("LMS AI check: failed to parse AI response:", error, text);
    return {
      verdict: "fail",
      summary: "AIの採点結果を正しく取得できませんでした。もう一度提出してください。",
      good: "",
      improve: "",
      mustFix: "",
    };
  }
}
