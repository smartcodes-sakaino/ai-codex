import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Newspaper, ChevronUp, ChevronDown, Filter, ArrowUpDown, Loader2, Upload, RefreshCw, Wand2, Copy } from "lucide-react";
import { uploadFile, getIconPrompt } from "@/lib/api";
import {
  fetchArticleCategories,
  fetchArticleGenres,
  createArticleCategory,
  updateArticleCategory,
  deleteArticleCategory,
  reorderArticleCategories,
} from "@/lib/articleApi";
import { queryClient } from "@/lib/queryClient";
import type { ArticleCategoryWithCount } from "@shared/schema";
import mascotGraduate from "@assets/mascot-graduate.png";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArticleCategoryCard } from "@/components/article-category-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpDialog, articlesHelp } from "@/components/help-dialog";
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

export default function AdminArticlesPage() {
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryGenre, setNewCategoryGenre] = useState("");
  const [newCategoryGenreInput, setNewCategoryGenreInput] = useState("");
  const [useNewGenre, setUseNewGenre] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [filterGenre, setFilterGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("order");
  const [editCategory, setEditCategory] = useState<ArticleCategoryWithCount | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editGenreInput, setEditGenreInput] = useState("");
  const [editUseNewGenre, setEditUseNewGenre] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [genreError, setGenreError] = useState("");
  const [editTitleError, setEditTitleError] = useState("");
  const [editGenreError, setEditGenreError] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState<string | null>(null);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [isGeneratingEditIcon, setIsGeneratingEditIcon] = useState(false);
  const newCategoryFileInputRef = useRef<HTMLInputElement>(null);
  const editCategoryFileInputRef = useRef<HTMLInputElement>(null);
  const [promptDialogText, setPromptDialogText] = useState<string | null>(null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);

  const { toast } = useToast();

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ["/api/article-categories"],
    queryFn: fetchArticleCategories,
  });

  const { data: existingGenres = [] } = useQuery({
    queryKey: ["/api/article-genres"],
    queryFn: fetchArticleGenres,
  });

  const createCategoryMutation = useMutation({
    mutationFn: createArticleCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/article-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/article-genres"] });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateArticleCategory>[1] }) =>
      updateArticleCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/article-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/article-genres"] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteArticleCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/article-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/article-genres"] });
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: reorderArticleCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/article-categories"] });
    },
  });

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  const getFilteredAndSortedCategories = () => {
    let filtered = [...categories];
    
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

    if (!newCategoryTitle.trim()) {
      setTitleError("カテゴリ名は必須です");
      valid = false;
    }

    const isNewGenreMode = useNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? newCategoryGenreInput.trim() : newCategoryGenre;
    if (!genre) {
      setGenreError("ジャンルは必須です");
      valid = false;
    }

    return valid;
  };

  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsGeneratingIcon(true);
    try {
      const objectPath = await uploadFile(file);
      setNewCategoryIcon(objectPath);
    } catch (error) {
      console.error("Failed to upload icon:", error);
      toast({
        title: "画像アップロードエラー",
        description: "画像のアップロードに失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  const handleCreatePrompt = async (title: string, genre: string, colorIndex: number) => {
    if (!title.trim()) return;

    setIsCreatingPrompt(true);
    try {
      const { prompt } = await getIconPrompt({ title: title.trim(), genre: genre || undefined, colorIndex });
      setPromptDialogText(prompt);
    } catch (error) {
      console.error("Failed to create prompt:", error);
      toast({
        title: "プロンプト作成エラー",
        description: "プロンプトの作成に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPrompt(false);
    }
  };

  const handleCreatePromptForNewCategory = () => {
    const isNewGenreMode = useNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? newCategoryGenreInput.trim() : newCategoryGenre;
    handleCreatePrompt(newCategoryTitle, genre, categories.length % 6);
  };

  const handleCopyPrompt = async () => {
    if (!promptDialogText) return;
    try {
      await navigator.clipboard.writeText(promptDialogText);
      toast({ title: "コピーしました", description: "プロンプトをクリップボードにコピーしました" });
    } catch (error) {
      console.error("Failed to copy prompt:", error);
      toast({
        title: "コピーエラー",
        description: "クリップボードへのコピーに失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleAddCategory = () => {
    if (!validateAddForm()) return;
    
    const isNewGenreMode = useNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? newCategoryGenreInput.trim() : newCategoryGenre;
    createCategoryMutation.mutate({
      title: newCategoryTitle.trim(),
      genre: genre,
      icon: newCategoryIcon,
      colorIndex: categories.length % 6,
      order: categories.length,
    });
    setNewCategoryTitle("");
    setNewCategoryGenre("");
    setNewCategoryGenreInput("");
    setNewCategoryIcon(null);
    setUseNewGenre(false);
    setShowAddDialog(false);
  };

  const handleDeleteCategory = () => {
    if (deleteCategoryId) {
      deleteCategoryMutation.mutate(deleteCategoryId);
      setDeleteCategoryId(null);
    }
  };

  const handleMoveCategory = (categoryId: string, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === categoryId);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;
    
    const reordered = [...sorted];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    
    const orderedIds = reordered.map((c) => c.id);
    reorderCategoriesMutation.mutate(orderedIds);
  };

  const openEditDialog = (category: ArticleCategoryWithCount) => {
    setEditCategory(category);
    setEditTitle(category.title);
    setEditGenre(category.genre || "");
    setEditGenreInput("");
    setEditUseNewGenre(false);
    setEditTitleError("");
    setEditGenreError("");
    setEditIcon(category.icon || null);
  };

  const handleUploadEditIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsGeneratingEditIcon(true);
    try {
      const objectPath = await uploadFile(file);
      setEditIcon(objectPath);
    } catch (error) {
      console.error("Failed to upload icon:", error);
      toast({
        title: "画像アップロードエラー",
        description: "画像のアップロードに失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEditIcon(false);
    }
  };

  const handleCreatePromptForEditCategory = () => {
    const isNewGenreMode = editUseNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? editGenreInput.trim() : editGenre;
    handleCreatePrompt(editTitle, genre, editCategory?.colorIndex ?? 0);
  };

  const validateEditForm = (): boolean => {
    let valid = true;
    setEditTitleError("");
    setEditGenreError("");

    if (!editTitle.trim()) {
      setEditTitleError("カテゴリ名は必須です");
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

  const handleEditCategory = () => {
    if (!editCategory || !validateEditForm()) return;
    
    const isNewGenreMode = editUseNewGenre || existingGenres.length === 0;
    const genre = isNewGenreMode ? editGenreInput.trim() : editGenre;
    updateCategoryMutation.mutate({
      id: editCategory.id,
      data: {
        title: editTitle.trim(),
        genre: genre,
        icon: editIcon,
      },
    });
    setEditCategory(null);
  };

  const displayedCategories = getFilteredAndSortedCategories();

  if (isLoadingCategories) {
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
          <div className="flex items-center gap-2">
            <AdminNavMenu />
            <img
              src={mascotGraduate}
              alt="Codey mascot"
              className="h-10 w-10 object-contain"
              data-testid="img-mascot"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent">
              AI Codex
            </h1>
            <span className="text-muted-foreground text-sm hidden sm:inline">/ 記事管理</span>
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
                <span className="hidden sm:inline">編集モード</span>
              </Label>
            </div>
            <HelpDialog title={articlesHelp.title} items={articlesHelp.items} />
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
              data-testid="button-add-category"
            >
              <Plus className="h-4 w-4 mr-2" />
              カテゴリを追加
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

        {categories.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 flex justify-center">
              <Newspaper className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">カテゴリがありません</h2>
            <p className="text-muted-foreground mb-6">
              編集モードをオンにして、最初のカテゴリを追加しましょう！
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
        ) : displayedCategories.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              条件に一致するカテゴリがありません
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedCategories.map((category, index) => (
              <div key={category.id} className="relative group">
                <ArticleCategoryCard
                  category={category}
                  editMode={editMode}
                  onDelete={(id) => setDeleteCategoryId(id)}
                  onEdit={(c) => openEditDialog(c)}
                  colorIndex={category.colorIndex}
                />
                {editMode && sortBy === "order" && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveCategory(category.id, "up")}
                      disabled={sortedCategories.findIndex((c) => c.id === category.id) === 0}
                      data-testid={`button-move-up-${category.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveCategory(category.id, "down")}
                      disabled={sortedCategories.findIndex((c) => c.id === category.id) === categories.length - 1}
                      data-testid={`button-move-down-${category.id}`}
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
            <DialogTitle>新しいカテゴリを追加</DialogTitle>
            <DialogDescription>
              カテゴリ名とジャンルを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-title">カテゴリ名 *</Label>
              <Input
                id="category-title"
                value={newCategoryTitle}
                onChange={(e) => setNewCategoryTitle(e.target.value)}
                placeholder="例: MBTI"
                data-testid="input-category-title"
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
                  value={newCategoryGenreInput}
                  onChange={(e) => setNewCategoryGenreInput(e.target.value)}
                  placeholder="新しいジャンル名"
                  data-testid="input-new-genre"
                />
              ) : (
                <Select value={newCategoryGenre} onValueChange={setNewCategoryGenre}>
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
                {newCategoryIcon ? (
                  <div className="relative w-32 aspect-video rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/30" data-testid="container-icon-preview">
                    <img src={newCategoryIcon} alt="サムネイル" className="w-full h-full object-cover" data-testid="img-icon-preview" />
                  </div>
                ) : (
                  <div className="w-32 aspect-video rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground" data-testid="container-icon-placeholder">
                    <Upload className="h-6 w-6" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={newCategoryFileInputRef}
                  onChange={handleUploadIcon}
                  className="hidden"
                  data-testid="input-icon-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => newCategoryFileInputRef.current?.click()}
                  disabled={isGeneratingIcon}
                  data-testid="button-upload-icon"
                >
                  {isGeneratingIcon ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      アップロード中...
                    </>
                  ) : newCategoryIcon ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      画像を変更
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      画像をアップロード
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreatePromptForNewCategory}
                  disabled={isCreatingPrompt || !newCategoryTitle.trim()}
                  data-testid="button-create-prompt"
                >
                  {isCreatingPrompt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      プロンプトを作成
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-icon-hint">
                サムネイルに使う画像をアップロードしてください。生成AI用のプロンプトも作成できます
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddCategory}
              disabled={createCategoryMutation.isPending}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-category"
            >
              {createCategoryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>カテゴリを編集</DialogTitle>
            <DialogDescription>
              カテゴリ名やジャンルを変更できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-title">カテゴリ名 *</Label>
              <Input
                id="edit-category-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="例: MBTI"
                data-testid="input-edit-category-title"
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
                    <Upload className="h-6 w-6" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={editCategoryFileInputRef}
                  onChange={handleUploadEditIcon}
                  className="hidden"
                  data-testid="input-edit-icon-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => editCategoryFileInputRef.current?.click()}
                  disabled={isGeneratingEditIcon}
                  data-testid="button-upload-edit-icon"
                >
                  {isGeneratingEditIcon ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      アップロード中...
                    </>
                  ) : editIcon ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      画像を変更
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      画像をアップロード
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreatePromptForEditCategory}
                  disabled={isCreatingPrompt || !editTitle.trim()}
                  data-testid="button-create-edit-prompt"
                >
                  {isCreatingPrompt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      プロンプトを作成
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCategory(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleEditCategory}
              disabled={updateCategoryMutation.isPending}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-edit-category"
            >
              {updateCategoryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。カテゴリ内の全ての記事も削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!promptDialogText} onOpenChange={(open) => !open && setPromptDialogText(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>画像生成用プロンプト</DialogTitle>
            <DialogDescription>
              このテキストをコピーして、Gemini等の画像生成AIに貼り付けて使ってください。
            </DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            value={promptDialogText ?? ""}
            className="w-full h-48 rounded-md border border-input bg-background p-3 text-sm resize-none"
            data-testid="textarea-icon-prompt"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogText(null)}>
              閉じる
            </Button>
            <Button onClick={handleCopyPrompt} data-testid="button-copy-prompt">
              <Copy className="h-4 w-4 mr-2" />
              コピー
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
