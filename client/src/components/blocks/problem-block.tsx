import { useState, useRef } from "react";
import { Trash2, Upload, X, Video, GripVertical, Link, FileVideo, Loader2, Image } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, ProblemBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api";

interface ProblemBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: ProblemBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function ProblemBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ProblemBlockProps) {
  const content = block.content as ProblemBlockContent;
  const [videoInput, setVideoInput] = useState("");
  const [videoError, setVideoError] = useState("");
  const [imageError, setImageError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const [inlineImageError, setInlineImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

  const isLocalVideo = (url: string) => url.startsWith("data:video/") || url.startsWith("/objects/");

  const handleTextChange = (text: string) => {
    onUpdate({ ...content, text });
  };

  // Inserts Markdown image syntax at the cursor position (or at the end, if the
  // textarea was never focused), separate from the "画像" gallery below — this
  // embeds the image inline in the problem text itself, at a chosen spot.
  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInlineImageError("");
    setIsUploadingInlineImage(true);
    try {
      const url = await uploadFile(file, "images");
      const textarea = textareaRef.current;
      const text = content.text || "";
      const insertion = `![${file.name}](${url})`;

      if (textarea && document.activeElement === textarea) {
        const start = textarea.selectionStart ?? text.length;
        const end = textarea.selectionEnd ?? text.length;
        const next = text.slice(0, start) + insertion + text.slice(end);
        onUpdate({ ...content, text: next });
        requestAnimationFrame(() => {
          textarea.focus();
          const caret = start + insertion.length;
          textarea.setSelectionRange(caret, caret);
        });
      } else {
        const next = text ? `${text}\n\n${insertion}\n` : `${insertion}\n`;
        onUpdate({ ...content, text: next });
      }
    } catch (error) {
      console.error("Inline image upload error:", error);
      setInlineImageError("画像のアップロードに失敗しました。");
    } finally {
      setIsUploadingInlineImage(false);
      if (inlineImageInputRef.current) inlineImageInputRef.current.value = "";
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setImageError("");
    setIsUploadingImage(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_IMAGE_SIZE) {
          setImageError(`画像サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。10MB以下の画像を選択してください。`);
          continue;
        }
        const url = await uploadFile(file);
        uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        onUpdate({
          ...content,
          images: [...(content.images || []), ...uploadedUrls],
        });
      }
    } catch (error) {
      console.error("Image upload error:", error);
      setImageError("画像のアップロードに失敗しました。");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...(content.images || [])];
    newImages.splice(index, 1);
    onUpdate({ ...content, images: newImages });
  };

  const handleAddVideo = () => {
    if (videoInput.trim()) {
      let embedUrl = videoInput.trim();
      if (embedUrl.includes("youtube.com/watch")) {
        const videoId = new URL(embedUrl).searchParams.get("v");
        if (videoId) {
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }
      } else if (embedUrl.includes("youtu.be")) {
        const videoId = embedUrl.split("/").pop();
        if (videoId) {
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }
      } else if (embedUrl.includes("vimeo.com")) {
        const videoId = embedUrl.split("/").pop();
        if (videoId) {
          embedUrl = `https://player.vimeo.com/video/${videoId}`;
        }
      }
      onUpdate({ ...content, videoUrl: embedUrl });
      setVideoInput("");
    }
  };

  const handleRemoveVideo = () => {
    onUpdate({ ...content, videoUrl: undefined });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError("");

    if (file.size > MAX_VIDEO_SIZE) {
      setVideoError(`動画サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。50MB以下の動画を選択してください。`);
      return;
    }

    setIsUploadingVideo(true);
    try {
      const url = await uploadFile(file);
      onUpdate({ ...content, videoUrl: url });
    } catch (error) {
      console.error("Video upload error:", error);
      setVideoError("動画のアップロードに失敗しました。");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  if (!editMode) {
    return (
      <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <span className="text-sm font-medium">問題</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg">
            {content.text ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">問題文がありません</p>
            )}
          </div>
          {content.images && content.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {content.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`問題画像 ${idx + 1}`}
                  className="rounded-lg w-full h-auto object-cover"
                />
              ))}
            </div>
          )}
          {content.videoUrl && (
            <div className="aspect-video rounded-lg overflow-hidden">
              {isLocalVideo(content.videoUrl) ? (
                <video
                  src={content.videoUrl}
                  className="w-full h-full"
                  controls
                  title="動画"
                />
              ) : (
                <iframe
                  src={content.videoUrl}
                  className="w-full h-full"
                  allowFullScreen
                  title="動画"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <GripVertical className="h-4 w-4 cursor-grab" />
            <span className="text-sm font-medium">問題ブロック</span>
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
          <div className="flex items-center justify-between">
            <Label>問題文（Markdown）</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inlineImageInputRef.current?.click()}
              disabled={isUploadingInlineImage}
              className="gap-2"
              data-testid={`button-insert-inline-image-${block.id}`}
            >
              {isUploadingInlineImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
              画像を挿入
            </Button>
            <input
              ref={inlineImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleInlineImageUpload}
              className="hidden"
              data-testid={`input-inline-image-upload-${block.id}`}
            />
          </div>
          <Textarea
            ref={textareaRef}
            value={content.text || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="問題文をMarkdown形式で入力してください...&#10;&#10;「画像を挿入」ボタンでカーソル位置に画像を差し込めます。"
            className="min-h-[120px] resize-y"
            data-testid={`textarea-problem-${block.id}`}
          />
          {inlineImageError && <p className="text-sm text-destructive">{inlineImageError}</p>}
        </div>

        {content.text && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">プレビュー</Label>
            <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg border rounded-md p-4 bg-background/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>画像ギャラリー（本文とは別に一覧表示されます）</Label>
          <div
            className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors ${isUploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingImage ? (
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              {isUploadingImage ? 'アップロード中...' : 'クリックまたはドラッグ＆ドロップで画像をアップロード'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              data-testid={`input-image-upload-${block.id}`}
            />
          </div>
          {imageError && (
            <p className="text-sm text-destructive">{imageError}</p>
          )}
          {content.images && content.images.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {content.images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt={`アップロード画像 ${idx + 1}`}
                    className="rounded-lg w-full h-20 object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(idx)}
                    data-testid={`button-remove-image-${block.id}-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>動画</Label>
          {content.videoUrl ? (
            <div className="space-y-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                {isLocalVideo(content.videoUrl) ? (
                  <video
                    src={content.videoUrl}
                    className="w-full h-full"
                    controls
                    title="動画プレビュー"
                  />
                ) : (
                  <iframe
                    src={content.videoUrl}
                    className="w-full h-full"
                    allowFullScreen
                    title="動画プレビュー"
                  />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveVideo}
                className="text-destructive"
                data-testid={`button-remove-video-${block.id}`}
              >
                <X className="h-4 w-4 mr-1" />
                動画を削除
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors ${isUploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => videoInputRef.current?.click()}
              >
                {isUploadingVideo ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                ) : (
                  <FileVideo className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  {isUploadingVideo ? 'アップロード中...' : 'クリックして動画をアップロード（50MB以下）'}
                </p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  data-testid={`input-video-upload-${block.id}`}
                />
              </div>
              {videoError && (
                <p className="text-sm text-destructive">{videoError}</p>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">または</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-2">
                <Input
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder="YouTube/Vimeo URL..."
                  data-testid={`input-video-url-${block.id}`}
                />
                <Button onClick={handleAddVideo} variant="outline" data-testid={`button-add-video-${block.id}`}>
                  <Link className="h-4 w-4 mr-1" />
                  URL追加
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
