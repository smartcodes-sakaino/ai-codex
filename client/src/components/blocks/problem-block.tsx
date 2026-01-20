import { useState, useRef } from "react";
import { Trash2, Upload, X, Video, GripVertical, Link, FileVideo } from "lucide-react";
import type { Block, ProblemBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB

  const isLocalVideo = (url: string) => url.startsWith("data:video/");

  const handleTextChange = (text: string) => {
    onUpdate({ ...content, text });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onUpdate({
          ...content,
          images: [...(content.images || []), base64],
        });
      };
      reader.readAsDataURL(file);
    });
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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError("");

    if (file.size > MAX_VIDEO_SIZE) {
      setVideoError(`動画サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。10MB以下の動画を選択してください。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onUpdate({ ...content, videoUrl: base64 });
    };
    reader.onerror = () => {
      setVideoError("動画の読み込みに失敗しました。");
    };
    reader.readAsDataURL(file);
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
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
            {content.text || "問題文がありません"}
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
          <Label>問題文</Label>
          <Textarea
            value={content.text || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="問題文を入力してください..."
            className="min-h-[120px] resize-y"
            data-testid={`textarea-problem-${block.id}`}
          />
        </div>

        <div className="space-y-2">
          <Label>画像</Label>
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              クリックまたはドラッグ＆ドロップで画像をアップロード
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
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => videoInputRef.current?.click()}
              >
                <FileVideo className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  クリックして動画をアップロード（10MB以下）
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
