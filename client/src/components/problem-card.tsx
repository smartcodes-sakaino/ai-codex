import { useRef, useState } from "react";
import { Trash2, Edit2, ChevronUp, ChevronDown, CheckCircle, Circle, AlertTriangle, GripVertical } from "lucide-react";
import { Link } from "wouter";
import type { Problem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProblemCardProps {
  problem: Problem;
  hasExplanation: boolean;
  hasLecture: boolean;
  editMode: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  colorIndex: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

const borderColors = [
  "border-l-[#FF8C42]",
  "border-l-[#FF6B9D]",
  "border-l-[#4A90E2]",
  "border-l-[#9B59B6]",
  "border-l-[#27AE60]",
];

export function ProblemCard({
  problem,
  hasExplanation,
  hasLecture,
  editMode,
  onDelete,
  onRename,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  colorIndex,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}: ProblemCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(problem.title);
  // Native HTML5 drag-and-drop has no "drag by this handle only" primitive —
  // draggable has to live on the whole card, so this ref tracks whether the
  // mousedown that preceded dragstart actually landed on the grip icon, and
  // dragstart is cancelled otherwise (e.g. a normal click on the title link).
  const dragArmedRef = useRef(false);

  const borderColor = borderColors[colorIndex % borderColors.length];
  const formattedDate = new Date(problem.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== problem.title) {
      onRename(problem.id, newTitle.trim());
    }
    setIsRenaming(false);
  };

  return (
    <Card
      draggable={editMode}
      onDragStart={(e) => {
        if (!dragArmedRef.current) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e);
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={(e) => {
        dragArmedRef.current = false;
        onDragEnd?.(e);
      }}
      className={cn(
        `border-l-4 ${borderColor} overflow-visible hover-elevate`,
        isDragging && "opacity-40",
        isDragOver && "border-t-4 border-t-primary"
      )}
      data-testid={`card-problem-${problem.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {editMode && (
              <GripVertical
                className="h-5 w-5 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
                onMouseDown={() => {
                  dragArmedRef.current = true;
                }}
                data-testid={`handle-drag-problem-${problem.id}`}
              />
            )}
            {isRenaming ? (
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setNewTitle(problem.title);
                    setIsRenaming(false);
                  }
                }}
                className="h-8"
                autoFocus
                data-testid={`input-rename-problem-${problem.id}`}
              />
            ) : (
              <Link
                href={`/problem/${problem.id}`}
                className="flex-1 min-w-0"
              >
                <h3 className="font-medium truncate" data-testid={`text-problem-title-${problem.id}`}>
                  {problem.title}
                </h3>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              {hasExplanation ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {hasExplanation ? "解説あり" : "解説なし"}
              </span>
            </span>
            {!hasLecture && (
              <span
                className="flex items-center gap-1 text-amber-600 dark:text-amber-500"
                data-testid={`badge-no-lecture-${problem.id}`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">講義コンテンツがありません</span>
              </span>
            )}
            {editMode && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveUp()}
                  disabled={isFirst}
                  className="h-8 w-8"
                  data-testid={`button-move-up-${problem.id}`}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveDown()}
                  disabled={isLast}
                  className="h-8 w-8"
                  data-testid={`button-move-down-${problem.id}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsRenaming(true)}
                  className="h-8 w-8 text-blue-500"
                  data-testid={`button-rename-${problem.id}`}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(problem.id)}
                  className="h-8 w-8 text-destructive"
                  data-testid={`button-delete-problem-${problem.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
