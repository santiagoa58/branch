import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import "./index.css";
import { CloudAuth, RequireAuth } from "@/components/CloudAuth";
import { initializeTheme } from "@/store/themeStore";

const disposeTheme = initializeTheme();
import.meta.hot?.dispose(disposeTheme);
const App = lazy(() => import("./App.tsx"));
const ProjectsPage = lazy(() =>
  import("./pages/ProjectsPage.tsx").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectPage = lazy(() =>
  import("./pages/ProjectPage.tsx").then((m) => ({ default: m.ProjectPage })),
);
function Shell() {
  return (
    <Suspense
      fallback={
        <output className="min-h-screen grid place-content-center bg-white dark:bg-zinc-950 text-zinc-500">
          Loading Branch…
        </output>
      }
    >
      <Outlet />
    </Suspense>
  );
}
const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <ProjectsPage /> },
          { path: "/sign-up", element: <Navigate to="/" replace /> },
          { path: "/projects/:projectId", element: <ProjectPage /> },
          { path: "/projects/:projectId/diagrams/:diagramId", element: <App /> },
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
