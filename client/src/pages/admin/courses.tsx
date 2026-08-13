import { useState } from "react";
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
  deleteCourseLms,
  fetchUsers,
  fetchGroupsLms,
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

  const [title, setTitle] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AssignTarget[]>([]);
  const [assignType, setAssignType] = useState<"user" | "group">("group");
  const [assignTargetId, setAssignTargetId] = useState("");

  const createMutation = useMutation({
    mutationFn: createCourseLms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      setTitle("");
      setChapterIds([]);
      setAssignments([]);
      toast({ title: "コースを作成しました" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourseLms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
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

  const handleCreate = () => {
    if (!title.trim()) {
      toast({ title: "コース名を入力してください", variant: "destructive" });
      return;
    }
    if (chapterIds.length === 0) {
      toast({ title: "チャプターを1つ以上選んでください", variant: "destructive" });
      return;
    }
    createMutation.mutate({ title: title.trim(), chapterIds, assignments });
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規コース作成</CardTitle>
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
              <Select value={assignTargetId} onValueChange={setAssignTargetId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  if (!assignTargetId) return;
                  if (assignments.some((a) => a.type === assignType && a.id === assignTargetId)) return;
                  setAssignments((prev) => [...prev, { type: assignType, id: assignTargetId }]);
                }}
              >
                追加
              </Button>
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

          <Button
            className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            data-testid="button-create-course"
          >
            このコースを作成
          </Button>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
