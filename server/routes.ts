import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI, Modality } from "@google/genai";
import { storage } from "./storage";
import { insertChapterSchema, insertProblemSchema, insertBlockSchema, insertPromptSchema } from "@shared/schema";
import { registerObjectStorageRoutes, ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { z } from "zod";
import { randomUUID } from "crypto";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

const imageAi = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const objectStorageService = new ObjectStorageService();

// Default prompts
const DEFAULT_EXPLANATION_TEMPLATE = `#命令書:   
あなたは教育のスペシャリストであり、プロのwebエンジニアです。
コードが存在している場合、コードは問題に対する模範解答です。この問題、およびコードに対する解説を作成してください。

#制約条件
- 解答者、担当メンターも初学者と想定して、優しい解説を作成する

#入力文
- 問題
{{problem}}
{{#if imageUrl}}- 問題の画像: {{imageUrl}}{{/if}}
{{#if code}}- コード全部
\`\`\`
{{code}}
\`\`\`
{{/if}}

#出力文  
以下の内容で、md形式で出力してください。
## コードの解説
このプロパティは○○のために必要です、使われています、など
## この課題のポイント
何回も書くのは冗長なのでまとめられていますね。など工夫点
## 初心者のよくある間違い
2重で中央寄せしてしまう、中央寄せを親のpaddingでしてしまうなど、無駄な記述や、ただし使い方ではないパターンなど用意したい
## この課題の採点基準
この課題を達成するうえで必達の項目を考えて洗い出してください。模範解答と違くてもOKの判断を出すための項目です。
凡ミスなどは注意くらいにとどめます。
## 理解度を図る質問例`;

const DEFAULT_REVIEW_TEMPLATE = `#命令書:   
あなたは教育のスペシャリストであり、プロのwebエンジニアです。
問題や解説をもとにコードレビューを行ってください。

#制約条件
対象は基本的に初学者なので、丁寧な言い回しでフィードバックすること。

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

・レビュー対象のコード
\`\`\`
{{reviewCode}}
\`\`\`

#出力文  
以下の内容で、md形式で出力してください。
## 総評
ぱっと見の総評、全体像
## よくできているところ
ここまでできてて素晴らしいです、など前向きなフィードバック
## こうするともっといいところ（あれば）
リファクタリング的な目線だったり、違う方法の提示だったり、「ここが違う！」というよりもより良いやり方の提示
## 修正が必要なところ（あれば）
絶対に直さなければいけないところを列挙。指摘だけで済む場合など、修正点がない場合は無しでOK。`;

// Template processor for Handlebars-like syntax
function processTemplate(template: string, vars: Record<string, string | undefined>): string {
  let result = template;
  
  // Process conditionals: {{#if varName}}...{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
    return vars[varName] ? content : "";
  });
  
  // Process variables: {{varName}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return vars[varName] || "";
  });
  
  return result;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // ============================================
  // Chapter Routes
  // ============================================

  // Get all chapters with problem counts
  app.get("/api/chapters", async (req, res) => {
    try {
      const chapters = await storage.getChapters();
      res.json(chapters);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      res.status(500).json({ error: "チャプターの取得に失敗しました" });
    }
  });

  // Get all genres
  app.get("/api/genres", async (req, res) => {
    try {
      const genres = await storage.getGenres();
      res.json(genres);
    } catch (error) {
      console.error("Error fetching genres:", error);
      res.status(500).json({ error: "ジャンルの取得に失敗しました" });
    }
  });

  // Get a single chapter
  app.get("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "チャプターが見つかりません" });
      }
      res.json(chapter);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ error: "チャプターの取得に失敗しました" });
    }
  });

  // Create a new chapter
  app.post("/api/chapters", async (req, res) => {
    try {
      const parsed = insertChapterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "無効なデータです", details: parsed.error });
      }
      const chapter = await storage.createChapter(parsed.data);
      res.status(201).json(chapter);
    } catch (error) {
      console.error("Error creating chapter:", error);
      res.status(500).json({ error: "チャプターの作成に失敗しました" });
    }
  });

  // Update a chapter
  app.patch("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.updateChapter(req.params.id, req.body);
      if (!chapter) {
        return res.status(404).json({ error: "チャプターが見つかりません" });
      }
      res.json(chapter);
    } catch (error) {
      console.error("Error updating chapter:", error);
      res.status(500).json({ error: "チャプターの更新に失敗しました" });
    }
  });

  // Delete a chapter
  app.delete("/api/chapters/:id", async (req, res) => {
    try {
      await storage.deleteChapter(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting chapter:", error);
      res.status(500).json({ error: "チャプターの削除に失敗しました" });
    }
  });

  // Reorder chapters
  app.post("/api/chapters/reorder", async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderChapters(orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering chapters:", error);
      res.status(500).json({ error: "チャプターの並び替えに失敗しました" });
    }
  });

  // ============================================
  // Problem Routes
  // ============================================

  // Get problems for a chapter
  app.get("/api/chapters/:chapterId/problems", async (req, res) => {
    try {
      const problems = await storage.getProblems(req.params.chapterId);
      res.json(problems);
    } catch (error) {
      console.error("Error fetching problems:", error);
      res.status(500).json({ error: "問題の取得に失敗しました" });
    }
  });

  // Get a single problem with blocks
  app.get("/api/problems/:id", async (req, res) => {
    try {
      const problem = await storage.getProblemWithBlocks(req.params.id);
      if (!problem) {
        return res.status(404).json({ error: "問題が見つかりません" });
      }
      res.json(problem);
    } catch (error) {
      console.error("Error fetching problem:", error);
      res.status(500).json({ error: "問題の取得に失敗しました" });
    }
  });

  // Create a new problem
  app.post("/api/problems", async (req, res) => {
    try {
      const parsed = insertProblemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "無効なデータです", details: parsed.error });
      }
      const problem = await storage.createProblem(parsed.data);
      res.status(201).json(problem);
    } catch (error) {
      console.error("Error creating problem:", error);
      res.status(500).json({ error: "問題の作成に失敗しました" });
    }
  });

  // Update a problem
  app.patch("/api/problems/:id", async (req, res) => {
    try {
      const problem = await storage.updateProblem(req.params.id, req.body);
      if (!problem) {
        return res.status(404).json({ error: "問題が見つかりません" });
      }
      res.json(problem);
    } catch (error) {
      console.error("Error updating problem:", error);
      res.status(500).json({ error: "問題の更新に失敗しました" });
    }
  });

  // Delete a problem
  app.delete("/api/problems/:id", async (req, res) => {
    try {
      await storage.deleteProblem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting problem:", error);
      res.status(500).json({ error: "問題の削除に失敗しました" });
    }
  });

  // Reorder problems
  app.post("/api/problems/reorder", async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderProblems(orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering problems:", error);
      res.status(500).json({ error: "問題の並び替えに失敗しました" });
    }
  });

  // ============================================
  // Block Routes
  // ============================================

  // Get blocks for a problem
  app.get("/api/problems/:problemId/blocks", async (req, res) => {
    try {
      const blocks = await storage.getBlocks(req.params.problemId);
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching blocks:", error);
      res.status(500).json({ error: "ブロックの取得に失敗しました" });
    }
  });

  // Create a new block
  app.post("/api/blocks", async (req, res) => {
    try {
      const parsed = insertBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "無効なデータです", details: parsed.error });
      }
      const block = await storage.createBlock(parsed.data);
      res.status(201).json(block);
    } catch (error) {
      console.error("Error creating block:", error);
      res.status(500).json({ error: "ブロックの作成に失敗しました" });
    }
  });

  // Update a block
  app.patch("/api/blocks/:id", async (req, res) => {
    try {
      const block = await storage.updateBlock(req.params.id, req.body);
      if (!block) {
        return res.status(404).json({ error: "ブロックが見つかりません" });
      }
      res.json(block);
    } catch (error) {
      console.error("Error updating block:", error);
      res.status(500).json({ error: "ブロックの更新に失敗しました" });
    }
  });

  // Delete a block
  app.delete("/api/blocks/:id", async (req, res) => {
    try {
      await storage.deleteBlock(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting block:", error);
      res.status(500).json({ error: "ブロックの削除に失敗しました" });
    }
  });

  // Reorder blocks
  app.post("/api/blocks/reorder", async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderBlocks(orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering blocks:", error);
      res.status(500).json({ error: "ブロックの並び替えに失敗しました" });
    }
  });

  // ============================================
  // AI Routes
  // ============================================

  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { problem, code, imageUrl } = req.body;

      if (!problem) {
        return res.status(400).json({ error: "問題文が必要です" });
      }

      // Get custom prompt from database or use default
      const savedPrompt = await storage.getPrompt("explanation");
      const template = savedPrompt?.template || DEFAULT_EXPLANATION_TEMPLATE;

      const prompt = processTemplate(template, {
        problem,
        code,
        imageUrl,
      });

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

  // AI Code Review
  const reviewSchema = z.object({
    problem: z.string().min(1, "問題文が必要です").max(50000, "問題文が長すぎます"),
    modelCode: z.string().max(100000, "模範解答コードが長すぎます").optional(),
    explanation: z.string().max(50000, "解説文が長すぎます").optional(),
    reviewCode: z.string().min(1, "レビュー対象のコードが必要です").max(200000, "レビュー対象のコードが長すぎます"),
  });

  app.post("/api/ai/review", async (req, res) => {
    try {
      const parseResult = reviewSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessage = parseResult.error.errors[0]?.message || "入力が無効です";
        return res.status(400).json({ error: errorMessage });
      }
      const { problem, modelCode, explanation, reviewCode } = parseResult.data;

      // Get custom prompt from database or use default
      const savedPrompt = await storage.getPrompt("review");
      const template = savedPrompt?.template || DEFAULT_REVIEW_TEMPLATE;

      const prompt = processTemplate(template, {
        problem,
        modelCode,
        explanation,
        reviewCode,
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const review = response.text || "レビューを生成できませんでした。";

      res.json({ review });
    } catch (error) {
      console.error("AIレビュー生成エラー:", error);
      res.status(500).json({ error: "AIレビューの生成に失敗しました" });
    }
  });

  // ============================================
  // Prompt Routes
  // ============================================

  // Get all prompts
  app.get("/api/prompts", async (req, res) => {
    try {
      const promptList = await storage.getPrompts();
      res.json(promptList);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      res.status(500).json({ error: "プロンプトの取得に失敗しました" });
    }
  });

  // Get a single prompt
  app.get("/api/prompts/:id", async (req, res) => {
    try {
      const prompt = await storage.getPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ error: "プロンプトが見つかりません" });
      }
      res.json(prompt);
    } catch (error) {
      console.error("Error fetching prompt:", error);
      res.status(500).json({ error: "プロンプトの取得に失敗しました" });
    }
  });

  // Create or update a prompt
  app.put("/api/prompts/:id", async (req, res) => {
    try {
      const parseResult = insertPromptSchema.safeParse({
        ...req.body,
        id: req.params.id,
      });
      if (!parseResult.success) {
        return res.status(400).json({ error: "入力が無効です" });
      }
      const prompt = await storage.upsertPrompt(parseResult.data);
      res.json(prompt);
    } catch (error) {
      console.error("Error saving prompt:", error);
      res.status(500).json({ error: "プロンプトの保存に失敗しました" });
    }
  });

  // ============================================
  // AI Icon Generation Route
  // ============================================

  const iconGenerationSchema = z.object({
    title: z.string().min(1, "タイトルが必要です").max(200, "タイトルが長すぎます"),
    genre: z.string().max(100, "ジャンルが長すぎます").optional(),
    colorIndex: z.number().int().min(0).max(5).optional(),
  });

  // Background colors matching card gradients (using primary color as solid background)
  const thumbnailBackgrounds = [
    { color: "#FF8C42", name: "warm orange #FF8C42" },
    { color: "#FF6B9D", name: "soft pink #FF6B9D" },
    { color: "#4A90E2", name: "sky blue #4A90E2" },
    { color: "#9B59B6", name: "lavender purple #9B59B6" },
    { color: "#27AE60", name: "fresh green #27AE60" },
    { color: "#E74C3C", name: "coral red #E74C3C" },
  ];

  app.post("/api/ai/generate-icon", async (req, res) => {
    try {
      const parseResult = iconGenerationSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessage = parseResult.error.errors[0]?.message || "入力が無効です";
        return res.status(400).json({ error: errorMessage });
      }
      const { title, genre, colorIndex } = parseResult.data;

      const bgColor = thumbnailBackgrounds[(colorIndex ?? 0) % thumbnailBackgrounds.length];
      const prompt = `A cute round blob mascot character named "Codey" - a white colored blob with two simple black dot eyes, tiny pink blush circles on cheeks, small stubby arms and legs. Codey is doing an activity related to "${title}"${genre ? ` (${genre})` : ""}. Consistent character design: same white blob body, same facial features. Only the pose, accessories, and small outfit details change based on the topic. IMPORTANT LAYOUT: The character should be positioned in the LOWER HALF of the image, leaving the TOP 30-40% of the image as EMPTY SPACE. The character should be medium-sized (about 50-60% of the image width). Background: solid flat ${bgColor.name} color, single uniform color fill, no gradients, no patterns. Flat vector illustration, kawaii Japanese style, clean lines, soft shadows, no text no words no letters.`;

      const response = await imageAi.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

      if (!imagePart?.inlineData?.data) {
        return res.status(500).json({ error: "アイコンの生成に失敗しました" });
      }

      const imageBytes = imagePart.inlineData.data;

      // Save to object storage
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const objectPath = `${privateObjectDir}/icons/${objectId}.png`;

      // Parse bucket and object name
      const pathParts = objectPath.split("/").filter(Boolean);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Upload the image
      const buffer = Buffer.from(imageBytes, "base64");
      await file.save(buffer, {
        contentType: "image/png",
        metadata: {
          contentType: "image/png",
        },
      });

      // Set ACL to public
      await objectStorageService.trySetObjectEntityAclPolicy(
        `/objects/icons/${objectId}.png`,
        { owner: "system", visibility: "public" }
      );

      const iconUrl = `/objects/icons/${objectId}.png`;

      res.json({ iconUrl });
    } catch (error) {
      console.error("AIアイコン生成エラー:", error);
      res.status(500).json({ error: "AIアイコンの生成に失敗しました" });
    }
  });

  return httpServer;
}
