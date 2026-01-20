import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { problem, code } = req.body;

      if (!problem) {
        return res.status(400).json({ error: "問題文が必要です" });
      }

      let prompt = `あなたはプログラミング学習の専門家です。以下の問題について、初心者にもわかりやすく日本語で解説してください。

## 問題
${problem}
`;

      if (code) {
        prompt += `
## コード例
${code}

上記のコードについても解説を含めてください。
`;
      }

      prompt += `
## 解説のフォーマット
- わかりやすい言葉で説明してください
- 重要なポイントを箇条書きで示してください
- 必要に応じて例を挙げてください
- 初心者がつまずきやすいポイントについても触れてください
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const explanation = response.text || "解説を生成できませんでした。";

      res.json({ explanation });
    } catch (error) {
      console.error("AI説明生成エラー:", error);
      res.status(500).json({ error: "AI解説の生成に失敗しました" });
    }
  });

  return httpServer;
}
