import { useState, useRef } from "react";
import { FileCode, Upload, Loader2, X, FileArchive, Copy, Check, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { generateReview } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const LANGUAGES = [
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
];

interface CodeEntry {
  id: string;
  filename: string;
  language: string;
  code: string;
}

interface AIReviewDialogProps {
  problem: string;
  modelCode?: string;
  explanation?: string;
  disabled?: boolean;
}

export function AIReviewDialog({ problem, modelCode, explanation, disabled }: AIReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [codeEntries, setCodeEntries] = useState<CodeEntry[]>([
    { id: crypto.randomUUID(), filename: "", language: "javascript", code: "" }
  ]);
  const [review, setReview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addCodeEntry = () => {
    setCodeEntries([
      ...codeEntries,
      { id: crypto.randomUUID(), filename: "", language: "javascript", code: "" }
    ]);
  };

  const removeCodeEntry = (id: string) => {
    if (codeEntries.length > 1) {
      setCodeEntries(codeEntries.filter(entry => entry.id !== id));
    }
  };

  const updateCodeEntry = (id: string, updates: Partial<CodeEntry>) => {
    setCodeEntries(codeEntries.map(entry =>
      entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  const getReviewCode = (): string => {
    return codeEntries
      .filter(entry => entry.code.trim())
      .map(entry => {
        const header = entry.filename ? `// ===== ${entry.filename} =====` : `// ===== ${LANGUAGES.find(l => l.value === entry.language)?.label || entry.language} =====`;
        return `${header}\n${entry.code}`;
      })
      .join("\n\n");
  };

  const hasCode = codeEntries.some(entry => entry.code.trim());

  const handleSubmit = async () => {
    const reviewCode = getReviewCode();
    if (!reviewCode.trim()) {
      setError("レビュー対象のコードを入力してください");
      return;
    }
    await submitReview(reviewCode);
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
      if (file.name.endsWith(".zip")) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const newEntries: CodeEntry[] = [];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir && isCodeFile(filename)) {
            const content = await zipEntry.async("string");
            const ext = filename.split(".").pop()?.toLowerCase() || "";
            const language = getLanguageFromExtension(ext);
            newEntries.push({
              id: crypto.randomUUID(),
              filename: filename.split("/").pop() || filename,
              language,
              code: content
            });
          }
        }
        
        if (newEntries.length === 0) {
          setError("ZIPファイル内にコードファイルが見つかりませんでした");
          return;
        }
        
        setCodeEntries(newEntries);
      } else {
        const content = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const language = getLanguageFromExtension(ext);
        setCodeEntries([{
          id: crypto.randomUUID(),
          filename: file.name,
          language,
          code: content
        }]);
      }
    } catch (err) {
      console.error("File read error:", err);
      setError("ファイルの読み込みに失敗しました");
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getLanguageFromExtension = (ext: string): string => {
    const extMap: Record<string, string> = {
      html: "html", htm: "html",
      css: "css", scss: "css", sass: "css", less: "css",
      js: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp", cc: "cpp", cxx: "cpp",
      c: "c", h: "c",
      cs: "csharp",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      sql: "sql",
      sh: "bash", bash: "bash",
      json: "json",
      yaml: "yaml", yml: "yaml",
      md: "markdown",
    };
    return extMap[ext] || "javascript";
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
    setCodeEntries([{ id: crypto.randomUUID(), filename: "", language: "javascript", code: "" }]);
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            AIコードレビュー
          </DialogTitle>
          <DialogDescription>
            コードブロックを追加して、AIによるフィードバックを受け取ります
          </DialogDescription>
        </DialogHeader>

        {!review ? (
          <div className="space-y-4 mt-4">
            <Tabs defaultValue="blocks" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="blocks" data-testid="tab-code-blocks">コードブロック</TabsTrigger>
                <TabsTrigger value="file" data-testid="tab-file-upload">ファイルアップロード</TabsTrigger>
              </TabsList>
              
              <TabsContent value="blocks" className="space-y-4">
                <div className="space-y-3">
                  {codeEntries.map((entry, index) => (
                    <Card key={entry.id} className="bg-[#1E1E1E] text-gray-100 border-gray-700">
                      <CardHeader className="py-2 px-4 bg-[#2D2D2D]">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium text-blue-400 whitespace-nowrap">
                              コード {index + 1}
                            </span>
                            <Input
                              value={entry.filename}
                              onChange={(e) => updateCodeEntry(entry.id, { filename: e.target.value })}
                              placeholder="ファイル名（任意）"
                              className="h-7 text-sm bg-[#2D2D2D] border-gray-600 text-gray-100 max-w-[200px]"
                              data-testid={`input-filename-${index}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={entry.language}
                              onValueChange={(lang) => updateCodeEntry(entry.id, { language: lang })}
                            >
                              <SelectTrigger
                                className="w-32 h-7 text-sm bg-[#2D2D2D] border-gray-600 text-gray-100"
                                data-testid={`select-language-${index}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LANGUAGES.map((lang) => (
                                  <SelectItem key={lang.value} value={lang.value}>
                                    {lang.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCodeEntry(entry.id)}
                              disabled={codeEntries.length <= 1}
                              className="h-7 w-7 text-red-400 hover:text-red-300"
                              data-testid={`button-remove-code-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <Textarea
                          value={entry.code}
                          onChange={(e) => updateCodeEntry(entry.id, { code: e.target.value })}
                          placeholder="レビューしたいコードをここに貼り付けてください..."
                          className="min-h-[150px] font-mono text-sm bg-[#2D2D2D] border-gray-600 text-gray-100 resize-y"
                          data-testid={`textarea-code-${index}`}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  onClick={addCodeEntry}
                  className="w-full gap-2"
                  data-testid="button-add-code-block"
                >
                  <Plus className="h-4 w-4" />
                  コードブロックを追加
                </Button>
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
                
                {hasCode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>読み込まれたファイル: {codeEntries.length}件</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        data-testid="button-clear-files"
                      >
                        <X className="h-4 w-4 mr-1" />
                        クリア
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {codeEntries.map(e => e.filename || "無名ファイル").join(", ")}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
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
                onClick={handleSubmit}
                disabled={isLoading || !hasCode}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown>
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
