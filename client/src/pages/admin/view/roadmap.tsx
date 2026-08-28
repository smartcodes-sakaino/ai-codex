import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { BookOpen } from "lucide-react";
import { LearnerLayout } from "@/components/learner-layout";
import { fetchAdminCourses, fetchAdminViewRoadmap, type AdminViewRoadmapItem } from "@/lib/lmsApi";

export default function AdminViewRoadmapPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: courses = [] } = useQuery({ queryKey: ["/api/admin/courses"], queryFn: fetchAdminCourses });
  const { data: roadmap = [] } = useQuery({
    queryKey: ["/api/admin/view/courses", courseId, "roadmap"],
    queryFn: () => fetchAdminViewRoadmap(courseId!),
    enabled: !!courseId,
  });

  const course = courses.find((c) => c.id === courseId);

  const chapters: { chapterId: string; chapterTitle: string; items: AdminViewRoadmapItem[] }[] = [];
  for (const item of roadmap) {
    let group = chapters.find((g) => g.chapterId === item.chapterId);
    if (!group) {
      group = { chapterId: item.chapterId, chapterTitle: item.chapterTitle, items: [] };
      chapters.push(group);
    }
    group.items.push(item);
  }

  return (
    <LearnerLayout title={course?.title || "コース"} backHref="/admin/view" backLabel="コース一覧へ">
      <p className="text-sm text-muted-foreground mb-4">
        すべての問題がロックなしで確認できます。
      </p>

      {chapters.map((group) => (
        <div key={group.chapterId} className="mb-5">
          <h3 className="text-sm font-bold mb-2">{group.chapterTitle}</h3>
          <div className="border rounded-lg overflow-hidden">
            {group.items.map((item, idx) => (
              <Link key={item.problemId} href={`/admin/view/courses/${courseId}/problems/${item.problemId}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                  data-testid={`admin-view-roadmap-item-${item.problemId}`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-muted text-muted-foreground">
                    {idx + 1}
                  </div>
                  <span className="flex-1 font-medium text-sm flex items-center gap-1.5">
                    {item.hasLecture && (
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-label="講義あり" />
                    )}
                    {item.problemTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.gate === "self_review" ? "セルフレビュー制" : item.gate === "video" ? "動画視聴制" : "提出制"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </LearnerLayout>
  );
}
