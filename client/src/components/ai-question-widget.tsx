import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircleQuestion, Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { askAiQuestion } from "@/lib/lmsApi";

interface QaExchange {
  id: string;
  question: string;
  answer?: string;
  isLoading: boolean;
  isError: boolean;
}

// A persistent "ask about this problem" entry point, available on every
// problem page (video or text-based alike) — a floating button fixed to the
// screen that opens a slide-over panel, rather than a permanently docked
// sidebar competing with the page's own content for width.
export function AiQuestionWidget({ problemId }: { problemId: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [exchanges, setExchanges] = useState<QaExchange[]>([]);

  const mutation = useMutation({
    mutationFn: (question: string) => askAiQuestion(problemId, question),
  });

  const handleAsk = () => {
    const question = input.trim();
    if (!question || mutation.isPending) return;
    const id = crypto.randomUUID();
    setExchanges((prev) => [...prev, { id, question, isLoading: true, isError: false }]);
    setInput("");
    mutation.mutate(question, {
      onSuccess: (result) => {
        setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, answer: result.answer, isLoading: false } : e)));
      },
      onError: () => {
        setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, isError: true, isLoading: false } : e)));
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Positioning lives on this wrapper, not the Button itself: Button's
          built-in hover-elevate/active-elevate-2 classes set position:relative
          in index.css, which wins the cascade over a `fixed` class placed
          directly on the Button and silently breaks the pinned placement. */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-[#4A90E2] to-[#7CB9E8] text-white p-0"
          aria-label="AIに質問する"
          data-testid="button-open-ai-question"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </Button>
      </div>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="p-4 border-b text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircleQuestion className="h-5 w-5" />
            この問題について質問する
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            答えそのものは教えられませんが、ヒントを出します。この問題に関する質問をどうぞ。
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {exchanges.length === 0 && (
            <p className="text-sm text-muted-foreground">わからないことがあれば、下の欄から質問してみましょう。</p>
          )}
          {exchanges.map((ex) => (
            <div key={ex.id} className="space-y-1.5">
              <p className="text-sm font-medium" data-testid={`text-ai-question-${ex.id}`}>
                Q. {ex.question}
              </p>
              {ex.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  考えています...
                </div>
              ) : ex.isError ? (
                <p className="text-sm text-destructive">回答の取得に失敗しました。もう一度お試しください。</p>
              ) : (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-md bg-muted/50 p-3"
                  data-testid={`text-ai-answer-${ex.id}`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{ex.answer || ""}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t p-4 space-y-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="この問題についてわからないことを聞いてみましょう..."
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAsk();
              }
            }}
            data-testid="textarea-ai-question"
          />
          <Button
            onClick={handleAsk}
            disabled={!input.trim() || mutation.isPending}
            className="w-full gap-2 bg-gradient-to-r from-[#4A90E2] to-[#7CB9E8] text-white"
            data-testid="button-send-ai-question"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            質問する
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
