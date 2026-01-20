import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { problem, code, imageUrl } = req.body;

      if (!problem) {
        return res.status(400).json({ error: "問題文が必要です" });
      }

      let prompt = `#命令書:   
あなたは教育のスペシャリストであり、プロのwebエンジニアです。
問題に対する解説を作成してください。

#制約条件
- 解答者、担当メンターも初学者と想定して、優しい解説を作成する

#入力文
- 問題
${problem}
`;

      if (imageUrl) {
        prompt += `- 問題の画像: ${imageUrl}
`;
      }

      if (code) {
        prompt += `- コード全部
\`\`\`
${code}
\`\`\`
`;
      }

      prompt += `
#出力文  
以下の内容で、md形式で出力してください。
## コードの解説
このプロパティは○○のために必要です、使われています、など
## この課題のポイント
何回も書くのは冗長なのでまとめられていますね。など工夫点
## 初心者のよくある間違い
2重で中央寄せしてしまう、中央寄せを親のpaddingでしてしまうなど、無駄な記述や、ただし使い方ではないパターンなど用意したい
## 理解度を図る質問例
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
