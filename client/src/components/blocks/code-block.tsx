import { useState, useEffect } from "react";
import { Trash2, Copy, Check, GripVertical } from "lucide-react";
import type { Block, CodeBlockContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const LANGUAGES = [
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
];

interface CodeBlockProps {
  block: Block;
  editMode: boolean;
  onUpdate: (content: CodeBlockContent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function CodeBlock({
  block,
  editMode,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: CodeBlockProps) {
  const content = block.content as CodeBlockContent;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content.code || "");
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const lines = (content.code || "").split("\n");
  const languageLabel = LANGUAGES.find((l) => l.value === content.language)?.label || content.language;

  if (!editMode) {
    return (
      <Card className="bg-[#1E1E1E] text-gray-100 border-gray-700 overflow-hidden">
        <CardHeader className="py-2 px-4 bg-[#2D2D2D] flex flex-row items-center justify-between gap-2">
          <span className="text-xs text-gray-400 font-mono">{languageLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 text-gray-400 hover:text-white"
            data-testid={`button-copy-code-${block.id}`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <pre className="p-4 font-mono text-sm">
            <code className="flex flex-col">
              {lines.map((line, idx) => (
                <span key={idx} className="flex">
                  <span className="w-10 text-right pr-4 text-gray-500 select-none flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1">{line || " "}</span>
                </span>
              ))}
            </code>
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1E1E1E] text-gray-100 border-gray-700">
      <CardHeader className="py-2 px-4 bg-[#2D2D2D]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
            <span className="text-sm font-medium text-blue-400">コードブロック</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={isFirst}
              className="h-8 w-8 text-gray-400"
              data-testid={`button-block-up-${block.id}`}
            >
              <span className="text-xs">↑</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={isLast}
              className="h-8 w-8 text-gray-400"
              data-testid={`button-block-down-${block.id}`}
            >
              <span className="text-xs">↓</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-red-400"
              data-testid={`button-delete-block-${block.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-300">プログラミング言語</Label>
          <Select
            value={content.language || "javascript"}
            onValueChange={(lang) => onUpdate({ ...content, language: lang })}
          >
            <SelectTrigger
              className="w-48 bg-[#2D2D2D] border-gray-600 text-gray-100"
              data-testid={`select-language-${block.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-300">コード</Label>
          <Textarea
            value={content.code || ""}
            onChange={(e) => onUpdate({ ...content, code: e.target.value })}
            placeholder="コードを入力してください..."
            className="min-h-[200px] font-mono text-sm bg-[#2D2D2D] border-gray-600 text-gray-100 resize-y"
            data-testid={`textarea-code-${block.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
