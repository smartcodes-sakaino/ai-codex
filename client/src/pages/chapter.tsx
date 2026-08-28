import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Plus, Edit, FileText, Loader2, ChevronDown, FileVideo, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  fetchChapter,
  fetchProblems,
  fetchProblemWithBlocks,
  createProblem,
  createBlock,
  updateProblem,
  deleteProblem,
  reorderProblems,
  uploadFile,
} from "@/lib/api";
import type { Chapter, ProblemWithStatus, VideoBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProblemCard } from "@/components/problem-card";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, chapterHelp } from "@/components/help-dialog";
import { useToast } from "@/hooks/use-toast";
import { VideoPlayer } from "@/components/video-player";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

export default function ChapterPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProblemTitle, setNewProblemTitle] = useState("");
  const [deleteProblemId, setDeleteProblemId] = useState<string | null>(null);
  const { toast } = useToast();

  const [showAddElearningDialog, setShowAddElearningDialog] = useState(false);
  const [elTitle, setElTitle] = useState("");
  const [elDescription, setElDescription] = useState("");
  const [elVideoPath, setElVideoPath] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [isCreatingElearning, setIsCreatingElearning] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB

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
  } = useQuery<ProblemWithStatus[]>({
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

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setElVideoPath(url);
    } catch (error) {
      console.error("Video upload error:", error);
      setVideoError("動画のアップロードに失敗しました。");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const resetElearningForm = () => {
    setElTitle("");
    setElDescription("");
    setElVideoPath("");
    setVideoError("");
  };

  const handleAddElearning = async () => {
    if (!elTitle.trim() || !elVideoPath || !id) return;
    setIsCreatingElearning(true);
    try {
      const problem = await createProblem({
        chapterId: id,
        title: elTitle.trim(),
        order: problems.length,
      });
      const videoContent: VideoBlockContent = {
        title: elTitle.trim(),
        videoObjectPath: elVideoPath,
        description: elDescription,
      };
      await createBlock({ problemId: problem.id, type: "video", content: videoContent, order: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", id, "problems"] });
      setShowAddElearningDialog(false);
      resetElearningForm();
    } catch (error) {
      console.error("Failed to create e-learning content:", error);
      toast({ title: "エラー", description: "e-learningコンテンツの作成に失敗しました。", variant: "destructive" });
    } finally {
      setIsCreatingElearning(false);
    }
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

  const [draggedProblemId, setDraggedProblemId] = useState<string | null>(null);
  const [dragOverProblemId, setDragOverProblemId] = useState<string | null>(null);

  const handleProblemDrop = (targetId: string) => {
    if (!draggedProblemId || draggedProblemId === targetId) {
      setDraggedProblemId(null);
      setDragOverProblemId(null);
      return;
    }
    const fromIndex = problems.findIndex((p) => p.id === draggedProblemId);
    const toIndex = problems.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedProblemId(null);
      setDragOverProblemId(null);
      return;
    }

    const reordered = [...problems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    reorderProblemsMutation.mutate(reordered.map((p) => p.id));

    setDraggedProblemId(null);
    setDragOverProblemId(null);
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
          <div className="flex items-center gap-2 min-w-0">
            <AdminNavMenu />
            <Breadcrumb items={[{ label: chapter.title }]} />
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
            <HelpDialog title={chapterHelp.title} items={chapterHelp.items} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                data-testid="button-add-problem"
              >
                <Plus className="h-4 w-4 mr-2" />
                問題を追加
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowAddDialog(true)} data-testid="menu-add-text-problem">
                <FileText className="h-4 w-4 mr-2 text-orange-500" />
                テキストコンテンツを追加
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowAddElearningDialog(true)}
                data-testid="menu-add-elearning"
              >
                <FileVideo className="h-4 w-4 mr-2 text-purple-500" />
                e-learningを追加
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                hasExplanation={problem.hasExplanation}
                hasLecture={problem.hasLecture}
                editMode={editMode}
                onDelete={(id) => setDeleteProblemId(id)}
                onRename={handleRenameProblem}
                onMoveUp={() => handleMoveProblem(problem.id, "up")}
                onMoveDown={() => handleMoveProblem(problem.id, "down")}
                isFirst={index === 0}
                isLast={index === problems.length - 1}
                colorIndex={index}
                onDragStart={() => setDraggedProblemId(problem.id)}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (draggedProblemId && draggedProblemId !== problem.id) {
                    setDragOverProblemId(problem.id);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleProblemDrop(problem.id);
                }}
                onDragEnd={() => {
                  setDraggedProblemId(null);
                  setDragOverProblemId(null);
                }}
                isDragging={draggedProblemId === problem.id}
                isDragOver={dragOverProblemId === problem.id}
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

      <Dialog
        open={showAddElearningDialog}
        onOpenChange={(open) => {
          setShowAddElearningDialog(open);
          if (!open) resetElearningForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>e-learningを追加</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="el-title">タイトル</Label>
              <Input
                id="el-title"
                value={elTitle}
                onChange={(e) => setElTitle(e.target.value)}
                placeholder="例: 第1回 変数とは"
                data-testid="input-elearning-title"
              />
            </div>

            <div className="space-y-2">
              <Label>動画ファイル</Label>
              {elVideoPath ? (
                <div className="space-y-2">
                  <VideoPlayer src={elVideoPath} title="動画プレビュー" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setElVideoPath("")}
                    className="text-destructive"
                    data-testid="button-remove-elearning-video"
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
                    onChange={handleVideoFileChange}
                    className="hidden"
                    data-testid="input-elearning-video-upload"
                  />
                </div>
              )}
              {videoError && <p className="text-sm text-destructive">{videoError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="el-description">説明文</Label>
              <Textarea
                id="el-description"
                value={elDescription}
                onChange={(e) => setElDescription(e.target.value)}
                placeholder="動画の説明を入力してください..."
                className="min-h-[100px] resize-y"
                data-testid="textarea-elearning-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddElearningDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddElearning}
              disabled={!elTitle.trim() || !elVideoPath || isCreatingElearning}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-elearning"
            >
              {isCreatingElearning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
