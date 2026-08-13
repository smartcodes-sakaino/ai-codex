import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FFA566] flex items-center justify-center text-white font-bold text-sm">
            AC
          </div>
          <h1 className="text-base font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
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
