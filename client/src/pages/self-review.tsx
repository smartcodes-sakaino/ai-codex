import { useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getSelfReviewInfo, submitSelfReview } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { CodeSubmissionInput, type CodeSubmissionInputHandle } from "@/components/code-submission-input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function SelfReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [code, setCode] = useState("");
  const [review, setReview] = useState("");
  const [verdict, setVerdict] = useState<"pass" | "fail" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<CodeSubmissionInputHandle>(null);

  const { data: info, isLoading: isInfoLoading, isError: isInfoError } = useQuery({
    queryKey: ["/api/self-review", token],
    queryFn: () => getSelfReviewInfo(token!),
    enabled: !!token,
  });

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError("レビュー対象のコードを入力してください");
      return;
    }

    setIsLoading(true);
    setError("");
    setReview("");

    try {
      const result = await submitSelfReview({ token: token!, reviewCode: code });
      setReview(result.review);
      setVerdict(result.verdict);
      // If this was opened by a logged-in learner, the server also recorded a
      // gating submission — refresh any cached roadmap/course-progress data so
      // a newly-unlocked next step shows up without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["/api/my/courses"] });
    } catch (err) {
      console.error("Self review error:", err);
      setError("セルフレビューの生成に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(review);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleReset = () => {
    inputRef.current?.reset();
    setReview("");
    setVerdict(null);
    setError("");
  };

  if (isInfoLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (isInfoError || !info) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">無効なリンクです</h1>
          <p className="text-muted-foreground">このセルフレビュー用リンクは存在しないか、無効です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" data-testid="text-chapter-title">{info.chapterTitle}</h1>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-problem-title">{info.problemTitle} - セルフレビュー</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-page-heading">セルフレビュー</h2>
          <p className="text-muted-foreground">
            課題「{info.problemTitle}」のコードを提出して、AIによるフィードバックを受けましょう。
          </p>
        </div>

        {!review ? (
          <div className="space-y-6">
            <CodeSubmissionInput ref={inputRef} onCodeChange={setCode} />

            {error && (
              <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !code.trim()}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              size="lg"
              data-testid="button-submit-self-review"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  セルフレビュー中...
                </>
              ) : (
                "セルフレビューを実行"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-lg font-semibold">レビュー結果</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyReview}
                  data-testid="button-copy-review"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      コピー
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  data-testid="button-review-another"
                >
                  別のコードをレビュー
                </Button>
              </div>
            </div>

            {verdict && (
              <div
                className={
                  "rounded-md px-4 py-3 font-bold text-sm " +
                  (verdict === "pass"
                    ? "bg-[#E3F5E6] text-[#2F9E44]"
                    : "bg-[#FDECEC] text-[#E03131]")
                }
                data-testid="text-self-review-verdict"
              >
                {verdict === "pass" ? "✓ 判定: 合格" : "✕ 判定: 不合格"}
              </div>
            )}

            <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/50 rounded-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
