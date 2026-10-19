import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Save, Eye, Link2, Image, Video } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { uploadFile } from "@/lib/api";
import { fetchArticle, updateArticle, articleShareUrl } from "@/lib/articleApi";
import type { ArticleWithCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { markdownVideoComponents } from "@/components/markdown-video";
import { useToast } from "@/hooks/use-toast";

export default function AdminArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: article, isLoading, isError } = useQuery<ArticleWithCategory>({
    queryKey: ["/api/articles", id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
  });

  // Seed the form once per article; later refetches (e.g. after saving) must
  // not overwrite text the admin is in the middle of typing.
  useEffect(() => {
    if (article && loadedId !== article.id) {
      setTitle(article.title);
      setMarkdown(article.markdown);
      setLoadedId(article.id);
    }
  }, [article, loadedId]);

  const isDirty = !!article && (title !== article.title || markdown !== article.markdown);

  // Warn before closing the tab with unsaved edits — there is no autosave.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: () => updateArticle(id, { title: title.trim(), markdown }),
    onSuccess: (saved) => {
      queryClient.setQueryData<ArticleWithCategory>(["/api/articles", id], (prev) =>
        prev ? { ...prev, ...saved } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["/api/article-categories", saved.categoryId, "articles"] });
      toast({ title: "保存しました" });
    },
    onError: () => {
      toast({ title: "保存エラー", description: "記事の保存に失敗しました。", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast({ title: "タイトルは必須です", variant: "destructive" });
      return;
    }
    if (!saveMutation.isPending) saveMutation.mutate();
  };

  // Ctrl+S / Cmd+S saves, as in most editors.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Same insert-at-cursor behavior as the lesson block, so images and videos
  // land exactly where they belong in the text.
  const insertAtCursor = (insertion: string) => {
    const textarea = textareaRef.current;
    if (textarea && document.activeElement === textarea) {
      const start = textarea.selectionStart ?? markdown.length;
      const end = textarea.selectionEnd ?? markdown.length;
      setMarkdown(markdown.slice(0, start) + insertion + markdown.slice(end));
      requestAnimationFrame(() => {
        textarea.focus();
        const caret = start + insertion.length;
        textarea.setSelectionRange(caret, caret);
      });
    } else {
      setMarkdown(markdown ? `${markdown}\n\n${insertion}\n` : `${insertion}\n`);
    }
  };

  const handleMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folder: "images" | "videos",
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const setUploading = folder === "images" ? setIsUploadingImage : setIsUploadingVideo;
    setUploading(true);
    try {
      const url = await uploadFile(file, folder);
      insertAtCursor(`![${file.name}](${url})`);
    } catch (error) {
      console.error("Article media upload error:", error);
      toast({
        title: "アップロードエラー",
        description: folder === "images" ? "画像のアップロードに失敗しました。" : "動画のアップロードに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleShareUrl(id));
      toast({ title: "コピーしました", description: "記事のリンクをクリップボードにコピーしました" });
    } catch (error) {
      console.error("Failed to copy article link:", error);
      toast({ title: "コピーエラー", description: "クリップボードへのコピーに失敗しました", variant: "destructive" });
    }
  };

  if (isError) {
    setLocation("/admin/articles");
    return null;
  }

  if (isLoading || !article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AdminNavMenu />
            <Breadcrumb
              home={{ href: "/admin/articles", label: "記事管理" }}
              items={[
                { label: article.categoryTitle, href: `/admin/articles/categories/${article.categoryId}` },
                { label: article.title },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink} data-testid="button-copy-article-link">
              <Link2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">リンクをコピー</span>
            </Button>
            <Link href={`/articles/${article.id}`}>
              <Button variant="outline" size="sm" data-testid="button-view-article">
                <Eye className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">表示</span>
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-save-article"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {isDirty ? "保存" : "保存済み"}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="article-edit-title">タイトル *</Label>
          <Input
            id="article-edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="記事のタイトル"
            data-testid="input-article-edit-title"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label htmlFor="article-edit-markdown">本文（Markdown）</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="gap-2"
                  data-testid="button-article-insert-image"
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
                  data-testid="button-article-insert-video"
                >
                  {isUploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  動画を挿入
                </Button>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleMediaUpload(e, "images")}
                className="hidden"
                data-testid="input-article-image-upload"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => handleMediaUpload(e, "videos")}
                className="hidden"
                data-testid="input-article-video-upload"
              />
            </div>
            <Textarea
              id="article-edit-markdown"
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Markdown形式で本文を入力してください...&#10;&#10;「画像を挿入」「動画を挿入」ボタンでカーソル位置に差し込めます。Ctrl+Sで保存できます。"
              className="min-h-[60vh] resize-y font-mono text-sm"
              data-testid="textarea-article-markdown"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">プレビュー</Label>
            <Card>
              <CardContent className="pt-6">
                <h1 className="text-2xl font-bold mb-4">{title || "（タイトル未入力）"}</h1>
                <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg">
                  {markdown ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownVideoComponents}>
                      {markdown}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">本文がありません</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
