import { useState } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCourses,
  fetchCourseProgress,
  fetchCourseProgressDetail,
  exportCourseProgressSheet,
  type ProgressDetailItem,
} from "@/lib/lmsApi";

// The submission-based 合格/不合格/未提出 labels only make sense when the
// problem is actually gated by a code submission — a video- or self-review-
// gated item's submission history is just optional practice, so it needs its
// own labels reflecting what's actually blocking it from being "done".
function renderProgressStatus(item: ProgressDetailItem) {
  if (item.status === "done") {
    return <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">合格</Badge>;
  }
  if (item.status === "locked") {
    return <Badge variant="secondary">ロック中</Badge>;
  }
  if (item.gate === "video") {
    return item.videoStarted ? (
      <Badge className="bg-[#FDE6D3] text-[#E8722C] border-transparent">視聴中</Badge>
    ) : (
      <Badge variant="secondary">未視聴</Badge>
    );
  }
  if (item.gate === "self_review") {
    return <Badge variant="secondary">セルフレビュー待ち</Badge>;
  }
  return item.attempts > 0 ? (
    <Badge className="bg-[#FDECEC] text-[#E03131] border-transparent">不合格</Badge>
  ) : (
    <Badge variant="secondary">未提出</Badge>
  );
}

export default function AdminProgressPage() {
  const { toast } = useToast();
  const { data: courses = [] } = useQuery({ queryKey: ["/api/admin/courses"], queryFn: fetchAdminCourses });
  // A dashboard course row links here with ?course=<id> so it opens straight
  // to that course's progress rather than always landing on courses[0].
  const courseIdFromUrl = new URLSearchParams(useSearch()).get("course") || "";
  const [courseId, setCourseId] = useState<string>("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const activeCourseId = courseId || courseIdFromUrl || courses[0]?.id || "";

  const { data: progress = [] } = useQuery({
    queryKey: ["/api/admin/courses", activeCourseId, "progress"],
    queryFn: () => fetchCourseProgress(activeCourseId),
    enabled: !!activeCourseId,
  });

  const { data: detail = [] } = useQuery({
    queryKey: ["/api/admin/courses", activeCourseId, "progress", expandedUserId],
    queryFn: () => fetchCourseProgressDetail(activeCourseId, expandedUserId as string),
    enabled: !!activeCourseId && !!expandedUserId,
  });

  const exportMutation = useMutation({
    mutationFn: () => exportCourseProgressSheet(activeCourseId),
    onSuccess: (result) => {
      toast({ title: `「${result.fileName}」を作成しました`, description: result.url });
      window.open(result.url, "_blank");
    },
    onError: () => {
      toast({ title: "エクスポートに失敗しました", variant: "destructive" });
    },
  });

  return (
    <AdminLayout title="進捗確認">
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="w-72">
          <Select value={activeCourseId} onValueChange={setCourseId}>
            <SelectTrigger data-testid="select-progress-course">
              <SelectValue placeholder="コースを選択" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={!activeCourseId || exportMutation.isPending}
          data-testid="button-export-progress"
        >
          📄 提出用シートをエクスポート
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">受講者がまだ割り当てられていません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>氏名</TableHead>
                  <TableHead>進捗</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.map((row) => {
                  const isExpanded = expandedUserId === row.userId;
                  const pct = row.total ? Math.round((row.passedCount / row.total) * 100) : 0;
                  return (
                    <>
                      <TableRow
                        key={row.userId}
                        className="cursor-pointer"
                        onClick={() => setExpandedUserId(isExpanded ? null : row.userId)}
                        data-testid={`row-progress-${row.userId}`}
                      >
                        <TableCell>{isExpanded ? "▾" : "▸"}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="w-56">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="w-32" />
                            <span className="text-xs text-muted-foreground">
                              {row.passedCount}/{row.total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.complete ? (
                            <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">修了</Badge>
                          ) : (
                            <Badge className="bg-[#FBF0DA] text-[#E8A317] border-transparent">進行中</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={3} className="p-0">
                            <div className="py-2 pr-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>問題</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>挑戦回数</TableHead>
                                    <TableHead>AI質問回数</TableHead>
                                    <TableHead>直近のAI判定</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detail.map((item) => (
                                    <TableRow key={item.problemId}>
                                      <TableCell>{item.problemTitle}</TableCell>
                                      <TableCell>{renderProgressStatus(item)}</TableCell>
                                      <TableCell>{item.attempts}回</TableCell>
                                      <TableCell>{item.aiQuestionCount}回</TableCell>
                                      <TableCell className="max-w-xs text-xs text-muted-foreground truncate">
                                        {item.submissions[item.submissions.length - 1]?.aiSummary || "—"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
