import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Where the leading home link points — the curriculum dashboard unless a section (e.g. 記事管理) has its own top page. */
  home?: { href: string; label: string };
}

export function Breadcrumb({ items, home = { href: "/", label: "ダッシュボード" } }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
      <Link href={home.href} className="flex items-center gap-1 hover-elevate rounded px-1.5 py-0.5">
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">{home.label}</span>
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover-elevate rounded px-1.5 py-0.5 max-w-[120px] sm:max-w-[200px] truncate"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium max-w-[120px] sm:max-w-[200px] truncate">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
