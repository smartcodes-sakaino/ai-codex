import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Save, X, ChevronDown, FileText, Loader2, Link, Copy, Check, AlertTriangle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import {
  fetchProblemWithBlocks,
  fetchChapter,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  createSelfReviewLink,
  getSelfReviewLinkByProblemId,
} from "@/lib/api";
import type { Block, ProblemBlockContent, CodeBlockContent, TextBlockContent, VideoBlockContent, LessonBlockContent, FileBlockContent, AnyBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, problemHelp } from "@/components/help-dialog";
import { ProblemBlock } from "@/components/blocks/problem-block";
import { CodeBlock } from "@/components/blocks/code-block";
import { TextBlock } from "@/components/blocks/text-block";
import { VideoBlock } from "@/components/blocks/video-block";
import { LessonBlock } from "@/components/blocks/lesson-block";
import { FileBlock } from "@/components/blocks/file-block";
import { AIReviewDialog } from "@/components/ai-review-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function ProblemPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [localBlocks, setLocalBlocks] = useState<Block[] | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [selfReviewUrl, setSelfReviewUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();

  const {
    data: problemData,
    isLoading: isProblemLoading,
    isError: isProblemError,
  } = useQuery({
    queryKey: ["/api/problems", id],
    queryFn: () => fetchProblemWithBlocks(id!),
    enabled: !!id,
  });

  const {
    data: chapter,
    isLoading: isChapterLoading,
  } = useQuery({
    queryKey: ["/api/chapters", problemData?.chapterId],
    queryFn: () => fetchChapter(problemData!.chapterId),
    enabled: !!problemData?.chapterId,
  });

  const blocks = localBlocks ?? problemData?.blocks ?? [];
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, AnyBlockContent>>(new Map());

  const createBlockMutation = useMutation({
    mutationFn: createBlock,
    onSuccess: (newBlock) => {
      setLocalBlocks([...blocks, newBlock]);
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ content: AnyBlockContent }> }) =>
      updateBlock(id, data),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: deleteBlock,
    onSuccess: (_, deletedId) => {
      const updatedBlocks = blocks.filter((b) => b.id !== deletedId);
      const reorderedBlocks = updatedBlocks.map((b, i) => ({ ...b, order: i }));
      setLocalBlocks(reorderedBlocks);
      if (reorderedBlocks.length > 0) {
        reorderBlocksMutation.mutate(reorderedBlocks.map((b) => b.id));
      }
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: reorderBlocks,
  });

  const handleAddBlock = (type: "problem" | "code" | "text" | "video" | "lesson" | "file") => {
    if (!id) return;

    let content: AnyBlockContent;
    if (type === "problem") {
      content = { text: "", images: [] };
    } else if (type === "code") {
      content = { code: "", language: "javascript" };
    } else if (type === "video") {
      content = { title: "", videoObjectPath: "", description: "" };
    } else if (type === "lesson") {
      content = { title: "", markdown: "" };
    } else if (type === "file") {
      content = { title: "", fileObjectPath: "", fileName: "" };
    } else {
      content = { text: "" };
    }

    createBlockMutation.mutate({
      problemId: id,
      type,
      content,
      order: blocks.length,
    });

    if (!editMode) setEditMode(true);
  };

  const handleUpdateBlock = (blockId: string, content: AnyBlockContent) => {
    // Update local state only (no API call) to preserve cursor position
    setLocalBlocks(
      blocks.map((b) => (b.id === blockId ? { ...b, content } : b))
    );
    // Track pending updates for save
    setPendingUpdates((prev) => new Map(prev).set(blockId, content));
  };

  const handleDeleteBlock = () => {
    if (!deleteBlockId) return;
    deleteBlockMutation.mutate(deleteBlockId);
    setDeleteBlockId(null);
  };

  const handleMoveBlock = (blockId: string, direction: "up" | "down") => {
    const index = blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];

    const reorderedBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));
    setLocalBlocks(reorderedBlocks);
    reorderBlocksMutation.mutate(reorderedBlocks.map((b) => b.id));
  };

  const handleSave = async () => {
    // Save all pending updates to API
    const savePromises = Array.from(pendingUpdates.entries()).map(([blockId, content]) =>
      updateBlockMutation.mutateAsync({ id: blockId, data: { content } })
    );
    
    try {
      await Promise.all(savePromises);
    } catch (error) {
      console.error("Failed to save some blocks:", error);
    }
    
    setPendingUpdates(new Map());
    await queryClient.invalidateQueries({ queryKey: ["/api/problems", id] });
    setLocalBlocks(null);
    setEditMode(false);
  };

  const handleCancel = () => {
    setPendingUpdates(new Map());
    setLocalBlocks(null);
    setEditMode(false);
  };

  const problemBlocks = blocks.filter((b) => b.type === "problem");
  const codeBlocks = blocks.filter((b) => b.type === "code");
  const textBlocks = blocks.filter((b) => b.type === "text");

  const hasExplanation = textBlocks.some((b) => {
    const content = b.content as TextBlockContent;
    return content.text && content.text.trim().length > 0;
  });

  const getProblemText = (): string => {
    return problemBlocks
      .map((b) => (b.content as ProblemBlockContent).text)
      .filter(Boolean)
      .join("\n\n");
  };

  const getModelCode = (): string => {
    return codeBlocks
      .map((b) => {
        const content = b.content as CodeBlockContent;
        return `// Language: ${content.language}\n${content.code}`;
      })
      .filter((code) => code.length > 20)
      .join("\n\n");
  };

  const getExplanationText = (): string => {
    return textBlocks
      .map((b) => (b.content as TextBlockContent).text)
      .filter(Boolean)
      .join("\n\n");
  };

  const { data: existingLink } = useQuery({
    queryKey: ["/api/self-review-links/problem", id],
    queryFn: () => getSelfReviewLinkByProblemId(id!),
    enabled: !!id && hasExplanation,
  });

  const buildSelfReviewUrl = (token: string) => {
    return `${window.location.origin}/self-review/${token}`;
  };

  const handleGenerateSelfReviewLink = async () => {
    if (!id) return;
    setIsGeneratingLink(true);
    try {
      const link = await createSelfReviewLink(id);
      const url = buildSelfReviewUrl(link.token);
      setSelfReviewUrl(url);
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/self-review-links/problem", id] });
      toast({ title: "リンクをコピーしました", description: "セルフレビュー用リンクをクリップボードにコピーしました" });
    } catch (err) {
      console.error("Failed to generate self-review link:", err);
      toast({ title: "エラー", description: "リンクの生成に失敗しました", variant: "destructive" });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopySelfReviewLink = async () => {
    const url = selfReviewUrl || (existingLink ? buildSelfReviewUrl(existingLink.token) : null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
      toast({ title: "リンクをコピーしました" });
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (isProblemError) {
    setLocation("/");
    return null;
  }

  if (isProblemLoading || isChapterLoading || !problemData || !chapter) {
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
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AdminNavMenu />
            <Breadcrumb
              items={[
                { label: chapter.title, href: `/chapter/${chapter.id}` },
                { label: problemData.title },
              ]}
            />
          </div>
          <div className="flex items-center gap-1">
            <HelpDialog title={problemHelp.title} items={problemHelp.items} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{problemData.title}</h1>
            {!problemData.hasLecture && (
              <span
                className="flex items-center gap-1 text-amber-600 dark:text-amber-500 text-sm"
                data-testid="badge-no-lecture"
              >
                <AlertTriangle className="h-4 w-4" />
                講義コンテンツがありません
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasExplanation && !editMode && (
              <>
                <AIReviewDialog
                  problem={getProblemText()}
                  modelCode={getModelCode()}
                  explanation={getExplanationText()}
                />
                {existingLink ? (
                  <Button
                    variant="outline"
                    onClick={handleCopySelfReviewLink}
                    className="gap-2"
                    data-testid="button-copy-self-review-link"
                  >
                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {linkCopied ? "コピー済み" : "セルフレビューリンク"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleGenerateSelfReviewLink}
                    disabled={isGeneratingLink}
                    className="gap-2"
                    data-testid="button-generate-self-review-link"
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link className="h-4 w-4" />
                    )}
                    セルフレビュー用リンク発行
                  </Button>
                )}
              </>
            )}
            {!editMode && (
              <Button
                onClick={() => setEditMode(true)}
                variant="outline"
                data-testid="button-edit-content"
              >
                <Edit className="h-4 w-4 mr-2" />
                コンテンツを編集
              </Button>
            )}
          {editMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-gradient-to-r from-[#FF6B9D] to-[#FFB3C6] text-white"
                  data-testid="button-add-block"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  ブロックを追加
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleAddBlock("lesson")} data-testid="menu-add-lesson-block">
                  <span className="text-amber-500 mr-2">■</span>
                  授業ブロック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddBlock("problem")} data-testid="menu-add-problem-block">
                  <span className="text-orange-500 mr-2">■</span>
                  問題ブロック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddBlock("code")} data-testid="menu-add-code-block">
                  <span className="text-gray-500 mr-2">■</span>
                  お手本コードブロック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddBlock("text")} data-testid="menu-add-text-block">
                  <span className="text-blue-500 mr-2">■</span>
                  AI解説ブロック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddBlock("file")} data-testid="menu-add-file-block">
                  <span className="text-teal-500 mr-2">■</span>
                  ファイルブロック
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddBlock("video")} data-testid="menu-add-video-block">
                  <span className="text-purple-500 mr-2">■</span>
                  動画ブロック
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="text-center py-20 bg-muted/50 rounded-2xl">
            <div className="mb-4 flex justify-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">解説がまだありません</h2>
            <p className="text-muted-foreground mb-6">
              編集ボタンをクリックしてコンテンツを追加しましょう
            </p>
            <Button
              onClick={() => setEditMode(true)}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              size="lg"
              data-testid="button-start-editing"
            >
              <Edit className="h-4 w-4 mr-2" />
              編集を開始
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {blocks.map((block, index) => {
              if (block.type === "problem") {
                return (
                  <ProblemBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                );
              }
              if (block.type === "code") {
                return (
                  <CodeBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                );
              }
              if (block.type === "text") {
                return (
                  <TextBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                    problemBlocks={problemBlocks}
                    codeBlocks={codeBlocks}
                  />
                );
              }
              if (block.type === "video") {
                return (
                  <VideoBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                );
              }
              if (block.type === "lesson") {
                return (
                  <LessonBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                );
              }
              if (block.type === "file") {
                return (
                  <FileBlock
                    key={block.id}
                    block={block}
                    editMode={editMode}
                    onUpdate={(content) => handleUpdateBlock(block.id, content)}
                    onDelete={() => setDeleteBlockId(block.id)}
                    onMoveUp={() => handleMoveBlock(block.id, "up")}
                    onMoveDown={() => handleMoveBlock(block.id, "down")}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                );
              }
              return null;
            })}
          </div>
        )}

              </main>

      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50">
          <div className="container mx-auto max-w-4xl flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
              <X className="h-4 w-4 mr-2" />
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              className="bg-green-600 text-white hover:bg-green-700"
              data-testid="button-save-edit"
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteBlockId} onOpenChange={() => setDeleteBlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ブロックを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlock}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-block"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
