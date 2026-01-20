import { useState, useEffect } from "react";
import { Plus, Edit, BookOpen } from "lucide-react";
import { storage } from "@/lib/storage";
import type { ChapterWithCount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChapterCard } from "@/components/chapter-card";
import { ThemeToggle } from "@/components/theme-toggle";
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

export default function Dashboard() {
  const [chapters, setChapters] = useState<ChapterWithCount[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);

  useEffect(() => {
    loadChapters();
  }, []);

  const loadChapters = () => {
    const data = storage.getChaptersWithCount();
    setChapters(data.sort((a, b) => a.order - b.order));
  };

  const handleAddChapter = () => {
    if (!newChapterTitle.trim()) return;
    storage.createChapter({
      title: newChapterTitle.trim(),
      order: chapters.length,
    });
    setNewChapterTitle("");
    setShowAddDialog(false);
    loadChapters();
  };

  const handleDeleteChapter = () => {
    if (deleteChapterId) {
      storage.deleteChapter(deleteChapterId);
      setDeleteChapterId(null);
      loadChapters();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent">
            プログラミング学習
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
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {editMode && (
          <div className="mb-6">
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-add-chapter"
            >
              <Plus className="h-4 w-4 mr-2" />
              チャプターを追加
            </Button>
          </div>
        )}

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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {chapters.map((chapter, index) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                editMode={editMode}
                onDelete={(id) => setDeleteChapterId(id)}
                colorIndex={index}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいチャプターを追加</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="chapter-title">チャプター名</Label>
            <Input
              id="chapter-title"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="例: JavaScript基礎"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddChapter();
              }}
              data-testid="input-chapter-title"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddChapter}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              data-testid="button-confirm-add-chapter"
            >
              追加
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
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-chapter"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
