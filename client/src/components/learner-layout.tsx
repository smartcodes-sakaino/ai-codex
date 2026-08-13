import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import mascotGraduate from "@assets/mascot-graduate.png";

export function LearnerLayout({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={mascotGraduate}
            alt="Codey mascot"
            className="h-8 w-8 object-contain shrink-0"
            data-testid="img-mascot"
          />
          <span className="text-base font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent whitespace-nowrap">
            AI Codex
          </span>
          <span className="text-muted-foreground text-sm truncate hidden sm:inline">/ {title}</span>
          <h1 className="text-base font-bold sm:hidden truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        {backHref && (
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground inline-block mb-4">
            ← {backLabel || "戻る"}
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
