import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import Dashboard from "@/pages/dashboard";
import ChapterPage from "@/pages/chapter";
import ProblemPage from "@/pages/problem";
import SettingsPage from "@/pages/settings";
import SelfReviewPage from "@/pages/self-review";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/chapter/:id" component={ChapterPage} />
      <Route path="/problem/:id" component={ProblemPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/self-review/:token" component={SelfReviewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
