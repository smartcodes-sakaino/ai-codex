import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, LayoutDashboard, BookOpen, GraduationCap, Users, BarChart3, Sparkles, Award, LogOut, PlayCircle, Eye, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import mascotGraduate from "@assets/mascot-graduate.png";

const NAV_ITEMS = [
  { href: "/admin", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/", label: "カリキュラム管理", icon: BookOpen },
  { href: "/admin/courses", label: "コース管理", icon: GraduationCap },
  { href: "/admin/members", label: "メンバー管理", icon: Users },
  { href: "/admin/progress", label: "進捗確認", icon: BarChart3 },
  { href: "/settings", label: "AIプロンプト設定", icon: Sparkles },
  { href: "/admin/settings", label: "修了証設定", icon: Award },
  { href: "/admin/view", label: "管理者ビュー(講師目線)", icon: Eye },
  { href: "/learn", label: "受講者ビューを見る", icon: PlayCircle },
];

/** Hamburger-triggered navigation drawer shared by every admin-facing page. */
export function AdminNavMenu() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-open-admin-nav">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 bg-gradient-to-b from-[#FFF6D9] to-[#FFE79E] dark:from-[#3D3111] dark:to-[#2A2308] border-r-[#F0C63A]"
      >
        <SheetHeader className="p-5 pb-3 text-left">
          <div className="flex items-center gap-2">
            <img src={mascotGraduate} alt="Codey mascot" className="h-10 w-10 object-contain" />
            <SheetTitle className="text-lg font-bold bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent">
              AI Codex
            </SheetTitle>
          </div>
        </SheetHeader>
        <nav className="px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/70 text-[#8A4B00] dark:bg-black/30 dark:text-[#FFD98A]"
                    : "text-[#5B4200] hover:bg-white/40 dark:text-[#E8D9A6] dark:hover:bg-black/20"
                )}
                data-testid={`link-admin-nav-${item.href.replace(/\W+/g, "-")}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto absolute bottom-0 left-0 right-0 p-3 border-t border-[#F0C63A]/50">
          <div className="px-2 pb-2 text-xs text-[#5B4200] dark:text-[#E8D9A6] truncate">{user?.name}</div>
          <Link href="/change-password" onClick={() => setOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-[#5B4200] dark:text-[#E8D9A6] hover:bg-white/40 dark:hover:bg-black/20"
              data-testid="button-change-password"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              パスワード変更
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[#5B4200] dark:text-[#E8D9A6] hover:bg-white/40 dark:hover:bg-black/20"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
