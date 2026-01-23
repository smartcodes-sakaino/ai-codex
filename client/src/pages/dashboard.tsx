import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, BookOpen, ChevronUp, ChevronDown, Filter, ArrowUpDown, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { fetchChapters, fetchGenres, createChapter, updateChapter, deleteChapter, reorderChapters, generateIcon } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { ChapterWithCount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChapterCard } from "@/components/chapter-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, dashboardHelp } from "@/components/help-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type SortOption = "order" | "name" | "createdAt";

export default function Dashboard() {
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterGenre, setNewChapterGenre] = useState("");
  const [newChapterGenreInput, setNewChapterGenreInput] = useState("");
  const [useNewGenre, setUseNewGenre] = useState(false);
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [filterGenre, setFilterGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("order");
  const [editChapter, setEditChapter] = useState<ChapterWithCount | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editGenreInput, setEditGenreInput] = useState("");
  const [editUseNewGenre, setEditUseNewGenre] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [genreError, setGenreError] = useState("");
  const [editTitleError, setEditTitleError] = useState("");
  const [editGenreError, setEditGenreError] = useState("");
  const [newChapterIcon, setNewChapterIcon] = useState<string | null>(null);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [isGeneratingEditIcon, setIsGeneratingEditIcon] = useState(false);

  const { toast } = useToast();

  const { data: chapters = [], isLoading: isLoadingChapters } = useQuery({
    queryKey: ["/api/chapters"],
    queryFn: fetchChapters,
  });

  const { data: existingGenres = [] } = useQuery({
    queryKey: ["/api/genres"],
    queryFn: fetchGenres,
  });

  const createChapterMutation = useMutation({
    mutationFn: createChapter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/genres"] });
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateChapter>[1] }) =>
      updateChapter(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/genres"] });
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: deleteChapter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/genres"] });
    },
  });

  const reorderChaptersMutation = useMutation({
    mutationFn: reorderChapters,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
    },
  });

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  const getFilteredAndSortedChapters = () => {
    let filtered = [...chapters];
    
    if (filterGenre !== "all") {
      filtered = filtered.filter((c) => c.genre === filterGenre);
    }
    
    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => a.title.localeCompare(b.title, "ja"));
        break;
      case "createdAt":
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "order":
      default:
        filtered.sort((a, b) => a.order - b.order);
        break;
    }
    
    return filtered;
  };

  const validateAddForm = (): boolean => {
    let valid = true;
    setTitleError("");
    setGenreError("");

    if (!newChapterTitle.trim()) {
      setTitleError("セクション名は必須です");
      valid = false;
    }

    const isNewGenreMode = useNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? newChapterGenreInput.trim() : newChapterGenre;
    if (!genre) {
      setGenreError("ジャンルは必須です");
      valid = false;
    }

    return valid;
  };

  const handleGenerateIcon = async () => {
    if (!newChapterTitle.trim()) return;
    
    setIsGeneratingIcon(true);
    try {
      const isNewGenreMode = useNewGenre || existingGenres.length === 0;
      const genre = isNewGenreMode ? newChapterGenreInput.trim() : newChapterGenre;
      // New chapter gets the next colorIndex based on current chapter count
      const colorIndex = chapters.length % 6;
      const result = await generateIcon({ title: newChapterTitle.trim(), genre: genre || undefined, colorIndex });
      setNewChapterIcon(result.iconUrl);
    } catch (error) {
      console.error("Failed to generate icon:", error);
      toast({
        title: "サムネイル生成エラー",
        description: "サムネイルの生成に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  const handleAddChapter = () => {
    if (!validateAddForm()) return;
    
    const isNewGenreMode = useNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? newChapterGenreInput.trim() : newChapterGenre;
    createChapterMutation.mutate({
      title: newChapterTitle.trim(),
      genre: genre,
      icon: newChapterIcon,
      order: chapters.length,
    });
    setNewChapterTitle("");
    setNewChapterGenre("");
    setNewChapterGenreInput("");
    setNewChapterIcon(null);
    setUseNewGenre(false);
    setShowAddDialog(false);
  };

  const handleDeleteChapter = () => {
    if (deleteChapterId) {
      deleteChapterMutation.mutate(deleteChapterId);
      setDeleteChapterId(null);
    }
  };

  const handleMoveChapter = (chapterId: string, direction: "up" | "down") => {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === chapterId);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;
    
    const reordered = [...sorted];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    
    const orderedIds = reordered.map((c) => c.id);
    reorderChaptersMutation.mutate(orderedIds);
  };

  const openEditDialog = (chapter: ChapterWithCount) => {
    setEditChapter(chapter);
    setEditTitle(chapter.title);
    setEditGenre(chapter.genre || "");
    setEditGenreInput("");
    setEditUseNewGenre(false);
    setEditTitleError("");
    setEditGenreError("");
    setEditIcon(chapter.icon || null);
  };

  const handleGenerateEditIcon = async () => {
    if (!editTitle.trim() || !editChapter) return;
    
    setIsGeneratingEditIcon(true);
    try {
      const isNewGenreMode = editUseNewGenre || existingGenres.length === 0;
      const genre = isNewGenreMode ? editGenreInput.trim() : editGenre;
      // Use the chapter's position in the list for colorIndex
      const chapterIndex = chapters.findIndex(c => c.id === editChapter.id);
      const colorIndex = (chapterIndex >= 0 ? chapterIndex : 0) % 6;
      const result = await generateIcon({ title: editTitle.trim(), genre: genre || undefined, colorIndex });
      setEditIcon(result.iconUrl);
    } catch (error) {
      console.error("Failed to generate icon:", error);
      toast({
        title: "サムネイル生成エラー",
        description: "サムネイルの生成に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEditIcon(false);
    }
  };

  const validateEditForm = (): boolean => {
    let valid = true;
    setEditTitleError("");
    setEditGenreError("");

    if (!editTitle.trim()) {
      setEditTitleError("セクション名は必須です");
      valid = false;
    }

    const isNewGenreMode = editUseNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? editGenreInput.trim() : editGenre;
    if (!genre) {
      setEditGenreError("ジャンルは必須です");
      valid = false;
    }

    return valid;
  };

  const handleEditChapter = () => {
    if (!editChapter || !validateEditForm()) return;
    
    const isNewGenreMode = editUseNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? editGenreInput.trim() : editGenre;
    updateChapterMutation.mutate({
      id: editChapter.id,
      data: {
        title: editTitle.trim(),
        genre: genre,
        icon: editIcon,
      },
    });
    setEditChapter(null);
  };

  const displayedChapters = getFilteredAndSortedChapters();

  if (isLoadingChapters) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent">
            AI Codex
          </h1>
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
                <span className="hidden sm:inline">編集モード</span>
              </Label>
            </div>
            <HelpDialog title={dashboardHelp.title} items={dashboardHelp.items} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {editMode && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-add-chapter"
            >
              <Plus className="h-4 w-4 mr-2" />
              チャプターを追加
            </Button>
          )}
          
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterGenre} onValueChange={setFilterGenre}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-genre">
                  <SelectValue placeholder="ジャンル" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {existingGenres.map((genre) => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
                  <SelectValue placeholder="並び替え" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">カスタム順</SelectItem>
                  <SelectItem value="name">名前順</SelectItem>
                  <SelectItem value="createdAt">作成日順</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 flex justify-center">
              <BookOpen className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">チャプターがありません</h2>
            <p className="text-muted-foreground mb-6">
              編集モードをオンにして、最初のチャプターを追加しましょう！
            </p>
            {!editMode && (
              <Button
                onClick={() => setEditMode(true)}
                className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
                data-testid="button-enable-edit-mode"
              >
                <Edit className="h-4 w-4 mr-2" />
                編集モードをオン
              </Button>
            )}
          </div>
        ) : displayedChapters.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              条件に一致するチャプターがありません
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedChapters.map((chapter, index) => (
              <div key={chapter.id} className="relative group">
                <ChapterCard
                  chapter={chapter}
                  editMode={editMode}
                  onDelete={(id) => setDeleteChapterId(id)}
                  onEdit={(c) => openEditDialog(c)}
                  colorIndex={index}
                />
                {editMode && sortBy === "order" && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveChapter(chapter.id, "up")}
                      disabled={sortedChapters.findIndex((c) => c.id === chapter.id) === 0}
                      data-testid={`button-move-up-${chapter.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveChapter(chapter.id, "down")}
                      disabled={sortedChapters.findIndex((c) => c.id === chapter.id) === chapters.length - 1}
                      data-testid={`button-move-down-${chapter.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいチャプターを追加</DialogTitle>
            <DialogDescription>
              セクション名とジャンルを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chapter-title">セクション名 *</Label>
              <Input
                id="chapter-title"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="例: JavaScript基礎"
                data-testid="input-chapter-title"
              />
              {titleError && <p className="text-sm text-destructive">{titleError}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>ジャンル *</Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  id="use-new-genre"
                  checked={useNewGenre}
                  onCheckedChange={setUseNewGenre}
                />
                <Label htmlFor="use-new-genre" className="text-sm">
                  新しいジャンルを入力
                </Label>
              </div>
              
              {useNewGenre || existingGenres.length === 0 ? (
                <Input
                  value={newChapterGenreInput}
                  onChange={(e) => setNewChapterGenreInput(e.target.value)}
                  placeholder="新しいジャンル名"
                  data-testid="input-new-genre"
                />
              ) : (
                <Select value={newChapterGenre} onValueChange={setNewChapterGenre}>
                  <SelectTrigger data-testid="select-genre">
                    <SelectValue placeholder="ジャンルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingGenres.map((genre) => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {genreError && <p className="text-sm text-destructive">{genreError}</p>}
            </div>

            <div className="space-y-2">
              <Label>サムネイル</Label>
              <div className="flex items-center gap-4 flex-wrap">
                {newChapterIcon ? (
                  <div className="relative w-32 aspect-video rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/30" data-testid="container-icon-preview">
                    <img src={newChapterIcon} alt="サムネイル" className="w-full h-full object-cover" data-testid="img-icon-preview" />
                  </div>
                ) : (
                  <div className="w-32 aspect-video rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground" data-testid="container-icon-placeholder">
                    <Sparkles className="h-6 w-6" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateIcon}
                  disabled={isGeneratingIcon || !newChapterTitle.trim()}
                  data-testid="button-generate-icon"
                >
                  {isGeneratingIcon ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      生成中...
                    </>
                  ) : newChapterIcon ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      再生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AIでサムネイル生成
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-icon-hint">
                セクション名を入力してからサムネイルを生成してください
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddChapter}
              disabled={createChapterMutation.isPending}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-chapter"
            >
              {createChapterMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editChapter} onOpenChange={() => setEditChapter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>チャプターを編集</DialogTitle>
            <DialogDescription>
              セクション名やジャンルを変更できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-chapter-title">セクション名 *</Label>
              <Input
                id="edit-chapter-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="例: JavaScript基礎"
                data-testid="input-edit-chapter-title"
              />
              {editTitleError && <p className="text-sm text-destructive">{editTitleError}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>ジャンル *</Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  id="edit-use-new-genre"
                  checked={editUseNewGenre}
                  onCheckedChange={setEditUseNewGenre}
                />
                <Label htmlFor="edit-use-new-genre" className="text-sm">
                  新しいジャンルを入力
                </Label>
              </div>
              
              {editUseNewGenre || existingGenres.length === 0 ? (
                <Input
                  value={editGenreInput}
                  onChange={(e) => setEditGenreInput(e.target.value)}
                  placeholder="新しいジャンル名"
                  data-testid="input-edit-new-genre"
                />
              ) : (
                <Select value={editGenre} onValueChange={setEditGenre}>
                  <SelectTrigger data-testid="select-edit-genre">
                    <SelectValue placeholder="ジャンルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingGenres.map((genre) => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {editGenreError && <p className="text-sm text-destructive">{editGenreError}</p>}
            </div>

            <div className="space-y-2">
              <Label>サムネイル</Label>
              <div className="flex items-center gap-4 flex-wrap">
                {editIcon ? (
                  <div className="relative w-32 aspect-video rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/30" data-testid="container-edit-icon-preview">
                    <img src={editIcon} alt="サムネイル" className="w-full h-full object-cover" data-testid="img-edit-icon-preview" />
                  </div>
                ) : (
                  <div className="w-32 aspect-video rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground" data-testid="container-edit-icon-placeholder">
                    <Sparkles className="h-6 w-6" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateEditIcon}
                  disabled={isGeneratingEditIcon || !editTitle.trim()}
                  data-testid="button-generate-edit-icon"
                >
                  {isGeneratingEditIcon ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      生成中...
                    </>
                  ) : editIcon ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      再生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AIでサムネイル生成
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditChapter(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleEditChapter}
              disabled={updateChapterMutation.isPending}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-edit-chapter"
            >
              {updateChapterMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteChapterId} onOpenChange={() => setDeleteChapterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>チャプターを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。チャプター内の全ての問題も削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChapter}
              disabled={deleteChapterMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-chapter"
            >
              {deleteChapterMutation.isPending ? (
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
