import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { MobileLandingPage } from "./pages/MobileLandingPage.tsx";
import { useIsMobile } from "./hooks/useIsMobile.ts";
import { IS_SERVER_MODE } from "@/config/runtime";

// Code-split each route so the marketing landing page never pulls in the React
// Flow editor bundle (and vice-versa).
const App = lazy(() => import("./App.tsx"));
const LandingPage = lazy(() =>
  import("./pages/LandingPage.tsx").then((m) => ({ default: m.LandingPage })),
);
const ProjectsPage = lazy(() =>
  import("./pages/ProjectsPage.tsx").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectPage = lazy(() =>
  import("./pages/ProjectPage.tsx").then((m) => ({ default: m.ProjectPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
    </div>
  );
}

function AppRouter() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLandingPage />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {IS_SERVER_MODE ? (
          <>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/projects/:projectId/diagrams/:diagramId" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            {/* Local mode: marketing landing at `/`, editor at `/app`. */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
