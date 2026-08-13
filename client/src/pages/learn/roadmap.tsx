import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { LearnerLayout } from "@/components/learner-layout";
import { Button } from "@/components/ui/button";
import { fetchMyCourses, fetchMyRoadmap, type RoadmapItem } from "@/lib/lmsApi";

export default function LearnerRoadmapPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: courses = [] } = useQuery({ queryKey: ["/api/my/courses"], queryFn: fetchMyCourses });
  const { data: roadmap = [] } = useQuery({
    queryKey: ["/api/my/courses", courseId, "roadmap"],
    queryFn: () => fetchMyRoadmap(courseId),
    enabled: !!courseId,
  });

  const course = courses.find((c) => c.id === courseId);

  const chapters: { chapterId: string; chapterTitle: string; items: RoadmapItem[] }[] = [];
  for (const item of roadmap) {
    let group = chapters.find((g) => g.chapterId === item.chapterId);
    if (!group) {
      group = { chapterId: item.chapterId, chapterTitle: item.chapterTitle, items: [] };
      chapters.push(group);
    }
    group.items.push(item);
  }

  const complete = course?.progress.complete;

  return (
    <LearnerLayout title={course?.title || "コース"} backHref="/learn" backLabel="マイコース一覧へ">
      <p className="text-sm text-muted-foreground mb-4">
        問題は上から順に進みます。合格すると次の問題が解放されます。
      </p>

      {complete && (
        <div className="border rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-3 bg-[#E3F5E6]/40">
          <div>
            <p className="font-bold text-[#2F9E44]">🎉 全問合格しました！</p>
            <p className="text-xs text-muted-foreground">修了証を発行できます。</p>
          </div>
          <Link href={`/learn/courses/${courseId}/certificate`}>
            <Button className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white" data-testid="button-view-certificate">
              修了証を見る
            </Button>
          </Link>
        </div>
      )}

      {chapters.map((group) => (
        <div key={group.chapterId} className="mb-5">
          <h3 className="text-sm font-bold mb-2">{group.chapterTitle}</h3>
          <div className="border rounded-lg overflow-hidden">
            {group.items.map((item, idx) => {
              const clickable = item.status !== "locked";
              const content = (
                <div
                  className={
                    "flex items-center gap-3 px-4 py-3 border-b last:border-b-0 " +
                    (item.status === "current" ? "bg-[#FDE6D3]/50" : "")
                  }
                  data-testid={`roadmap-item-${item.problemId}`}
                >
                  <div
                    className={
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 " +
                      (item.status === "done"
                        ? "bg-[#2F9E44] text-white"
                        : item.status === "current"
                        ? "bg-[#E8722C] text-white"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {item.status === "done" ? "✓" : item.status === "current" ? idx + 1 : "🔒"}
                  </div>
                  <span className={"flex-1 font-medium text-sm " + (item.status === "locked" ? "text-muted-foreground" : "")}>
                    {item.problemTitle}
                  </span>
                  {item.attempts > 0 && (
                    <span className="text-xs text-muted-foreground">{item.attempts}回挑戦</span>
                  )}
                </div>
              );
              return clickable ? (
                <Link key={item.problemId} href={`/learn/courses/${courseId}/problems/${item.problemId}`}>
                  {content}
                </Link>
              ) : (
                <div key={item.problemId}>{content}</div>
              );
            })}
          </div>
        </div>
      ))}
    </LearnerLayout>
  );
}
