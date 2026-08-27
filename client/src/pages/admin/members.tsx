import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  fetchUsers,
  createUser,
  updateUser,
  setUserActive,
  regenerateUserPassword,
  fetchGroupsLms,
  createGroupLms,
  deleteGroupLms,
  type LmsUser,
} from "@/lib/lmsApi";

type StatusFilter = "all" | "active" | "disabled";

export default function AdminMembersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { data: users = [] } = useQuery({ queryKey: ["/api/admin/users"], queryFn: fetchUsers });
  const { data: groups = [] } = useQuery({ queryKey: ["/api/admin/groups"], queryFn: fetchGroupsLms });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const visibleUsers = users.filter((u) => {
    if (statusFilter === "active") return u.isActive;
    if (statusFilter === "disabled") return !u.isActive;
    return true;
  });

  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  const [editingUser, setEditingUser] = useState<LmsUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<"admin" | "learner">("learner");

  const openEditUser = (u: LmsUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditGroupIds(u.groupIds);
    setEditRole(u.role);
  };

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowAddUser(false);
      setNewName("");
      setNewEmail("");
      setNewUserGroupIds([]);
      toast({ title: "ユーザーを追加しました(初回パスワード発行済み)" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const regenMutation = useMutation({
    mutationFn: regenerateUserPassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "パスワードを再発行しました" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: variables.isActive ? "ユーザーを有効化しました" : "ユーザーを無効化しました" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; groupIds: string[]; role: "admin" | "learner" }) =>
      updateUser(editingUser!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: "ユーザー情報を更新しました" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const createGroupMutation = useMutation({
    mutationFn: createGroupLms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      setShowAddGroup(false);
      setNewGroupName("");
      toast({ title: "グループを追加しました" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteGroupLms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
    },
  });

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;

  return (
    <AdminLayout title="メンバー管理">
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" data-testid="tab-users">
            ユーザー
          </TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">
            グループ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">学習者一覧</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-32" data-testid="select-user-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="active">有効のみ</SelectItem>
                    <SelectItem value="disabled">無効のみ</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => setShowAddUser(true)} data-testid="button-add-user">
                  ＋ ユーザーを追加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>権限</TableHead>
                    <TableHead>所属グループ</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>初回パスワード</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`} className={!u.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "outline"} data-testid={`badge-role-${u.id}`}>
                          {u.role === "admin" ? "管理者" : "学習者"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1">
                        {u.groupIds.map((gid) => (
                          <Badge key={gid} variant="secondary">
                            {groupName(gid)}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "secondary" : "destructive"} data-testid={`badge-status-${u.id}`}>
                          {u.isActive ? "有効" : "無効"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.tempPassword ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{u.tempPassword}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">変更済み</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditUser(u)}
                          data-testid={`button-edit-user-${u.id}`}
                        >
                          編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => regenMutation.mutate(u.id)}
                          data-testid={`button-regen-password-${u.id}`}
                        >
                          再発行
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                            data-testid={`button-toggle-active-${u.id}`}
                          >
                            {u.isActive ? "無効化" : "有効化"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">グループ一覧</CardTitle>
              <Button size="sm" onClick={() => setShowAddGroup(true)} data-testid="button-add-group">
                ＋ グループを追加
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>グループ名</TableHead>
                    <TableHead>所属人数</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <TableRow key={g.id} data-testid={`row-group-${g.id}`}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{users.filter((u) => u.groupIds.includes(g.id)).length}名</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteGroupMutation.mutate(g.id)}>
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>氏名</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-new-user-name" />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-new-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label>所属グループ</Label>
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={newUserGroupIds.includes(g.id)}
                    onCheckedChange={(checked) =>
                      setNewUserGroupIds((prev) => (checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)))
                    }
                  />
                  <span className="text-sm">{g.name}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() =>
                createUserMutation.mutate({ name: newName, email: newEmail, groupIds: newUserGroupIds })
              }
              disabled={createUserMutation.isPending}
              data-testid="button-confirm-add-user"
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>氏名</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-user-name" />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                data-testid="input-edit-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label>権限</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as "admin" | "learner")}
                disabled={editingUser?.id === currentUser?.id}
              >
                <SelectTrigger data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="learner">学習者</SelectItem>
                </SelectContent>
              </Select>
              {editingUser?.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">自分自身の権限は変更できません</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>所属グループ</Label>
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={editGroupIds.includes(g.id)}
                    onCheckedChange={(checked) =>
                      setEditGroupIds((prev) => (checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)))
                    }
                  />
                  <span className="text-sm">{g.name}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() =>
                updateUserMutation.mutate({ name: editName, email: editEmail, groupIds: editGroupIds, role: editRole })
              }
              disabled={updateUserMutation.isPending}
              data-testid="button-confirm-edit-user"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>グループを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>グループ名</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="例: 2026年度新卒"
              data-testid="input-new-group-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroup(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => createGroupMutation.mutate(newGroupName)}
              disabled={createGroupMutation.isPending}
              data-testid="button-confirm-add-group"
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
