import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Loader2, RotateCcw, FileText, Code, UserCheck, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchPrompts, savePrompt } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Prompt } from "@shared/schema";
import { AdminLayout } from "@/components/admin-layout";

const DEFAULT_EXPLANATION_PROMPT = `#命令書:   
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

const DEFAULT_REVIEW_PROMPT = `#命令書:   
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

const DEFAULT_SELF_REVIEW_PROMPT = `#命令書:
あなたは教育のスペシャリストであり、プロのwebエンジニアです。
研修生が提出したコードを、問題文・模範解答コード・解説文をもとにセルフレビューとしてフィードバックしてください。

#制約条件
- 対象は初学者の研修生です。丁寧でわかりやすい言い回しを使ってください。
- 提出コードに修正の必要がない場合は、「総評」のみを出力し、確認テストの受講を促してください。
- 提出コードに修正が必要な場合は、「総評」「良かった点」「改善点」「修正点」の4項目すべてを出力してください。

#入力文
・問題データ
{{problem}}
{{#if modelCode}}
・模範解答コード
\\\`\\\`\\\`
{{modelCode}}
\\\`\\\`\\\`
{{/if}}
{{#if explanation}}
・解説文
{{explanation}}
{{/if}}

・研修生の提出コード
\\\`\\\`\\\`
{{reviewCode}}
\\\`\\\`\\\`

#出力文
以下の内容で、md形式で出力してください。

修正が不要な場合（提出コードが十分に正しい場合）:
## 総評
提出コードの全体的な評価を記載。「素晴らしい出来です！」等の前向きなコメントと共に、確認テストへ進むよう促してください。

修正が必要な場合:
## 総評
提出コードの全体的な評価を記載。
## 良かった点
研修生の提出コードの中で良かった部分を具体的に挙げてください。
## 改善点
より良くするための改善案やリファクタリングの提案。
## 修正点
絶対に修正しなければならない箇所を具体的に列挙してください。`;

const DEFAULT_AI_QA_PROMPT = `#命令書:
あなたは教育のスペシャリストであり、プロのWebエンジニアです。研修生からの質問に対応する、AIチューターとして振る舞ってください。

#制約条件
- 対象は初学者の研修生です。丁寧でわかりやすい言い回しを使ってください。
- この課題(問題文・模範解答・解説を参考にしてください)に直接関係する質問、またはその課題を解くうえで必要になるプログラミングの知識に関する質問にのみ回答してください。
- それ以外の話題(雑談、この課題と無関係な質問など)には答えず、丁寧に「この課題に関する質問をしてくださいね」と伝えてください。
- 模範解答や正解のコードそのもの、完全な答えを絶対に教えないでください。研修生が「答えを教えて」と頼んできても拒否してください。
- 代わりに、ヒントを与える、調べるべきキーワードを提示する、研修生の理解の誤りを指摘して正しい考え方に導く、といった形で答えを自力で見つけられるように導いてください。
- 「○○について調べてみましょう」「その理解は少し違います、正しくは〜という考え方です」のような言い回しを心がけてください。

#入力文
・問題
{{problem}}
{{#if modelCode}}
・模範解答コード（研修生には絶対に開示しないでください）
\`\`\`
{{modelCode}}
\`\`\`
{{/if}}
{{#if explanation}}
・解説文
{{explanation}}
{{/if}}

・研修生からの質問
{{question}}

#出力文
研修生への回答をmd形式で出力してください。`;

