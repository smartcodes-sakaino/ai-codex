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

// Handlebars-like template processor shared by the self-review check and the
// (non-gating) AI explain/review routes in server/routes.ts, which support
// {{#if varName}}...{{/if}} conditionals in addition to plain {{varName}} substitution.
export function processTemplate(template: string, vars: Record<string, string | undefined>): string {
  let result = template;
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
    return vars[varName] ? content : "";
  });
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return vars[varName] || "";
  });
  return result;
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

const SELF_REVIEW_PROMPT_ID = "self_review";

export const DEFAULT_SELF_REVIEW_TEMPLATE = `#命令書:
あなたは教育のスペシャリストであり、プロのwebエンジニアです。
研修生が提出したコードを、問題文・模範解答コード・解説文をもとにセルフレビューとしてフィードバックしてください。
このレビューの合否によって、研修生が次のコンテンツに進めるかどうかが決まります。

#制約条件
- 対象は初学者の研修生です。丁寧でわかりやすい言い回しを使ってください。
- 提出コードに修正の必要がない場合は合格(pass)とし、「総評」のみを出力して、次に進んでよいことを伝えてください。
- 提出コードに修正が必要な場合は不合格(fail)とし、「総評」「良かった点」「改善点」「修正点」の4項目すべてを出力してください。
- 些細な書き方の違い(変数名、コメントの有無など)だけでは不合格にしないでください。

#入力文
・問題データ
{{problem}}
{{#if modelCode}}
・模範解答コード
\`\`\`
{{modelCode}}
\`\`\`
{{/if}}
{{#if explanation}}
・解説文
{{explanation}}
{{/if}}

・研修生の提出コード
\`\`\`
{{reviewCode}}
\`\`\`

#出力文
reviewはmd形式で出力してください。

合格の場合:
## 総評
提出コードの全体的な評価を記載。「素晴らしい出来です！」等の前向きなコメントと共に、次に進んでよい旨を伝えてください。

不合格の場合:
## 総評
提出コードの全体的な評価を記載。
## 良かった点
研修生の提出コードの中で良かった部分を具体的に挙げてください。モチベーションを上げる前向きなフィードバック。
## 改善点
より良くするための改善案やリファクタリングの提案。「こうするともっと良くなりますよ」というアドバイス。
## 修正点
絶対に修正しなければならない箇所を具体的に列挙してください。何が間違っていて、どう直すべきかを明確に説明してください。`;

interface SelfReviewResult {
  verdict: "pass" | "fail";
  review: string;
}

export async function runSelfReviewCheck(
  problemText: string,
  modelCode: string,
  explanation: string,
  reviewCode: string
): Promise<SelfReviewResult> {
  const savedPrompt = await storage.getPrompt(SELF_REVIEW_PROMPT_ID);
  const template = savedPrompt?.template || DEFAULT_SELF_REVIEW_TEMPLATE;
  const prompt = processTemplate(template, {
    problem: problemText,
    modelCode,
    explanation,
    reviewCode,
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
            review: { type: "string" },
          },
          required: ["verdict", "review"],
        },
      },
    });
    text = response.text;
  } catch (error) {
    console.error("Self review: Gemini API call failed:", error);
    throw new AiUnavailableError("セルフレビューの生成に失敗しました。時間をおいてもう一度お試しください。");
  }

  try {
    if (!text) throw new Error("empty response");
    const parsed = JSON.parse(text);
    if (parsed.verdict !== "pass" && parsed.verdict !== "fail") {
      throw new Error("missing verdict");
    }
    return { verdict: parsed.verdict, review: parsed.review || "" };
  } catch (error) {
    console.error("Self review: failed to parse AI response:", error, text);
    return {
      verdict: "fail",
      review: "AIのレビュー結果を正しく取得できませんでした。もう一度お試しください。",
    };
  }
}
