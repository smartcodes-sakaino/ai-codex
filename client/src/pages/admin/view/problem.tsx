import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LearnerLayout } from "@/components/learner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileArchive } from "lucide-react";
import { fetchProblemWithBlocks } from "@/lib/api";
import { fetchAdminViewRoadmap } from "@/lib/lmsApi";
import { CodeBlock } from "@/components/blocks/code-block";
import { TextBlock } from "@/components/blocks/text-block";
import type { Block, ProblemBlockContent, VideoBlockContent, LessonBlockContent, FileBlockContent } from "@shared/schema";

const GATE_LABEL: Record<string, string> = {
  self_review: "この問題はセルフレビューに合格すると次に進めます。",
  video: "この問題は動画を最後まで視聴すると次に進めます。",
  submission: "この問題はコード提出のAI判定に合格すると次に進めます。",
};

// The instructor-facing counterpart to the learner problem page: same
// lesson/video/file/problem content, but in place of the answer input and
// AI review result — which only make sense for a learner's own attempt —
// it shows the model answer (code blocks) and AI解説 (text blocks) that the
// learner-facing page never renders at all.
export default function AdminViewProblemPage() {
  const { id: courseId, problemId } = useParams<{ id: string; problemId: string }>();

  const { data: problem } = useQuery({
    queryKey: ["/api/problems", problemId],
    queryFn: () => fetchProblemWithBlocks(problemId),
    enabled: !!problemId,
  });

  const { data: roadmap = [] } = useQuery({
    queryKey: ["/api/admin/view/courses", courseId, "roadmap"],
    queryFn: () => fetchAdminViewRoadmap(courseId!),
    enabled: !!courseId,
  });

  const gate = roadmap.find((r) => r.problemId === problemId)?.gate;

  const lessonBlocks = problem?.blocks.filter((b) => b.type === "lesson") ?? [];
  const fileBlocks = problem?.blocks.filter((b) => b.type === "file") ?? [];
  const videoBlocks = problem?.blocks.filter((b) => b.type === "video") ?? [];
  const codeBlocks = problem?.blocks.filter((b) => b.type === "code") ?? [];
  const textBlocks = problem?.blocks.filter((b) => b.type === "text") ?? [];

  const description =
    problem?.blocks
      .filter((b) => b.type === "problem")
      .map((b) => (b.content as ProblemBlockContent).text)
      .filter(Boolean)
      .join("\n\n") || "";

  return (
    <LearnerLayout
      title={problem?.title || "問題"}
      backHref={`/admin/view/courses/${courseId}`}
      backLabel="ロードマップへ"
    >
      {lessonBlocks.length > 0 && (
        <div className="space-y-4 mb-5">
          {lessonBlocks.map((b) => (
            <AdminViewLessonBlock key={b.id} block={b} />
          ))}
        </div>
      )}

      {videoBlocks.length > 0 && (
        <div className="space-y-5 mb-5">
          {videoBlocks.map((b) => (
            <AdminViewVideoBlock key={b.id} block={b} />
          ))}
        </div>
      )}

      <Card className="mb-5">
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
            <div className="space-y-2">
              {fileBlocks.map((b) => (
                <AdminViewFileBlock key={b.id} block={b} />
              ))}
            </div>
          )}
          {gate && (
            <p className="text-xs text-muted-foreground mt-2">{GATE_LABEL[gate]}（受講者ビューでの条件）</p>
          )}
        </CardContent>
      </Card>

      {codeBlocks.length > 0 && (
        <div className="mb-5 space-y-3">
          <h2 className="text-sm font-bold">模範解答</h2>
          {codeBlocks.map((b) => (
            <CodeBlock
              key={b.id}
              block={b}
              editMode={false}
              onUpdate={() => {}}
              onDelete={() => {}}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              isFirst
              isLast
            />
          ))}
        </div>
      )}

      {textBlocks.length > 0 && (
        <div className="mb-5 space-y-3">
          <h2 className="text-sm font-bold">AI解説</h2>
          {textBlocks.map((b) => (
            <TextBlock
              key={b.id}
              block={b}
              editMode={false}
              onUpdate={() => {}}
              onDelete={() => {}}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              isFirst
              isLast
              problemBlocks={[]}
              codeBlocks={[]}
            />
          ))}
        </div>
      )}

      {codeBlocks.length === 0 && textBlocks.length === 0 && (
        <p className="text-sm text-muted-foreground">この問題には模範解答・AI解説が登録されていません。</p>
      )}
    </LearnerLayout>
  );
}

function AdminViewLessonBlock({ block }: { block: Block }) {
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

function AdminViewFileBlock({ block }: { block: Block }) {
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

// Plain <video>, not the restricted learner <VideoPlayer> — an instructor
// previewing content has no reason to be blocked from seeking around, and
// there's no per-user progress to save here.
function AdminViewVideoBlock({ block }: { block: Block }) {
  const v = block.content as VideoBlockContent;
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {v.title && <h3 className="text-lg font-semibold">{v.title}</h3>}
        {v.videoObjectPath && (
          <video
            src={v.videoObjectPath}
            controls
            className="w-full max-w-4xl mx-auto rounded-lg"
            data-testid={`video-admin-view-${block.id}`}
          />
        )}
        {v.description && <p className="text-sm whitespace-pre-wrap leading-relaxed">{v.description}</p>}
      </CardContent>
    </Card>
  );
}
