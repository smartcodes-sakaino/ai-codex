import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUsers, fetchAdminCourses } from "@/lib/lmsApi";

export default function AdminDashboardPage() {
  const { data: users = [] } = useQuery({ queryKey: ["/api/admin/users"], queryFn: fetchUsers });
  const { data: courses = [] } = useQuery({ queryKey: ["/api/admin/courses"], queryFn: fetchAdminCourses });

  return (
    <AdminLayout title="ダッシュボード">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-stat-users">
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl font-bold">{users.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">学習者数</CardContent>
        </Card>
        <Card data-testid="card-stat-courses">
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl font-bold">{courses.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">公開中のコース</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">コース一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだコースがありません。「コース管理」から作成してください。
            </p>
          ) : (
            <div className="divide-y">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/progress?course=${c.id}`}
                  className="flex items-center justify-between py-3 text-sm hover:text-[#C85A1B] transition-colors"
                  data-testid={`link-dashboard-course-${c.id}`}
                >
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted-foreground">{c.chapterIds.length} チャプター</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
