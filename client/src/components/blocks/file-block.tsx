import { useRef, useState } from "react";
import { Trash2, GripVertical, FileArchive, Loader2, X, Upload } from "lucide-react";
import type { Block, FileBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api";

interface FileBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: FileBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function FileBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: FileBlockProps) {
  const content = block.content as FileBlockContent;
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");
    setIsUploading(true);
    try {
      const url = await uploadFile(file, "files");
      onUpdate({ ...content, fileObjectPath: url, fileName: file.name });
    } catch (error) {
      console.error("File upload error:", error);
      setFileError("ファイルのアップロードに失敗しました。");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    onUpdate({ ...content, fileObjectPath: "", fileName: "" });
  };

  if (!editMode) {
    return (
      <Card className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950/20 dark:to-teal-900/20 border-teal-200 dark:border-teal-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
            <span className="text-sm font-medium">ファイル</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <h3 className="text-lg font-semibold">{content.title || "無題のファイル"}</h3>
          {content.fileObjectPath ? (
            <a
              href={content.fileObjectPath}
              download={content.fileName}
              className="inline-flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400 hover:underline"
              data-testid={`link-download-file-${block.id}`}
            >
              <FileArchive className="h-4 w-4" />
              {content.fileName || "ファイルをダウンロード"}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">ファイルが設定されていません</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950/20 dark:to-teal-900/20 border-teal-200 dark:border-teal-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
            <GripVertical className="h-4 w-4 cursor-grab" />
            <span className="text-sm font-medium">ファイルブロック</span>
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
            placeholder="例: 演習用スターターファイル"
            data-testid={`input-file-title-${block.id}`}
          />
        </div>

        <div className="space-y-2">
          <Label>配布ファイル（zip）</Label>
          {content.fileObjectPath ? (
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <span className="flex items-center gap-2 text-sm truncate">
                <FileArchive className="h-4 w-4 flex-shrink-0" />
                {content.fileName || content.fileObjectPath}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveFile}
                className="text-destructive flex-shrink-0"
                data-testid={`button-remove-file-${block.id}`}
              >
                <X className="h-4 w-4 mr-1" />
                削除
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {isUploading ? "アップロード中..." : "クリックしてファイルをアップロード（zipなど）"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                className="hidden"
                data-testid={`input-file-upload-${block.id}`}
              />
            </div>
          )}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
