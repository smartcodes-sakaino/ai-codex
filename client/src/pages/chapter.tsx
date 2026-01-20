import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Plus, Edit, FileText, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  fetchChapter,
  fetchProblems,
  fetchProblemWithBlocks,
  createProblem,
  updateProblem,
  deleteProblem,
  reorderProblems,
} from "@/lib/api";
import type { Chapter, Problem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProblemCard } from "@/components/problem-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, chapterHelp } from "@/components/help-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

export default function ChapterPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProblemTitle, setNewProblemTitle] = useState("");
  const [deleteProblemId, setDeleteProblemId] = useState<string | null>(null);

  const {
    data: chapter,
    isLoading: isChapterLoading,
    isError: isChapterError,
  } = useQuery<Chapter>({
    queryKey: ["/api/chapters", id],
    enabled: !!id,
  });

  const {
    data: problems = [],
    isLoading: isProblemsLoading,
  } = useQuery<Problem[]>({
    queryKey: ["/api/chapters", id, "problems"],
    enabled: !!id,
  });

  const createProblemMutation = useMutation({
    mutationFn: createProblem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", id, "problems"] });
      setNewProblemTitle("");
      setShowAddDialog(false);
    },
  });

  const updateProblemMutation = useMutation({
    mutationFn: ({ problemId, data }: { problemId: string; data: Partial<{ title: string }> }) =>
      updateProblem(problemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", id, "problems"] });
    },
  });

  const deleteProblemMutation = useMutation({
    mutationFn: deleteProblem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", id, "problems"] });
      setDeleteProblemId(null);
    },
  });

  const reorderProblemsMutation = useMutation({
    mutationFn: reorderProblems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", id, "problems"] });
    },
  });

  const handleAddProblem = () => {
    if (!newProblemTitle.trim() || !id) return;
    createProblemMutation.mutate({
      chapterId: id,
      title: newProblemTitle.trim(),
      order: problems.length,
    });
  };

  const handleDeleteProblem = () => {
    if (deleteProblemId) {
      deleteProblemMutation.mutate(deleteProblemId);
    }
  };

  const handleRenameProblem = (problemId: string, newTitle: string) => {
    updateProblemMutation.mutate({ problemId, data: { title: newTitle } });
  };

  const handleMoveProblem = (problemId: string, direction: "up" | "down") => {
    const index = problems.findIndex((p) => p.id === problemId);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= problems.length) return;

    const newProblems = [...problems];
    [newProblems[index], newProblems[newIndex]] = [newProblems[newIndex], newProblems[index]];
    
    const orderedIds = newProblems.map((p) => p.id);
    reorderProblemsMutation.mutate(orderedIds);
  };

  const getProblemHasExplanation = (problemId: string): boolean => {
    return false;
  };

  if (isChapterError) {
    setLocation("/");
    return null;
  }

  if (isChapterLoading || isProblemsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!chapter) {
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
          <Breadcrumb items={[{ label: chapter.title }]} />
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
            <HelpDialog title={chapterHelp.title} items={chapterHelp.items} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
            data-testid="button-add-problem"
          >
            <Plus className="h-4 w-4 mr-2" />
            問題を追加
          </Button>
        </div>

        {problems.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 flex justify-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">問題がありません</h2>
            <p className="text-muted-foreground mb-6">
              最初の問題を追加して学習を始めましょう！
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {problems.map((problem, index) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                hasExplanation={getProblemHasExplanation(problem.id)}
                editMode={editMode}
                onDelete={(id) => setDeleteProblemId(id)}
                onRename={handleRenameProblem}
                onMoveUp={() => handleMoveProblem(problem.id, "up")}
                onMoveDown={() => handleMoveProblem(problem.id, "down")}
                isFirst={index === 0}
                isLast={index === problems.length - 1}
                colorIndex={index}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しい問題を追加</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="problem-title">問題タイトル</Label>
            <Input
              id="problem-title"
              value={newProblemTitle}
              onChange={(e) => setNewProblemTitle(e.target.value)}
              placeholder="例: 変数の宣言"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddProblem();
              }}
              data-testid="input-problem-title"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddProblem}
              disabled={createProblemMutation.isPending}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-problem"
            >
              {createProblemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProblemId} onOpenChange={() => setDeleteProblemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>問題を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。問題内の全てのブロックも削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProblem}
              disabled={deleteProblemMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-problem"
            >
              {deleteProblemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
