import { Trash2, Pencil } from "lucide-react";
import { Link } from "wouter";
import type { ArticleCategoryWithCount } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ArticleCategoryCardProps {
  category: ArticleCategoryWithCount;
  editMode: boolean;
  onDelete: (id: string) => void;
  onEdit: (category: ArticleCategoryWithCount) => void;
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

export function ArticleCategoryCard({ category, editMode, onDelete, onEdit, colorIndex }: ArticleCategoryCardProps) {
  const safeColorIndex = typeof colorIndex === 'number' ? colorIndex : 0;
  const gradient = gradients[safeColorIndex % gradients.length];

  return (
    <div className="relative group">
      <Link href={`/admin/articles/categories/${category.id}`} data-testid={`card-article-category-${category.id}`}>
        <div
          className={`bg-gradient-to-br ${gradient} rounded-md overflow-hidden flex flex-col justify-end text-white shadow-md hover-elevate cursor-pointer aspect-[4/3] relative`}
          style={category.icon ? {
            backgroundImage: `url(${category.icon})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
          } : undefined}
          data-testid={category.icon ? `img-article-category-icon-${category.id}` : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="relative p-3">
            <h3 className="text-base font-semibold mb-1 truncate drop-shadow-md" data-testid={`text-article-category-title-${category.id}`}>
              {category.title}
            </h3>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {category.genre && (
                <p className="text-xs opacity-90 truncate drop-shadow-sm" data-testid={`text-article-category-genre-${category.id}`}>
                  {category.genre}
                </p>
              )}
              <p className="text-xs opacity-90 whitespace-nowrap drop-shadow-sm" data-testid={`text-article-count-${category.id}`}>
                {category.articleCount} 記事
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
              onEdit(category);
            }}
            data-testid={`button-edit-article-category-${category.id}`}
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
              onDelete(category.id);
            }}
            data-testid={`button-delete-article-category-${category.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
