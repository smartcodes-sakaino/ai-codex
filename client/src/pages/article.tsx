import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Pencil, FileQuestion } from "lucide-react";
import { LearnerLayout } from "@/components/learner-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchArticle } from "@/lib/articleApi";
import { markdownVideoComponents } from "@/components/markdown-video";
import type { ArticleWithCategory } from "@shared/schema";

/**
 * A standalone reading page opened from a shared link (e.g. one pasted into a
 * lesson). It sits outside every course — no roadmap, no submission, no
 * progress — so any signed-in account can read it.
 */
export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: article, isLoading, isError } = useQuery<ArticleWithCategory>({
    queryKey: ["/api/articles", id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <LearnerLayout title="記事">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </LearnerLayout>
    );
  }

  if (isError || !article) {
    return (
      <LearnerLayout title="記事">
        <div className="text-center py-20" data-testid="text-article-not-found">
          <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">記事が見つかりません</h2>
          <p className="text-muted-foreground">リンクが間違っているか、記事が削除された可能性があります。</p>
        </div>
      </LearnerLayout>
    );
  }

  return (
    <LearnerLayout title={article.title}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="text-sm text-muted-foreground hover:text-foreground"
            data-testid="button-article-back"
          >
            ← 戻る
          </button>
          {user?.role === "admin" && (
            <Link href={`/admin/articles/${article.id}/edit`}>
              <Button variant="outline" size="sm" data-testid="button-edit-this-article">
                <Pencil className="h-4 w-4 mr-1" />
                この記事を編集
              </Button>
            </Link>
          )}
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1" data-testid="text-article-category">{article.categoryTitle}</p>
            <h1 className="text-2xl font-bold mb-6" data-testid="text-article-title">{article.title}</h1>
            <div className="prose dark:prose-invert max-w-none prose-img:rounded-lg" data-testid="article-body">
              {article.markdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownVideoComponents}>
                  {article.markdown}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">本文がありません</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </LearnerLayout>
  );
}
