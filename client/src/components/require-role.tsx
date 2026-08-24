import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface RequireRoleProps {
  role: "admin" | "learner" | Array<"admin" | "learner">;
  children: React.ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const allowed = Array.isArray(role) ? role : [role];
  const isAllowed = !!user && allowed.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login");
    } else if (user.mustChangePassword) {
      navigate("/change-password");
    } else if (!isAllowed) {
      navigate(user.role === "admin" ? "/admin" : "/learn");
    }
  }, [isLoading, user, isAllowed, navigate]);

  if (isLoading || !user || user.mustChangePassword || !isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
