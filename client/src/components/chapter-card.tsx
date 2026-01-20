import { Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { ChapterWithCount } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ChapterCardProps {
  chapter: ChapterWithCount;
  editMode: boolean;
  onDelete: (id: string) => void;
  colorIndex: number;
}

const gradients = [
  "from-[#FF8C42] to-[#FFA566]",
  "from-[#FF6B9D] to-[#FFB3C6]",
  "from-[#4A90E2] to-[#7CB9E8]",
  "from-[#9B59B6] to-[#D4A5D9]",
  "from-[#27AE60] to-[#58D68D]",
  "from-[#E74C3C] to-[#F1948A]",
];

const icons: Record<string, string> = {
  HTML: "code",
  CSS: "palette",
  JavaScript: "braces",
  Python: "terminal",
  Java: "coffee",
  "C++": "cpu",
  React: "atom",
  TypeScript: "file-type",
  SQL: "database",
  Git: "git-branch",
};

function getIcon(title: string): string {
  return icons[title] || "book-open";
}

export function ChapterCard({ chapter, editMode, onDelete, colorIndex }: ChapterCardProps) {
  const gradient = gradients[colorIndex % gradients.length];

  return (
    <div className="relative group">
      <Link href={`/chapter/${chapter.id}`} data-testid={`card-chapter-${chapter.id}`}>
        <div
          className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 aspect-[4/3] flex flex-col justify-between text-white shadow-md hover:shadow-lg transition-all duration-150 hover:-translate-y-1 cursor-pointer overflow-visible`}
        >
          <div className="flex items-start justify-between">
            <div className="text-4xl opacity-90">
              {chapter.icon || getIcon(chapter.title)}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-1 truncate" data-testid={`text-chapter-title-${chapter.id}`}>
              {chapter.title}
            </h3>
            <p className="text-sm opacity-90" data-testid={`text-problem-count-${chapter.id}`}>
              {chapter.problemCount} 問題
            </p>
          </div>
        </div>
      </Link>
      {editMode && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(chapter.id);
          }}
          data-testid={`button-delete-chapter-${chapter.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
