import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LearnerLayout } from "@/components/learner-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fetchMyCourses } from "@/lib/lmsApi";

export default function LearnerMyCoursesPage() {
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["/api/my/courses"], queryFn: fetchMyCourses });

  return (
    <LearnerLayout title="マイコース">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">割り当てられたコースに沿って学習を進めましょう。</p>
      </div>
      {isLoading ? null : courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだコースが割り当てられていません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const pct = c.progress.total ? Math.round((c.progress.passedCount / c.progress.total) * 100) : 0;
            return (
              <Link key={c.id} href={`/learn/courses/${c.id}`}>
                <Card className="p-5 hover-elevate cursor-pointer" data-testid={`card-my-course-${c.id}`}>
                  <h3 className="font-bold mb-1">{c.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{c.chapterIds.length}チャプター・{c.progress.total}問</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Progress value={pct} className="flex-1" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  {c.progress.complete ? (
                    <Badge className="bg-[#E3F5E6] text-[#2F9E44] border-transparent">修了済み</Badge>
                  ) : (
                    <Badge className="bg-[#FBF0DA] text-[#E8A317] border-transparent">進行中</Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </LearnerLayout>
  );
}
