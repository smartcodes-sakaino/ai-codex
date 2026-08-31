import { useRef, useState } from "react";
import { Trash2, GripVertical, Image, Video, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, LessonBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api";
import { markdownVideoComponents } from "@/components/markdown-video";

interface LessonBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: LessonBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function LessonBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: LessonBlockProps) {
  const content = block.content as LessonBlockContent;
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inserts Markdown image syntax at the cursor position (or at the end, if the
  // textarea was never focused) rather than always appending to the end, so
  // media can be placed exactly where it belongs in the lesson text. Videos
  // reuse this same `![label](url)` syntax as images — markdownVideoComponents
  // (used wherever this markdown is rendered) tells them apart by the URL's
  // file extension at render time, so there's no separate syntax to maintain.
  const insertAtCursor = (insertion: string) => {
    const textarea = textareaRef.current;
    const markdown = content.markdown || "";

    if (textarea && document.activeElement === textarea) {
      const start = textarea.selectionStart ?? markdown.length;
      const end = textarea.selectionEnd ?? markdown.length;
      const next = markdown.slice(0, start) + insertion + markdown.slice(end);
      onUpdate({ ...content, markdown: next });
      requestAnimationFrame(() => {
        textarea.focus();
        const caret = start + insertion.length;
        textarea.setSelectionRange(caret, caret);
      });
    } else {
      const next = markdown ? `${markdown}\n\n${insertion}\n` : `${insertion}\n`;
      onUpdate({ ...content, markdown: next });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError("");
    setIsUploadingImage(true);
    try {
      const url = await uploadFile(file, "images");
      insertAtCursor(`![${file.name}](${url})`);
    } catch (error) {
      console.error("Lesson image upload error:", error);
      setImageError("画像のアップロードに失敗しました。");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError("");
    setIsUploadingVideo(true);
    try {
      const url = await uploadFile(file, "videos");
      insertAtCursor(`![${file.name}](${url})`);
    } catch (error) {
      console.error("Lesson video upload error:", error);
      setVideoError("動画のアップロードに失敗しました。");
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  if (!editMode) {
    return (
      <Card className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="text-sm font-medium">授業</span>
          </div>
        </CardHeader>
        <CardContent>
          {content.title && <h3 className="text-lg font-semibold mb-3">{content.title}</h3>}
          <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg">
            {content.markdown ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownVideoComponents}>
                {content.markdown}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">授業内容がありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <GripVertical className="h-4 w-4 cursor-grab" />
            <span className="text-sm font-medium">授業ブロック</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={isFirst}
              className="h-8 w-8"
              data-testid={`button-block-up-${block.id}`}
            >
              <span className="text-xs">↑</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={isLast}
              className="h-8 w-8"
              data-testid={`button-block-down-${block.id}`}
            >
              <span className="text-xs">↓</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-destructive"
              data-testid={`button-delete-block-${block.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>タイトル</Label>
          <Input
            value={content.title || ""}
            onChange={(e) => onUpdate({ ...content, title: e.target.value })}
            placeholder="授業のタイトルを入力してください..."
            data-testid={`input-lesson-title-${block.id}`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label>授業内容（Markdown）</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploadingImage}
                className="gap-2"
                data-testid={`button-insert-image-${block.id}`}
              >
                {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                画像を挿入
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploadingVideo}
                className="gap-2"
                data-testid={`button-insert-video-${block.id}`}
              >
                {isUploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                動画を挿入
              </Button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              data-testid={`input-lesson-image-upload-${block.id}`}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
              data-testid={`input-lesson-video-upload-${block.id}`}
            />
          </div>
          <Textarea
            ref={textareaRef}
            value={content.markdown || ""}
            onChange={(e) => onUpdate({ ...content, markdown: e.target.value })}
            placeholder="Markdown形式で授業内容を入力してください...&#10;&#10;「画像を挿入」「動画を挿入」ボタンでカーソル位置に差し込めます。"
            className="min-h-[250px] resize-y font-mono text-sm"
            data-testid={`textarea-lesson-markdown-${block.id}`}
          />
          {imageError && <p className="text-sm text-destructive">{imageError}</p>}
          {videoError && <p className="text-sm text-destructive">{videoError}</p>}
        </div>

        {content.markdown && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">プレビュー</Label>
            <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg border rounded-md p-4 bg-background/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownVideoComponents}>
                {content.markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
