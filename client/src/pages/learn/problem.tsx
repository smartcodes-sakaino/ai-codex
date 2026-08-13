import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { LearnerLayout } from "@/components/learner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchProblemWithBlocks } from "@/lib/api";
import {
  fetchMyRoadmap,
  fetchMySubmissions,
  fetchVideoProgress,
  saveVideoProgress,
  submitAnswer,
  type Submission,
} from "@/lib/lmsApi";
import { VideoPlayer } from "@/components/video-player";
import type { Block, ProblemBlockContent, VideoBlockContent } from "@shared/schema";

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

  useEffect(() => {
    setLastResult(submissions[submissions.length - 1] || null);
    if (submissions.length > 0) setCode(submissions[submissions.length - 1].code);
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

  const videoBlocks = problem?.blocks.filter((b) => b.type === "video") ?? [];

  const description =
    problem?.blocks
      .filter((b) => b.type === "problem")
      .map((b) => (b.content as ProblemBlockContent).text)
      .filter(Boolean)
      .join("\n\n") || "";

  const passed = lastResult?.verdict === "pass";
  const currentIndex = roadmap.findIndex((r) => r.problemId === problemId);
  const nextItem = roadmap[currentIndex + 1];

  return (
    <LearnerLayout title={problem?.title || "問題"} backHref={`/learn/courses/${courseId}`} backLabel="ロードマップへ">
      <div className="grid md:grid-cols-2 gap-5 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">問題文</CardTitle>
          </CardHeader>
          <CardContent>
            {videoBlocks.map((b) => (
              <LearnerVideoBlock key={b.id} block={b} />
            ))}
            {description && (
              <p className="text-sm whitespace-pre-wrap leading-relaxed mb-4">{description}</p>
            )}
            <div className="space-y-2">
              <Label>回答コード</Label>
              <Textarea
                rows={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm"
                placeholder="ここにコードを書いて提出してください"
                data-testid="textarea-answer-code"
              />
            </div>
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

                {passed &&
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
    </LearnerLayout>
  );
}

function LearnerVideoBlock({ block }: { block: Block }) {
  const v = block.content as VideoBlockContent;

  const { data: initialTime } = useQuery({
    queryKey: ["/api/my/video-progress", block.id],
    queryFn: () => fetchVideoProgress(block.id),
  });

  return (
    <div className="mb-4 space-y-2">
      {v.title && <h3 className="text-base font-semibold">{v.title}</h3>}
      {v.videoObjectPath && (
        <VideoPlayer
          src={v.videoObjectPath}
          title={v.title}
          initialTime={initialTime}
          onProgress={(seconds) => {
            saveVideoProgress(block.id, seconds).catch((err) => console.error("Failed to save video progress:", err));
          }}
        />
      )}
      {v.description && <p className="text-sm whitespace-pre-wrap leading-relaxed">{v.description}</p>}
    </div>
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
