import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import "./index.css";
import { CloudAuth, RequireAuth } from "@/components/CloudAuth";
import { initializeTheme } from "@/store/themeStore";
import { LoadingState } from "@/components/ui/loading";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { loadEditor } from "@/lib/editorRoute";

const disposeTheme = initializeTheme();
import.meta.hot?.dispose(disposeTheme);

const ProjectPage = lazy(() =>
  import("./pages/ProjectPage.tsx").then((m) => ({ default: m.ProjectPage })),
);
function Shell() {
  return (
    <Suspense fallback={<LoadingState variant="screen" />}>
      <Outlet />
    </Suspense>
  );
}
const router = createBrowserRouter([
  {
    element: <Shell />,
    HydrateFallback: () => <LoadingState variant="screen" />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <ProjectsPage /> },
          { path: "/sign-up", element: <Navigate to="/" replace /> },
          { path: "/projects/:projectId", element: <ProjectPage /> },
          {
            path: "/projects/:projectId/diagrams/:diagramId",
            lazy: async () => ({ Component: (await loadEditor()).default }),
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CloudAuth>
      <RouterProvider router={router} />
    </CloudAuth>
  </StrictMode>,
);
