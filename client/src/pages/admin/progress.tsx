import { Fragment, useState } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCourses,
  fetchCourseProgress,
  fetchCourseProgressDetail,
  exportCourseProgressSheet,
  updateLearnerMonitoring,
  formatShortDate,
  todayJst,
  type ProgressDetailItem,
  type ProgressSummaryRow,
  type LearnerStatus,
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

// Learner-level status: "pend" is set by hand; otherwise it's derived —
// 修了 for this course, 停滞 after 14 idle days, else 進行中.
function renderLearnerStatus(row: ProgressSummaryRow) {
  if (row.learnerStatus === "pend") {
    return <Badge variant="secondary">pend</Badge>;
  }
  if (row.complete) {
    return <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">修了</Badge>;
  }
  if (row.stagnant) {
    return (
      <Badge
        className="bg-[#FDECEC] text-[#E03131] border-transparent gap-1"
        title={`${row.daysIdle}日間 活動がありません`}
        data-testid={`badge-stagnant-${row.userId}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#E03131]" />
        停滞
      </Badge>
    );
  }
  return <Badge className="bg-[#FBF0DA] text-[#E8A317] border-transparent">進行中</Badge>;
}

function renderDue(dueDate: string | null, today: string, highlightOverdue: boolean) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  const overdue = highlightOverdue && dueDate < today;
  return (
    <span className={overdue ? "text-[#E03131] font-medium" : ""}>
      {formatShortDate(dueDate)}
      {overdue && " 超過"}
    </span>
  );
}

function renderAchievement(item: ProgressDetailItem) {
  if (item.status !== "done" || item.onTime === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (item.onTime) {
    return <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">期限内</Badge>;
  }
  const lateDays =
    item.dueDate && item.completedDate
      ? Math.round((Date.parse(item.completedDate) - Date.parse(item.dueDate)) / 86400000)
      : null;
  return (
    <Badge className="bg-[#FDECEC] text-[#E03131] border-transparent">
      遅れ{lateDays ? ` +${lateDays}日` : ""}
    </Badge>
  );
}

function FeedbackSection({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-2">
      <h4 className="text-xs font-bold text-muted-foreground mb-0.5">{title}</h4>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

// Saves on blur / Enter rather than per keystroke; stops click propagation
// so editing doesn't also toggle the row's expanded detail.
function SlackChannelInput({ row, onSave }: { row: ProgressSummaryRow; onSave: (value: string | null) => void }) {
  const [value, setValue] = useState(row.slackChannelId ?? "");
  const commit = () => {
    const next = value.trim() || null;
    if (next !== (row.slackChannelId ?? null)) onSave(next);
  };
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onClick={(e) => e.stopPropagation()}
      placeholder="未設定"
      className="h-8 w-36 font-mono text-xs"
      data-testid={`input-slack-${row.userId}`}
    />
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
  const [historyItem, setHistoryItem] = useState<ProgressDetailItem | null>(null);
  const today = todayJst();

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

  const monitoringMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { learnerStatus?: LearnerStatus; slackChannelId?: string | null } }) =>
      updateLearnerMonitoring(userId, data),
    onSuccess: () => {
      toast({ title: "保存しました" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", activeCourseId, "progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stagnation-count"] });
    },
    onError: () => {
      toast({ title: "保存に失敗しました", variant: "destructive" });
    },
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
                  <TableHead>現在のレッスン期限</TableHead>
                  <TableHead>最終活動</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>SlackチャンネルID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.map((row) => {
                  const isExpanded = expandedUserId === row.userId;
                  const pct = row.total ? Math.round((row.passedCount / row.total) * 100) : 0;
                  return (
                    <Fragment key={row.userId}>
                      <TableRow
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
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.complete || row.learnerStatus === "pend" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            renderDue(row.currentDueDate, today, true)
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {row.lastActivityDate ? formatShortDate(row.lastActivityDate) : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {/* The badge itself is the dropdown: it shows the derived
                              status (進行中/停滞/修了) or pend, and switching to
                              Active hands it back to the automatic judgement. */}
                          <Select
                            value={row.learnerStatus}
                            onValueChange={(v) =>
                              monitoringMutation.mutate({ userId: row.userId, data: { learnerStatus: v as LearnerStatus } })
                            }
                          >
                            <SelectTrigger
                              className="h-8 w-auto gap-1 border-transparent bg-transparent px-1 shadow-none hover:bg-muted"
                              title="状態を変更"
                              data-testid={`select-status-${row.userId}`}
                            >
                              {renderLearnerStatus(row)}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active（自動判定）</SelectItem>
                              <SelectItem value="pend">pend（監視対象外）</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <SlackChannelInput
                            key={`${row.userId}:${row.slackChannelId ?? ""}`}
                            row={row}
                            onSave={(value) =>
                              monitoringMutation.mutate({ userId: row.userId, data: { slackChannelId: value } })
                            }
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={6} className="p-0">
                            <div className="py-2 pr-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>問題</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>期限</TableHead>
                                    <TableHead>クリア日</TableHead>
                                    <TableHead>達成</TableHead>
                                    <TableHead>挑戦回数</TableHead>
                                    <TableHead>AI質問回数</TableHead>
                                    <TableHead>直近のAI判定</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detail.map((item) => {
                                    const latest = item.submissions[item.submissions.length - 1];
                                    return (
                                      <TableRow key={item.problemId}>
                                        <TableCell>{item.problemTitle}</TableCell>
                                        <TableCell>{renderProgressStatus(item)}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                          {renderDue(item.dueDate, today, item.status === "current")}
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                          {item.completedDate ? formatShortDate(item.completedDate) : "—"}
                                        </TableCell>
                                        <TableCell>{renderAchievement(item)}</TableCell>
                                        <TableCell>{item.attempts}回</TableCell>
                                        <TableCell>{item.aiQuestionCount}回</TableCell>
                                        <TableCell className="max-w-xs text-xs text-muted-foreground">
                                          {latest ? (
                                            <button
                                              type="button"
                                              className="text-left w-full hover:text-foreground"
                                              onClick={() => setHistoryItem(item)}
                                              title="クリックで詳細を表示"
                                              data-testid={`button-ai-detail-${item.problemId}`}
                                            >
                                              <span className="line-clamp-2">{latest.aiSummary || "（総評なし）"}</span>
                                              <span className="text-[#4A90E2] underline">詳細を見る</span>
                                            </button>
                                          ) : (
                                            "—"
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyItem} onOpenChange={(open) => !open && setHistoryItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{historyItem?.problemTitle} — AI判定の履歴</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[...(historyItem?.submissions ?? [])].reverse().map((sub) => (
              <div key={sub.id} className="border rounded-md p-3" data-testid={`submission-${sub.id}`}>
                <div className="flex items-center gap-2 mb-2 text-sm">
                  <span className="font-bold">{sub.attemptNumber}回目</span>
                  {sub.verdict === "pass" ? (
                    <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">合格</Badge>
                  ) : (
                    <Badge className="bg-[#FDECEC] text-[#E03131] border-transparent">不合格</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(sub.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </span>
                </div>
                <FeedbackSection title="総評" text={sub.aiSummary} />
                <FeedbackSection title="良かった点" text={sub.aiGood} />
                <FeedbackSection title="改善点" text={sub.aiImprove} />
                <FeedbackSection title="修正が必要な点" text={sub.aiMustFix} />
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">提出内容を表示</summary>
                  <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">{sub.code}</pre>
                </details>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
