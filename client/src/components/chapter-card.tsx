import { Trash2, Pencil } from "lucide-react";
import { Link } from "wouter";
import type { ChapterWithCount } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ChapterCardProps {
  chapter: ChapterWithCount;
  editMode: boolean;
  onDelete: (id: string) => void;
  onEdit: (chapter: ChapterWithCount) => void;
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

export function ChapterCard({ chapter, editMode, onDelete, onEdit, colorIndex }: ChapterCardProps) {
  const safeColorIndex = typeof colorIndex === 'number' ? colorIndex : 0;
  const gradient = gradients[safeColorIndex % gradients.length];

  return (
    <div className="relative group">
      <Link href={`/chapter/${chapter.id}`} data-testid={`card-chapter-${chapter.id}`}>
        <div
          className={`bg-gradient-to-br ${gradient} rounded-md overflow-hidden flex flex-col justify-end text-white shadow-md hover-elevate cursor-pointer aspect-[4/3] relative`}
          style={chapter.icon ? {
            backgroundImage: `url(${chapter.icon})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          } : undefined}
          data-testid={chapter.icon ? `img-chapter-icon-${chapter.id}` : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="relative p-3">
            <h3 className="text-base font-semibold mb-1 truncate drop-shadow-md" data-testid={`text-chapter-title-${chapter.id}`}>
              {chapter.title}
            </h3>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {chapter.genre && (
                <p className="text-xs opacity-90 truncate drop-shadow-sm" data-testid={`text-chapter-genre-${chapter.id}`}>
                  {chapter.genre}
                </p>
              )}
              <p className="text-xs opacity-90 whitespace-nowrap drop-shadow-sm" data-testid={`text-problem-count-${chapter.id}`}>
                {chapter.problemCount} 問題
              </p>
            </div>
          </div>
        </div>
      </Link>
      {editMode && (
        <div className="absolute -top-2 -right-2 flex gap-1 z-10">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(chapter);
            }}
            data-testid={`button-edit-chapter-${chapter.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(chapter.id);
            }}
            data-testid={`button-delete-chapter-${chapter.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
