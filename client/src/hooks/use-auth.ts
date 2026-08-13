import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, login as apiLogin, logout as apiLogout, type AuthUser } from "@/lib/lmsApi";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    retry: false,
  });

  const login = async (email: string, password: string) => {
    const loggedInUser = await apiLogin(email, password);
    queryClient.setQueryData(["/api/auth/me"], loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    await apiLogout();
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
  };

  return { user: user ?? null, isLoading, login, logout };
}

export type { AuthUser };
