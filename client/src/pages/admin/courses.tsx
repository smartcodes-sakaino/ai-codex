import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchChapters } from "@/lib/api";
import {
  fetchAdminCourses,
  createCourseLms,
  updateCourseLms,
  deleteCourseLms,
  fetchUsers,
  fetchGroupsLms,
  type LmsCourse,
  type LmsUser,
  type LmsGroup,
} from "@/lib/lmsApi";

type AssignTarget = { type: "user" | "group"; id: string };

export default function AdminCoursesPage() {
  const { toast } = useToast();
  const { data: courses = [] } = useQuery({ queryKey: ["/api/admin/courses"], queryFn: fetchAdminCourses });
  const { data: chapters = [] } = useQuery({ queryKey: ["/api/chapters"], queryFn: fetchChapters });
  const { data: users = [] } = useQuery({ queryKey: ["/api/admin/users"], queryFn: fetchUsers });
  const { data: groups = [] } = useQuery({ queryKey: ["/api/admin/groups"], queryFn: fetchGroupsLms });

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AssignTarget[]>([]);
  const [assignType, setAssignType] = useState<"user" | "group">("group");
  const [assignTargetId, setAssignTargetId] = useState("");

  const resetForm = () => {
    setEditingCourseId(null);
    setTitle("");
    setChapterIds([]);
    setAssignments([]);
    setAssignTargetId("");
  };

  const startEditing = (course: LmsCourse) => {
    setEditingCourseId(course.id);
    setTitle(course.title);
    setChapterIds(course.chapterIds);
    setAssignments(course.assignments);
    setAssignTargetId("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formRef = useRef<HTMLDivElement>(null);

  const createMutation = useMutation({
    mutationFn: createCourseLms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      resetForm();
      toast({ title: "コースを作成しました" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { title: string; chapterIds: string[]; assignments: AssignTarget[] }) =>
      updateCourseLms(editingCourseId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      resetForm();
      toast({ title: "コースを更新しました" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourseLms,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      if (editingCourseId === deletedId) resetForm();
      toast({ title: "コースを削除しました" });
    },
  });

  const availableChapters = chapters.filter((ch) => !chapterIds.includes(ch.id));
  const selectedChapters = chapterIds.map((id) => chapters.find((c) => c.id === id)).filter(Boolean) as typeof chapters;

  const moveChapter = (id: string, dir: -1 | 1) => {
    setChapterIds((prev) => {
      const idx = prev.indexOf(id);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const targetOptions: (LmsUser | LmsGroup)[] = assignType === "group" ? groups : users;
  const describeTarget = (t: AssignTarget) => {
    const found =
      t.type === "group" ? groups.find((g) => g.id === t.id) : users.find((u) => u.id === t.id);
    return `${t.type === "group" ? "グループ" : "個人"}: ${found?.name ?? "?"}`;
  };

  // Selecting a target adds it immediately (rather than requiring a separate
  // "追加" click) so a picked-but-not-yet-added target can never be silently
  // lost when the course is submitted.
  const handlePickTarget = (id: string) => {
    if (!id) return;
    if (!assignments.some((a) => a.type === assignType && a.id === id)) {
      setAssignments((prev) => [...prev, { type: assignType, id }]);
    }
    setAssignTargetId("");
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "コース名を入力してください", variant: "destructive" });
      return;
    }
    if (chapterIds.length === 0) {
      toast({ title: "チャプターを1つ以上選んでください", variant: "destructive" });
      return;
    }
    const data = { title: title.trim(), chapterIds, assignments };
    if (editingCourseId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout title="コース管理">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">公開中のコース</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだコースがありません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>コース名</TableHead>
                  <TableHead>チャプター数</TableHead>
                  <TableHead>割当先</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id} data-testid={`row-course-${c.id}`}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.chapterIds.length}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.assignments.map(describeTarget).join(", ") || "未割当"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(c)}
                        data-testid={`button-edit-course-${c.id}`}
                      >
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(c.id)}
                        data-testid={`button-delete-course-${c.id}`}
                      >
                        削除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card ref={formRef}>
        <CardHeader>
          <CardTitle className="text-base">{editingCourseId ? "コースを編集" : "新規コース作成"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>コース名</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 新人エンジニア基礎研修"
              data-testid="input-course-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">未選択のチャプター</Label>
              <div className="border rounded-md min-h-[140px]">
                {availableChapters.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">すべて選択済みです</p>
                ) : (
                  availableChapters.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 text-sm"
                    >
                      <span>{ch.title}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChapterIds((prev) => [...prev, ch.id])}
                        data-testid={`button-add-chapter-${ch.id}`}
                      >
                        追加 →
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">選択済み(この順で出題)</Label>
              <div className="border rounded-md min-h-[140px]">
                {selectedChapters.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">左のリストから追加してください</p>
                ) : (
                  selectedChapters.map((ch, i) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 text-sm"
                    >
                      <span>
                        <Badge variant="secondary" className="mr-2">
                          {i + 1}
                        </Badge>
                        {ch.title}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => moveChapter(ch.id, -1)}>
                          ↑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => moveChapter(ch.id, 1)}>
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setChapterIds((prev) => prev.filter((id) => id !== ch.id))}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">割当先を追加</Label>
            <div className="flex gap-2">
              <Select value={assignType} onValueChange={(v) => setAssignType(v as "user" | "group")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">グループ</SelectItem>
                  <SelectItem value="user">個人</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignTargetId} onValueChange={handlePickTarget}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="選択するとすぐに追加されます" />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {assignments.map((a) => (
                <Badge key={`${a.type}-${a.id}`} variant="secondary">
                  {describeTarget(a)}
                  <button
                    className="ml-1.5"
                    onClick={() => setAssignments((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)))}
                  >
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-create-course"
            >
              {editingCourseId ? "コースを更新する" : "このコースを作成"}
            </Button>
            {editingCourseId && (
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-edit-course">
                キャンセル
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
