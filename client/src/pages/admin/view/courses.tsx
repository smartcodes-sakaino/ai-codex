import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LearnerLayout } from "@/components/learner-layout";
import { Card } from "@/components/ui/card";
import { fetchAdminCourses } from "@/lib/lmsApi";

// The instructor-facing counterpart to /learn: every course in the system,
// not just ones assigned to the current admin, since this exists purely so
// a teacher can preview content — not to track their own progress.
export default function AdminViewCoursesPage() {
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["/api/admin/courses"], queryFn: fetchAdminCourses });

  return (
    <LearnerLayout title="管理者ビュー">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          すべてのコースを、割り当てやロックに関係なく確認できます。講師目線での授業準備にご利用ください。
        </p>
      </div>
      {isLoading ? null : courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだコースがありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} href={`/admin/view/courses/${c.id}`}>
              <Card className="p-5 hover-elevate cursor-pointer" data-testid={`card-admin-view-course-${c.id}`}>
                <h3 className="font-bold mb-1">{c.title}</h3>
                <p className="text-xs text-muted-foreground">{c.chapterIds.length}チャプター</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </LearnerLayout>
  );
}
