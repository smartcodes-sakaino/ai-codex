import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, FileText, Loader2, ChevronUp, ChevronDown, Trash2, Pencil, Eye, Link2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import {
  fetchArticleCategory,
  fetchArticles,
  createArticle,
  deleteArticle,
  reorderArticles,
  articleShareUrl,
} from "@/lib/articleApi";
import type { Article, ArticleCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, articleCategoryHelp } from "@/components/help-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const accentColors = ["#FF8C42", "#FF6B9D", "#4A90E2", "#9B59B6", "#27AE60", "#E74C3C"];

function formatUpdatedAt(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminArticleCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newArticleTitle, setNewArticleTitle] = useState("");
  const [deleteArticleId, setDeleteArticleId] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    data: category,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
  } = useQuery<ArticleCategory>({
    queryKey: ["/api/article-categories", id],
    queryFn: () => fetchArticleCategory(id),
    enabled: !!id,
  });

  const { data: articles = [], isLoading: isArticlesLoading } = useQuery<Article[]>({
    queryKey: ["/api/article-categories", id, "articles"],
    queryFn: () => fetchArticles(id),
    enabled: !!id,
  });

  const invalidateArticles = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/article-categories", id, "articles"] });
    // The category cards show an article count, so refresh that list too.
    queryClient.invalidateQueries({ queryKey: ["/api/article-categories"], exact: true });
  };

  const createArticleMutation = useMutation({
    mutationFn: createArticle,
    onSuccess: (article) => {
      invalidateArticles();
      setNewArticleTitle("");
      setShowAddDialog(false);
      // A new article is empty, so go straight to writing it.
      setLocation(`/admin/articles/${article.id}/edit`);
    },
    onError: () => {
      toast({ title: "エラー", description: "記事の作成に失敗しました。", variant: "destructive" });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => {
      invalidateArticles();
      setDeleteArticleId(null);
    },
  });

  const reorderArticlesMutation = useMutation({
    mutationFn: reorderArticles,
    onSuccess: invalidateArticles,
  });

  const handleAddArticle = () => {
    if (!newArticleTitle.trim() || !id) return;
    createArticleMutation.mutate({
      categoryId: id,
      title: newArticleTitle.trim(),
      markdown: "",
      order: articles.length,
    });
  };

  const handleMoveArticle = (articleId: string, direction: "up" | "down") => {
    const index = articles.findIndex((a) => a.id === articleId);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || newIndex < 0 || newIndex >= articles.length) return;

    const reordered = [...articles];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    reorderArticlesMutation.mutate(reordered.map((a) => a.id));
  };

  const handleCopyLink = async (articleId: string) => {
    try {
      await navigator.clipboard.writeText(articleShareUrl(articleId));
      toast({ title: "コピーしました", description: "記事のリンクをクリップボードにコピーしました" });
    } catch (error) {
      console.error("Failed to copy article link:", error);
      toast({ title: "コピーエラー", description: "クリップボードへのコピーに失敗しました", variant: "destructive" });
    }
  };

  if (isCategoryError) {
    setLocation("/admin/articles");
    return null;
  }

  if (isCategoryLoading || isArticlesLoading || !category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AdminNavMenu />
            <Breadcrumb home={{ href: "/admin/articles", label: "記事管理" }} items={[{ label: category.title }]} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={setEditMode}
                data-testid="switch-edit-mode"
              />
              <Label htmlFor="edit-mode" className="text-sm flex items-center gap-1">
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">編集</span>
              </Label>
            </div>
            <HelpDialog title={articleCategoryHelp.title} items={articleCategoryHelp.items} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">{category.title}</h1>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
            data-testid="button-add-article"
          >
            <Plus className="h-4 w-4 mr-2" />
            記事を追加
          </Button>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 flex justify-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">記事がありません</h2>
            <p className="text-muted-foreground mb-6">最初の記事を追加しましょう！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article, index) => (
              <Card
                key={article.id}
                className="p-4 flex items-center gap-4 flex-wrap border-l-4"
                style={{ borderLeftColor: accentColors[index % accentColors.length] }}
                data-testid={`card-article-${article.id}`}
              >
                {editMode && (
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveArticle(article.id, "up")}
                      disabled={index === 0}
                      data-testid={`button-move-up-${article.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveArticle(article.id, "down")}
                      disabled={index === articles.length - 1}
                      data-testid={`button-move-down-${article.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {/* Outside edit mode the list is for reading and sharing, so the title opens the article itself. */}
                <Link
                  href={editMode ? `/admin/articles/${article.id}/edit` : `/articles/${article.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-semibold truncate hover:underline" data-testid={`text-article-title-${article.id}`}>
                    {article.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    更新: {formatUpdatedAt(article.updatedAt)}
                    {!article.markdown.trim() && "（本文なし）"}
                  </p>
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                  {editMode && (
                    <>
                      <Link href={`/admin/articles/${article.id}/edit`}>
                        <Button variant="outline" size="sm" data-testid={`button-edit-article-${article.id}`}>
                          <Pencil className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                      </Link>
                      <Link href={`/articles/${article.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-article-${article.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          表示
                        </Button>
                      </Link>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(article.id)}
                    data-testid={`button-copy-article-link-${article.id}`}
                  >
                    <Link2 className="h-4 w-4 mr-1" />
                    リンクをコピー
                  </Button>
                  {editMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteArticleId(article.id)}
                      data-testid={`button-delete-article-${article.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しい記事を追加</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="article-title">記事タイトル</Label>
            <Input
              id="article-title"
              value={newArticleTitle}
              onChange={(e) => setNewArticleTitle(e.target.value)}
              placeholder="例: MBTIの基礎"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddArticle();
              }}
              data-testid="input-article-title"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddArticle}
              disabled={createArticleMutation.isPending || !newArticleTitle.trim()}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-article"
            >
              {createArticleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteArticleId} onOpenChange={() => setDeleteArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記事を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。共有したリンクも開けなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteArticleId && deleteArticleMutation.mutate(deleteArticleId)}
              disabled={deleteArticleMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-article"
            >
              {deleteArticleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
