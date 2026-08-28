import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { RequireRole } from "@/components/require-role";
import Dashboard from "@/pages/dashboard";
import ChapterPage from "@/pages/chapter";
import ProblemPage from "@/pages/problem";
import SettingsPage from "@/pages/settings";
import SelfReviewPage from "@/pages/self-review";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ChangePasswordPage from "@/pages/change-password";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminCoursesPage from "@/pages/admin/courses";
import AdminMembersPage from "@/pages/admin/members";
import AdminProgressPage from "@/pages/admin/progress";
import AdminLmsSettingsPage from "@/pages/admin/lms-settings";
import LearnerMyCoursesPage from "@/pages/learn/my-courses";
import LearnerRoadmapPage from "@/pages/learn/roadmap";
import LearnerProblemPage from "@/pages/learn/problem";
import LearnerCertificatePage from "@/pages/learn/certificate";
import AdminViewCoursesPage from "@/pages/admin/view/courses";
import AdminViewRoadmapPage from "@/pages/admin/view/roadmap";
import AdminViewProblemPage from "@/pages/admin/view/problem";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/self-review/:token" component={SelfReviewPage} />

      <Route path="/" component={() => <RequireRole role="admin"><Dashboard /></RequireRole>} />
      <Route path="/chapter/:id" component={() => <RequireRole role="admin"><ChapterPage /></RequireRole>} />
      <Route path="/problem/:id" component={() => <RequireRole role="admin"><ProblemPage /></RequireRole>} />
      <Route path="/settings" component={() => <RequireRole role="admin"><SettingsPage /></RequireRole>} />

      <Route path="/admin" component={() => <RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
      <Route path="/admin/courses" component={() => <RequireRole role="admin"><AdminCoursesPage /></RequireRole>} />
      <Route path="/admin/members" component={() => <RequireRole role="admin"><AdminMembersPage /></RequireRole>} />
      <Route path="/admin/progress" component={() => <RequireRole role="admin"><AdminProgressPage /></RequireRole>} />
      <Route path="/admin/settings" component={() => <RequireRole role="admin"><AdminLmsSettingsPage /></RequireRole>} />

      <Route path="/admin/view" component={() => <RequireRole role="admin"><AdminViewCoursesPage /></RequireRole>} />
      <Route path="/admin/view/courses/:id" component={() => <RequireRole role="admin"><AdminViewRoadmapPage /></RequireRole>} />
      <Route
        path="/admin/view/courses/:id/problems/:problemId"
        component={() => <RequireRole role="admin"><AdminViewProblemPage /></RequireRole>}
      />

      <Route path="/learn" component={() => <RequireRole role={["learner", "admin"]}><LearnerMyCoursesPage /></RequireRole>} />
      <Route path="/learn/courses/:id" component={() => <RequireRole role={["learner", "admin"]}><LearnerRoadmapPage /></RequireRole>} />
      <Route
        path="/learn/courses/:id/problems/:problemId"
        component={() => <RequireRole role={["learner", "admin"]}><LearnerProblemPage /></RequireRole>}
      />
      <Route
        path="/learn/courses/:id/certificate"
        component={() => <RequireRole role={["learner", "admin"]}><LearnerCertificatePage /></RequireRole>}
      />

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