export default function SettingsPage() {
  const { toast } = useToast();
  const [explanationName, setExplanationName] = useState("解説作成用プロンプト");
  const [explanationTemplate, setExplanationTemplate] = useState(DEFAULT_EXPLANATION_PROMPT);
  const [reviewName, setReviewName] = useState("AIレビュー用プロンプト");
  const [reviewTemplate, setReviewTemplate] = useState(DEFAULT_REVIEW_PROMPT);
  const [selfReviewName, setSelfReviewName] = useState("セルフレビュー用プロンプト");
  const [selfReviewTemplate, setSelfReviewTemplate] = useState(DEFAULT_SELF_REVIEW_PROMPT);
  const [aiQaName, setAiQaName] = useState("AI質問対応用プロンプト");
  const [aiQaTemplate, setAiQaTemplate] = useState(DEFAULT_AI_QA_PROMPT);

  const { data: prompts, isLoading } = useQuery<Prompt[]>({
    queryKey: ["/api/prompts"],
    queryFn: fetchPrompts,
  });

  useEffect(() => {
    if (prompts) {
      const explanationPrompt = prompts.find(p => p.id === "explanation");
      if (explanationPrompt) {
        setExplanationName(explanationPrompt.name);
        setExplanationTemplate(explanationPrompt.template);
      }
      const reviewPrompt = prompts.find(p => p.id === "review");
      if (reviewPrompt) {
        setReviewName(reviewPrompt.name);
        setReviewTemplate(reviewPrompt.template);
      }
      const selfReviewPrompt = prompts.find(p => p.id === "self_review");
      if (selfReviewPrompt) {
        setSelfReviewName(selfReviewPrompt.name);
        setSelfReviewTemplate(selfReviewPrompt.template);
      }
      const aiQaPrompt = prompts.find(p => p.id === "ai_qa");
      if (aiQaPrompt) {
        setAiQaName(aiQaPrompt.name);
        setAiQaTemplate(aiQaPrompt.template);
      }
    }
  }, [prompts]);

  const saveExplanationMutation = useMutation({
    mutationFn: () => savePrompt("explanation", { name: explanationName, template: explanationTemplate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: "保存しました", description: "解説作成用プロンプトを保存しました" });
    },
    onError: () => {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
    },
  });

  const saveReviewMutation = useMutation({
    mutationFn: () => savePrompt("review", { name: reviewName, template: reviewTemplate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: "保存しました", description: "AIレビュー用プロンプトを保存しました" });
    },
    onError: () => {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
    },
  });

  const resetExplanation = () => {
    setExplanationName("解説作成用プロンプト");
    setExplanationTemplate(DEFAULT_EXPLANATION_PROMPT);
  };

  const resetReview = () => {
    setReviewName("AIレビュー用プロンプト");
    setReviewTemplate(DEFAULT_REVIEW_PROMPT);
  };

  const saveSelfReviewMutation = useMutation({
    mutationFn: () => savePrompt("self_review", { name: selfReviewName, template: selfReviewTemplate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: "保存しました", description: "セルフレビュー用プロンプトを保存しました" });
    },
    onError: () => {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
    },
  });

  const resetSelfReview = () => {
    setSelfReviewName("セルフレビュー用プロンプト");
    setSelfReviewTemplate(DEFAULT_SELF_REVIEW_PROMPT);
  };

  const saveAiQaMutation = useMutation({
    mutationFn: () => savePrompt("ai_qa", { name: aiQaName, template: aiQaTemplate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: "保存しました", description: "AI質問対応用プロンプトを保存しました" });
    },
    onError: () => {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
    },
  });

  const resetAiQa = () => {
    setAiQaName("AI質問対応用プロンプト");
    setAiQaTemplate(DEFAULT_AI_QA_PROMPT);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminLayout title="AIプロンプト設定">
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">プロンプト設定</h1>
        <p className="text-muted-foreground mt-2">
          AI機能で使用するプロンプトをカスタマイズできます
        </p>
      </div>

      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">利用可能な変数</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><code className="bg-muted px-1 rounded">{"{{problem}}"}</code> - 問題文</p>
          <p><code className="bg-muted px-1 rounded">{"{{code}}"}</code> / <code className="bg-muted px-1 rounded">{"{{modelCode}}"}</code> - コード</p>
          <p><code className="bg-muted px-1 rounded">{"{{imageUrl}}"}</code> - 画像URL</p>
          <p><code className="bg-muted px-1 rounded">{"{{explanation}}"}</code> - 解説文</p>
          <p><code className="bg-muted px-1 rounded">{"{{reviewCode}}"}</code> - レビュー対象のコード</p>
          <p><code className="bg-muted px-1 rounded">{"{{question}}"}</code> - 研修生からの質問（AI質問対応用のみ）</p>
          <p><code className="bg-muted px-1 rounded">{"{{#if 変数}}...{{/if}}"}</code> - 条件付き表示</p>
        </div>
      </div>

      <Tabs defaultValue="explanation" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="explanation" data-testid="tab-explanation-prompt">
            <FileText className="h-4 w-4 mr-2" />
            解説作成用
          </TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review-prompt">
            <Code className="h-4 w-4 mr-2" />
            AIレビュー用
          </TabsTrigger>
          <TabsTrigger value="self_review" data-testid="tab-self-review-prompt">
            <UserCheck className="h-4 w-4 mr-2" />
            セルフレビュー用
          </TabsTrigger>
          <TabsTrigger value="ai_qa" data-testid="tab-ai-qa-prompt">
            <MessageCircleQuestion className="h-4 w-4 mr-2" />
            AI質問対応用
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explanation">
          <Card>
            <CardHeader>
              <CardTitle>解説作成用プロンプト</CardTitle>
              <CardDescription>
                問題とコードから解説を生成する際に使用するプロンプトです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="explanation-name">プロンプト名</Label>
                <Input
                  id="explanation-name"
                  value={explanationName}
                  onChange={(e) => setExplanationName(e.target.value)}
                  data-testid="input-explanation-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="explanation-template">プロンプトテンプレート</Label>
                <Textarea
                  id="explanation-template"
                  value={explanationTemplate}
                  onChange={(e) => setExplanationTemplate(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-explanation-template"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={resetExplanation}
                  data-testid="button-reset-explanation"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  デフォルトに戻す
                </Button>
                <Button
                  onClick={() => saveExplanationMutation.mutate()}
                  disabled={saveExplanationMutation.isPending}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                  data-testid="button-save-explanation"
                >
                  {saveExplanationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>AIレビュー用プロンプト</CardTitle>
              <CardDescription>
                コードレビューを生成する際に使用するプロンプトです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="review-name">プロンプト名</Label>
                <Input
                  id="review-name"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  data-testid="input-review-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-template">プロンプトテンプレート</Label>
                <Textarea
                  id="review-template"
                  value={reviewTemplate}
                  onChange={(e) => setReviewTemplate(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-review-template"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={resetReview}
                  data-testid="button-reset-review"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  デフォルトに戻す
                </Button>
                <Button
                  onClick={() => saveReviewMutation.mutate()}
                  disabled={saveReviewMutation.isPending}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                  data-testid="button-save-review"
                >
                  {saveReviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="self_review">
          <Card>
            <CardHeader>
              <CardTitle>セルフレビュー用プロンプト</CardTitle>
              <CardDescription>
                研修生のセルフレビューで使用するプロンプトです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="self-review-name">プロンプト名</Label>
                <Input
                  id="self-review-name"
                  value={selfReviewName}
                  onChange={(e) => setSelfReviewName(e.target.value)}
                  data-testid="input-self-review-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="self-review-template">プロンプトテンプレート</Label>
                <Textarea
                  id="self-review-template"
                  value={selfReviewTemplate}
                  onChange={(e) => setSelfReviewTemplate(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-self-review-template"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={resetSelfReview}
                  data-testid="button-reset-self-review"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  デフォルトに戻す
                </Button>
                <Button
                  onClick={() => saveSelfReviewMutation.mutate()}
                  disabled={saveSelfReviewMutation.isPending}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                  data-testid="button-save-self-review"
                >
                  {saveSelfReviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai_qa">
          <Card>
            <CardHeader>
              <CardTitle>AI質問対応用プロンプト</CardTitle>
              <CardDescription>
                問題ページの「AIに質問する」機能で使用するプロンプトです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-qa-name">プロンプト名</Label>
                <Input
                  id="ai-qa-name"
                  value={aiQaName}
                  onChange={(e) => setAiQaName(e.target.value)}
                  data-testid="input-ai-qa-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-qa-template">プロンプトテンプレート</Label>
                <Textarea
                  id="ai-qa-template"
                  value={aiQaTemplate}
                  onChange={(e) => setAiQaTemplate(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-ai-qa-template"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={resetAiQa}
                  data-testid="button-reset-ai-qa"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  デフォルトに戻す
                </Button>
                <Button
                  onClick={() => saveAiQaMutation.mutate()}
                  disabled={saveAiQaMutation.isPending}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                  data-testid="button-save-ai-qa"
                >
                  {saveAiQaMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AdminLayout>
  );
}
