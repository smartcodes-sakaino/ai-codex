import { useState } from "react";
import { Trash2, Sparkles, Loader2, GripVertical } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Block, TextBlockContent, ProblemBlockContent, CodeBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TextBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: TextBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  problemBlocks: Block[];
  codeBlocks: Block[];
}

export function TextBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  problemBlocks,
  codeBlocks,
}: TextBlockProps) {
  const content = block.content as TextBlockContent;
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const hasProblemBlock = problemBlocks.length > 0;

  const handleAIExplain = async () => {
    if (!hasProblemBlock) {
      toast({
        title: "エラー",
        description: "AI解説を生成するには問題ブロックが必要です。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const problemText = problemBlocks
        .map((b) => (b.content as ProblemBlockContent).text)
        .filter(Boolean)
        .join("\n\n");
      
      const codeText = codeBlocks
        .map((b) => {
          const c = b.content as CodeBlockContent;
          return c.code ? `\`\`\`${c.language}\n${c.code}\n\`\`\`` : "";
        })
        .filter(Boolean)
        .join("\n\n");

      const response = await apiRequest("POST", "/api/ai/explain", {
        problem: problemText,
        code: codeText,
      });

      const data = await response.json();
      onUpdate({ text: data.explanation });

      toast({
        title: "成功",
        description: "AI解説が生成されました。",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "AI解説の生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!editMode) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <span className="text-sm font-medium">解説</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none prose-headings:text-[#4A90E2] dark:prose-headings:text-[#7CB9E8] prose-strong:text-[#4A90E2] dark:prose-strong:text-[#7CB9E8] prose-code:bg-[#4A90E2]/10 dark:prose-code:bg-[#7CB9E8]/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[#4A90E2] dark:prose-code:text-[#7CB9E8] prose-pre:bg-[#1E1E1E] prose-pre:text-gray-100 prose-a:text-[#FF6B9D] dark:prose-a:text-[#FFB3C6] prose-li:marker:text-[#4A90E2]">
            {content.text ? (
              <ReactMarkdown>{content.text}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">解説がありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <GripVertical className="h-4 w-4 cursor-grab" />
            <span className="text-sm font-medium">テキストブロック</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={isFirst}
              className="h-8 w-8"
              data-testid={`button-block-up-${block.id}`}
            >
              <span className="text-xs">↑</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={isLast}
              className="h-8 w-8"
              data-testid={`button-block-down-${block.id}`}
            >
              <span className="text-xs">↓</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-destructive"
              data-testid={`button-delete-block-${block.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>解説テキスト</Label>
          <Textarea
            value={content.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="解説を入力してください..."
            className="min-h-[150px] resize-y"
            data-testid={`textarea-text-${block.id}`}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleAIExplain}
            disabled={!hasProblemBlock || isGenerating}
            className="bg-gradient-to-r from-[#4A90E2] to-[#7CB9E8] text-white"
            data-testid={`button-ai-explain-${block.id}`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI解説
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
