import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LearnerLayout } from "@/components/learner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileArchive, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchProblemWithBlocks, getSelfReviewLinkByProblemId } from "@/lib/api";
import {
  fetchMyRoadmap,
  fetchMySubmissions,
  fetchVideoProgress,
  saveVideoProgress,
  submitAnswer,
  type Submission,
} from "@/lib/lmsApi";
import { VideoPlayer } from "@/components/video-player";
import { CodeSubmissionInput } from "@/components/code-submission-input";
import type { Block, ProblemBlockContent, VideoBlockContent, LessonBlockContent, FileBlockContent } from "@shared/schema";

export default function LearnerProblemPage() {
  const { id: courseId, problemId } = useParams<{ id: string; problemId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const { data: problem } = useQuery({
    queryKey: ["/api/problems", problemId],
    queryFn: () => fetchProblemWithBlocks(problemId),
    enabled: !!problemId,
  });

  const { data: roadmap = [] } = useQuery({
    queryKey: ["/api/my/courses", courseId, "roadmap"],
    queryFn: () => fetchMyRoadmap(courseId),
    enabled: !!courseId,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["/api/my/courses", courseId, "problems", problemId, "submissions"],
    queryFn: () => fetchMySubmissions(courseId, problemId),
    enabled: !!courseId && !!problemId,
  });

  const [lastResult, setLastResult] = useState<Submission | null>(null);
  const lastSubmittedCode = submissions[submissions.length - 1]?.code;

  useEffect(() => {
    setLastResult(submissions[submissions.length - 1] || null);
  }, [submissions]);

  const submitMutation = useMutation({
    mutationFn: () => submitAnswer(courseId, problemId, code),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/courses", courseId, "problems", problemId, "submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/courses", courseId, "roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/courses"] });
      setLastResult({
        id: "pending",
        code,
        verdict: result.verdict,
        aiSummary: result.summary,
        aiGood: result.good,
        aiImprove: result.improve,
        aiMustFix: result.mustFix,
        attemptNumber: submissions.length + 1,
        submittedAt: new Date().toISOString(),
      });
      toast({ title: result.verdict === "pass" ? "合格しました！" : "不合格でした。フィードバックを確認してください" });
    },
    onError: () => {
      toast({ title: "採点中にエラーが発生しました。もう一度お試しください", variant: "destructive" });
    },
  });

  const lessonBlocks = problem?.blocks.filter((b) => b.type === "lesson") ?? [];
  const fileBlocks = problem?.blocks.filter((b) => b.type === "file") ?? [];
  const videoBlocks = problem?.blocks.filter((b) => b.type === "video") ?? [];

  const description =
    problem?.blocks
      .filter((b) => b.type === "problem")
      .map((b) => (b.content as ProblemBlockContent).text)
      .filter(Boolean)
      .join("\n\n") || "";

  const { data: selfReviewLink } = useQuery({
    queryKey: ["/api/self-review-links/problem", problemId],
    queryFn: () => getSelfReviewLinkByProblemId(problemId!),
    enabled: !!problemId,
  });

  const currentIndex = roadmap.findIndex((r) => r.problemId === problemId);
  const nextItem = roadmap[currentIndex + 1];
  const gate = roadmap[currentIndex]?.gate;
  // Whether *this specific problem* is actually cleared — driven by whichever
  // gate applies (self-review / video / submission), not just the last code
  // submission's own verdict, since a passing submission doesn't unlock
  // anything when the real gate is a self-review or a fully-watched video.
  const canAdvance = roadmap[currentIndex]?.status === "done";

  return (
    <LearnerLayout title={problem?.title || "問題"} backHref={`/learn/courses/${courseId}`} backLabel="ロードマップへ">
      {lessonBlocks.length > 0 && (
        <div className="space-y-4 mb-5">
          {lessonBlocks.map((b) => (
            <LearnerLessonBlock key={b.id} block={b} />
          ))}
        </div>
      )}

      {videoBlocks.length > 0 && (
        <div className="space-y-5 mb-5">
          {videoBlocks.map((b) => (
            <LearnerVideoBlock key={b.id} block={b} courseId={courseId} />
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">問題文</CardTitle>
          </CardHeader>
          <CardContent>
            {description && (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-img:rounded-lg mb-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
              </div>
            )}
            {fileBlocks.length > 0 && (
              <div className="space-y-2 mb-4">
                {fileBlocks.map((b) => (
                  <LearnerFileBlock key={b.id} block={b} />
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>回答コード</Label>
              <CodeSubmissionInput onCodeChange={setCode} initialCode={lastSubmittedCode} />
            </div>
            {gate && gate !== "submission" && (
              <p className="text-xs text-muted-foreground mt-2">
                {gate === "self_review"
                  ? "この問題は下のセルフレビューに合格すると次に進めます。コード提出は任意の練習です。"
                  : "この問題は動画を最後まで視聴すると次に進めます。コード提出は任意の練習です。"}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Button
                className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !code.trim()}
                data-testid="button-submit-answer"
              >
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {submissions.length > 0 ? "再提出する" : "提出する"}
              </Button>
              {submissions.length > 0 && (
                <span className="text-xs text-muted-foreground">これまでの挑戦回数: {submissions.length}回</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AIレビュー結果</CardTitle>
          </CardHeader>
          <CardContent>
            {!lastResult ? (
              <p className="text-sm text-muted-foreground">まだ提出がありません。左のフォームからコードを提出してください。</p>
            ) : (
              <>
                <div
                  className={
                    "rounded-md px-4 py-3 mb-4 font-bold text-sm " +
                    (lastResult.verdict === "pass"
                      ? "bg-[#E3F5E6] text-[#2F9E44]"
                      : "bg-[#FDECEC] text-[#E03131]")
                  }
                  data-testid="text-verdict"
                >
                  {lastResult.verdict === "pass" ? "✓ 判定: 合格" : "✕ 判定: 不合格"}
                </div>
                <FeedbackSection title="総評" text={lastResult.aiSummary} />
                <FeedbackSection title="良かった点" text={lastResult.aiGood} />
                <FeedbackSection title="改善点" text={lastResult.aiImprove} />
                <FeedbackSection title="修正が必要な点" text={lastResult.aiMustFix} />

                {canAdvance &&
                  (nextItem ? (
                    <Link href={`/learn/courses/${courseId}/problems/${nextItem.problemId}`}>
                      <Button className="mt-2 bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white" data-testid="button-next-problem">
                        次の問題へ →
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="mt-2 bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                      onClick={() => navigate(`/learn/courses/${courseId}/certificate`)}
                      data-testid="button-view-certificate-from-problem"
                    >
                      修了証を見る 🎓
                    </Button>
                  ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selfReviewLink && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              セルフレビュー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              コードを提出してAIによるセルフレビューを受けましょう。
              {gate === "self_review" && "合格すると次に進めます。"}
            </p>
            <Link href={`/self-review/${selfReviewLink.token}`}>
              <Button variant="outline" className="gap-2" data-testid="button-go-to-self-review">
                <ClipboardCheck className="h-4 w-4" />
                セルフレビューを行う
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </LearnerLayout>
  );
}

function LearnerLessonBlock({ block }: { block: Block }) {
  const content = block.content as LessonBlockContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{content.title || "授業"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-img:rounded-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.markdown || ""}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

function LearnerFileBlock({ block }: { block: Block }) {
  const content = block.content as FileBlockContent;
  if (!content.fileObjectPath) return null;
  return (
    <a
      href={content.fileObjectPath}
      download={content.fileName}
      className="flex items-center gap-2 text-sm rounded-md border p-3 hover-elevate"
      data-testid={`link-download-file-${block.id}`}
    >
      <FileArchive className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{content.title || content.fileName || "ファイルをダウンロード"}</span>
    </a>
  );
}

function LearnerVideoBlock({ block, courseId }: { block: Block; courseId?: string }) {
  const v = block.content as VideoBlockContent;
  const lastPositionRef = useRef(0);

  const { data: initialTime } = useQuery({
    queryKey: ["/api/my/video-progress", block.id],
    queryFn: () => fetchVideoProgress(block.id),
  });

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {v.title && <h3 className="text-lg font-semibold">{v.title}</h3>}
        {v.videoObjectPath && (
          <VideoPlayer
            src={v.videoObjectPath}
            title={v.title}
            className="max-w-4xl mx-auto"
            initialTime={initialTime}
            onProgress={(seconds) => {
              lastPositionRef.current = seconds;
              saveVideoProgress(block.id, seconds).catch((err) => console.error("Failed to save video progress:", err));
            }}
            onComplete={() => {
              saveVideoProgress(block.id, lastPositionRef.current, true)
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/my/courses", courseId, "roadmap"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/my/courses"] });
                })
                .catch((err) => console.error("Failed to save video completion:", err));
            }}
          />
        )}
        {v.description && <p className="text-sm whitespace-pre-wrap leading-relaxed">{v.description}</p>}
      </CardContent>
    </Card>
  );
}

function FeedbackSection({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">{title}</h4>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}
