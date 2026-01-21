import { useState, useRef } from "react";
import { FileCode, Upload, Loader2, X, FileArchive, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateReview } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface AIReviewDialogProps {
  problem: string;
  modelCode?: string;
  explanation?: string;
  disabled?: boolean;
}

export function AIReviewDialog({ problem, modelCode, explanation, disabled }: AIReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [review, setReview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextSubmit = async () => {
    if (!codeText.trim()) {
      setError("レビュー対象のコードを入力してください");
      return;
    }
    await submitReview(codeText.trim());
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (file.size > MAX_FILE_SIZE) {
      setError(`ファイルサイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。10MB以下のファイルを選択してください。`);
      return;
    }
    
    try {
      let code = "";
      
      if (file.name.endsWith(".zip")) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const codeFiles: string[] = [];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir && isCodeFile(filename)) {
            const content = await zipEntry.async("string");
            codeFiles.push(`// ===== ${filename} =====\n${content}`);
          }
        }
        
        if (codeFiles.length === 0) {
          setError("ZIPファイル内にコードファイルが見つかりませんでした");
          return;
        }
        
        code = codeFiles.join("\n\n");
      } else {
        code = await file.text();
      }
      
      setCodeText(code);
    } catch (err) {
      console.error("File read error:", err);
      setError("ファイルの読み込みに失敗しました");
    }
  };

  const isCodeFile = (filename: string): boolean => {
    const codeExtensions = [
      ".html", ".htm", ".css", ".js", ".jsx", ".ts", ".tsx",
      ".json", ".xml", ".svg", ".php", ".py", ".rb", ".java",
      ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".vue", ".scss", ".sass", ".less"
    ];
    const lowerFilename = filename.toLowerCase();
    return codeExtensions.some(ext => lowerFilename.endsWith(ext)) &&
           !lowerFilename.includes("node_modules") &&
           !lowerFilename.includes("__MACOSX");
  };

  const submitReview = async (code: string) => {
    setIsLoading(true);
    setError("");
    setReview("");

    try {
      const result = await generateReview({
        problem,
        modelCode,
        explanation,
        reviewCode: code,
      });
      setReview(result.review);
    } catch (err) {
      console.error("Review error:", err);
      setError("レビューの生成に失敗しました。もう一度お試しください。");
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
    setCodeText("");
    setReview("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="gap-2"
          data-testid="button-ai-review"
        >
          <FileCode className="h-4 w-4" />
          AIレビュー
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            AIコードレビュー
          </DialogTitle>
          <DialogDescription>
            コードをアップロードして、AIによるフィードバックを受け取ります
          </DialogDescription>
        </DialogHeader>

        {!review ? (
          <div className="space-y-4 mt-4">
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" data-testid="tab-text-input">テキスト入力</TabsTrigger>
                <TabsTrigger value="file" data-testid="tab-file-upload">ファイルアップロード</TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label>レビュー対象のコード</Label>
                  <Textarea
                    value={codeText}
                    onChange={(e) => setCodeText(e.target.value)}
                    placeholder="レビューしたいコードをここに貼り付けてください..."
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-review-code"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="file" className="space-y-4">
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover-elevate"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-file-upload"
                >
                  <div className="flex justify-center gap-2 mb-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <FileArchive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    クリックしてファイルを選択（10MB以下）
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    テキストファイル（.html, .css, .js など）またはZIPファイル
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.xml,.php,.py,.rb,.java,.c,.cpp,.h,.cs,.go,.rs,.vue,.scss,.sass,.less,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                </div>
                
                {codeText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>読み込まれたコード</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCodeText("")}
                        data-testid="button-clear-code"
                      >
                        <X className="h-4 w-4 mr-1" />
                        クリア
                      </Button>
                    </div>
                    <Textarea
                      value={codeText}
                      onChange={(e) => setCodeText(e.target.value)}
                      className="min-h-[150px] font-mono text-sm"
                      data-testid="textarea-loaded-code"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-review"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleTextSubmit}
                disabled={isLoading || !codeText.trim()}
                className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                data-testid="button-submit-review"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    レビュー中...
                  </>
                ) : (
                  "レビューを実行"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
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
            
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/50 rounded-lg">
              <ReactMarkdown>{review}</ReactMarkdown>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)} data-testid="button-close-review">
                閉じる
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
