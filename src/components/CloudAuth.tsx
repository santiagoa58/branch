import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { shadcn } from "@clerk/ui/themes";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";
import { setApiTokenProvider } from "@/services/api";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useAIStore } from "@/store/aiStore";

const clerkTheme = { ...shadcn, cssLayerName: "clerk" };

export function CloudAuth({ children }: { children: ReactNode }) {
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (cloudWorkspace.isBusy() || useAnimationStore.getState().pendingDeletions.size > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    return (
      <div className="min-h-screen grid place-content-center bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 p-8">
        <h1 className="text-lg font-semibold">Configure Branch sign-in</h1>
        <p className="mt-2 text-sm">
          Set VITE_CLERK_PUBLISHABLE_KEY in .env.local, then restart the dev server. See README.md
          for cloud setup.
        </p>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={key} afterSignOutUrl="/" appearance={{ theme: clerkTheme }}>
      {children}
    </ClerkProvider>
  );
}

let workspaceOwner: string | null = null;
function UserWorkspace({ ownerId }: { ownerId: string }) {
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } }),
  );
  // Lazy routes can replay mount effects after becoming visible in StrictMode.
  // Install auth before their passive effects issue any workspace requests.
  useLayoutEffect(() => {
    setApiTokenProvider(getToken);
    return () => setApiTokenProvider(null);
  }, [getToken]);
  useEffect(() => {
    let active = true;
    void getToken()
      .then((token) => {
        if (!token) {
          throw new Error("Unable to load your session. Please sign in again or retry.");
        }
        if (active) {
          if (workspaceOwner !== ownerId) {
            cloudWorkspace.reset();
            useDiagramStore.getState().resetDiagramState();
            workspaceOwner = ownerId;
          }
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSessionError(error instanceof Error ? error.message : "Unable to load your session.");
        }
      });
    return () => {
      active = false;
    };
  }, [getToken, ownerId, attempt]);
  useEffect(
    () => () => {
      queryClient.clear();
      // Preserve failed/pending edits in memory for this account to recover after re-authentication.
      if (!cloudWorkspace.getState().dirty) {
        cloudWorkspace.reset();
        useDiagramStore.getState().resetDiagramState();
      }
      useAIStore.getState().clearSessionAnalysis();
    },
    [queryClient],
  );
  if (sessionError) {
    return (
      <div role="alert" className="p-8 text-sm text-muted-foreground">
        {sessionError}
        <button
          type="button"
          className="ml-3 underline"
          onClick={() => {
            setSessionError(null);
            setAttempt((value) => value + 1);
          }}
        >
          Retry session
        </button>
      </div>
    );
  }
  return ready ? (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  ) : (
    <output>Loading workspace…</output>
  );
}

export function RequireAuth() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const location = useLocation();
  if (!isLoaded) {
    return (
      <output className="min-h-screen grid place-content-center bg-background text-muted-foreground">
        Loading sign-in…
      </output>
    );
  }
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white dark:bg-zinc-950 p-8">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in to Branch
        </h1>
        {location.pathname === "/sign-up" ? (
          <SignUp routing="hash" signInUrl="/" forceRedirectUrl="/" />
        ) : (
          <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl={location.pathname} />
        )}
      </div>
    );
  }
  return <UserWorkspace key={userId} ownerId={userId} />;
}

export function AccountControls() {
  const { signOut, openUserProfile } = useClerk();
  const cloud = useCloudWorkspace();
  const pendingDeletes = useAnimationStore((state) => state.pendingDeletions.size);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <button type="button" onClick={() => openUserProfile()} className="hover:underline">
        Account
      </button>
      <button
        type="button"
        disabled={leaving || cloud.locked || pendingDeletes > 0}
        className="hover:underline disabled:opacity-50"
        onClick={() => {
          setLeaving(true);
          setError(null);
          void cloudWorkspace
            .flush()
            .then(() => signOut())
            .catch(() => {
              setError("Save your edits before signing out.");
            })
            .finally(() => setLeaving(false));
        }}
      >
        Sign out
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
