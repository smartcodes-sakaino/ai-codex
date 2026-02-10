import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileArchive, Loader2, X, Plus, Trash2, Copy, Check, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSelfReviewInfo, submitSelfReview } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import ReactMarkdown from "react-markdown";

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

export default function SelfReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [codeEntries, setCodeEntries] = useState<CodeEntry[]>([
    { id: crypto.randomUUID(), filename: "", language: "javascript", code: "" }
  ]);
  const [review, setReview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: info, isLoading: isInfoLoading, isError: isInfoError } = useQuery({
    queryKey: ["/api/self-review", token],
    queryFn: () => getSelfReviewInfo(token!),
    enabled: !!token,
  });

  const hasCode = codeEntries.some(entry => entry.code.trim());

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
        const header = entry.filename
          ? `// ===== ${entry.filename} =====`
          : `// ===== ${LANGUAGES.find(l => l.value === entry.language)?.label || entry.language} =====`;
        return `${header}\n${entry.code}`;
      })
      .join("\n\n");
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

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

  const handleSubmit = async () => {
    const reviewCode = getReviewCode();
    if (!reviewCode.trim()) {
      setError("レビュー対象のコードを入力してください");
      return;
    }

    setIsLoading(true);
    setError("");
    setReview("");

    try {
      const result = await submitSelfReview({ token: token!, reviewCode });
      setReview(result.review);
    } catch (err) {
      console.error("Self review error:", err);
      setError("セルフレビューの生成に失敗しました。もう一度お試しください。");
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

  if (isInfoLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (isInfoError || !info) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">無効なリンクです</h1>
          <p className="text-muted-foreground">このセルフレビュー用リンクは存在しないか、無効です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" data-testid="text-chapter-title">{info.chapterTitle}</h1>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-problem-title">{info.problemTitle} - セルフレビュー</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-page-heading">セルフレビュー</h2>
          <p className="text-muted-foreground">
            課題「{info.problemTitle}」のコードを提出して、AIによるフィードバックを受けましょう。
          </p>
        </div>

        {!review ? (
          <div className="space-y-6">
            <Tabs defaultValue="blocks" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="blocks" data-testid="tab-code-blocks">コード入力</TabsTrigger>
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
                  className="border-2 border-dashed border-muted-foreground/25 rounded-md p-6 text-center cursor-pointer hover-elevate"
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

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !hasCode}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              size="lg"
              data-testid="button-submit-self-review"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  セルフレビュー中...
                </>
              ) : (
                "セルフレビューを実行"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
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

            <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/50 rounded-md">
              <ReactMarkdown>{review}</ReactMarkdown>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
