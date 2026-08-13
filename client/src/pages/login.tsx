import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import mascotGraduate from "@assets/mascot-graduate.png";

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      navigate(user.role === "admin" ? "/admin" : "/learn");
    }
  }, [isLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser.role === "admin" ? "/admin" : "/learn");
    } catch (err) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img
            src={mascotGraduate}
            alt="Codey mascot"
            className="h-14 w-14 object-contain mx-auto mb-2"
            data-testid="img-mascot"
          />
          <CardTitle className="bg-gradient-to-r from-[#FF8C42] via-[#FF6B9D] to-[#4A90E2] bg-clip-text text-transparent">
            AI Codex
          </CardTitle>
          <CardDescription>メールアドレスとパスワードでログインしてください</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-login-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
              disabled={isSubmitting}
              data-testid="button-login-submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              ログイン
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
