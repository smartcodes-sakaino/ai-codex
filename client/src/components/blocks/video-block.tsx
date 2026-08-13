import { useRef, useState } from "react";
import { Trash2, GripVertical, FileVideo, Loader2, X } from "lucide-react";
import type { Block, VideoBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api";
import { VideoPlayer } from "@/components/video-player";

interface VideoBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: VideoBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function VideoBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: VideoBlockProps) {
  const content = block.content as VideoBlockContent;
  const [videoError, setVideoError] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError("");

    if (file.size > MAX_VIDEO_SIZE) {
      setVideoError(`動画サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。300MB以下の動画を選択してください。`);
      return;
    }

    setIsUploadingVideo(true);
    try {
      const url = await uploadFile(file, "videos");
      onUpdate({ ...content, videoObjectPath: url });
    } catch (error) {
      console.error("Video upload error:", error);
      setVideoError("動画のアップロードに失敗しました。");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemoveVideo = () => {
    onUpdate({ ...content, videoObjectPath: "" });
  };

  if (!editMode) {
    return (
      <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <span className="text-sm font-medium">e-learning</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-lg font-semibold">{content.title || "無題の動画チャプター"}</h3>
          {content.videoObjectPath ? (
            <VideoPlayer src={content.videoObjectPath} title={content.title} />
          ) : (
            <p className="text-sm text-muted-foreground">動画が設定されていません</p>
          )}
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
            {content.description || "説明がありません"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <GripVertical className="h-4 w-4 cursor-grab" />
            <span className="text-sm font-medium">動画ブロック(e-learning)</span>
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
            placeholder="動画チャプターのタイトルを入力してください..."
            data-testid={`input-video-title-${block.id}`}
          />
        </div>

        <div className="space-y-2">
          <Label>動画ファイル</Label>
          {content.videoObjectPath ? (
            <div className="space-y-2">
              <VideoPlayer src={content.videoObjectPath} title="動画プレビュー" />
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
            <div
              className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors ${isUploadingVideo ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => videoInputRef.current?.click()}
            >
              {isUploadingVideo ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
              ) : (
                <FileVideo className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {isUploadingVideo ? "アップロード中..." : "クリックして動画をアップロード（300MB以下）"}
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
          )}
          {videoError && <p className="text-sm text-destructive">{videoError}</p>}
        </div>

        <div className="space-y-2">
          <Label>説明文</Label>
          <Textarea
            value={content.description || ""}
            onChange={(e) => onUpdate({ ...content, description: e.target.value })}
            placeholder="動画の説明を入力してください..."
            className="min-h-[120px] resize-y"
            data-testid={`textarea-video-description-${block.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
