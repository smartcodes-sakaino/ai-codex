import { AdminNavMenu } from "@/components/admin-nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import mascotGraduate from "@assets/mascot-graduate.png";

export function AdminLayout({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AdminNavMenu />
            <img
              src={mascotGraduate}
              alt="Codey mascot"
              className="h-10 w-10 object-contain shrink-0"
              data-testid="img-mascot"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent whitespace-nowrap">
              AI Codex
            </h1>
            <span className="text-muted-foreground text-sm ml-1 truncate hidden sm:inline">/ {title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerRight}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
