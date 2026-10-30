import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { shadcn } from "@clerk/ui/themes";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { setApiTokenProvider } from "@/services/api";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useAIStore } from "@/store/aiStore";

const clerkTheme = { ...shadcn, cssLayerName: "clerk" };
let authenticatedOwner: string | null = null;
let workspaceNavigate: ((url: string, replace: boolean) => void) | null = null;
function navigateWithinApp(url: string, replace: boolean) {
  if (workspaceNavigate) {
    workspaceNavigate(url, replace);
  } else {
    window.location.assign(url);
  }
}

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
    <ClerkProvider
      publishableKey={key}
      afterSignOutUrl="/"
      appearance={{ theme: clerkTheme }}
      routerPush={(url) => navigateWithinApp(url, false)}
      routerReplace={(url) => navigateWithinApp(url, true)}
    >
      {children}
    </ClerkProvider>
  );
}

let workspaceOwner: string | null = null;
function UserWorkspace({ ownerId }: { ownerId: string }) {
  const { getToken } = useAuth();
  const { transitioning } = useCloudWorkspace();
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(() => cloudWorkspace.getState().dirty);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } }),
  );
  // Lazy routes can replay mount effects after becoming visible in StrictMode.
  // Install auth before their passive effects issue any workspace requests.
  useLayoutEffect(() => {
    // Never use a new account's token to flush the previous owner's edits.
    const ownerBlocked =
      workspaceOwner !== null && workspaceOwner !== ownerId && cloudWorkspace.getState().dirty;
    setApiTokenProvider(
      ownerBlocked
        ? null
        : async () => {
            const token = await getToken();
            return authenticatedOwner === ownerId ? token : null;
          },
    );
    return () => setApiTokenProvider(null);
  }, [getToken, ownerId, attempt]);
  useEffect(() => {
    // A reset can outlive sign-out; do not mount routes until that transition settles.
    if (transitioning) {
      return;
    }
    let active = true;
    void getToken()
      .then((token) => {
        if (!token) {
          throw new Error("Unable to load your session. Please sign in again or retry.");
        }
        if (active && !cloudWorkspace.getState().transitioning) {
          if (workspaceOwner !== ownerId) {
            if (cloudWorkspace.getState().dirty) {
              cloudWorkspace.suspend();
              setRecovering(true);
              setReady(true);
              return;
            }
            cloudWorkspace.reset();
            useDiagramStore.getState().resetDiagramState();
            workspaceOwner = ownerId;
            setRecovering(false);
          }
          if (recovering && cloudWorkspace.getState().dirty) {
            cloudWorkspace.suspend();
          } else {
            cloudWorkspace.resume();
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
  }, [getToken, ownerId, attempt, recovering, transitioning]);
  useEffect(
    () => () => {
      queryClient.clear();
      // Preserve failed/pending edits in memory for this account to recover after re-authentication.
      if (cloudWorkspace.getState().dirty) {
        cloudWorkspace.suspend();
      } else {
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
  if (ready && recovering) {
    return (
      <WorkspaceRecovery
        ownerMatches={workspaceOwner === ownerId}
        onRecovered={() => setRecovering(false)}
        onDiscard={() => {
          cloudWorkspace.reset();
          useDiagramStore.getState().resetDiagramState();
          workspaceOwner = ownerId;
          setRecovering(false);
          setAttempt((value) => value + 1);
        }}
      />
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

function WorkspaceRecovery({
  ownerMatches,
  onRecovered,
  onDiscard,
}: {
  ownerMatches: boolean;
  onRecovered: () => void;
  onDiscard: () => void;
}) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <section
      role="alert"
      aria-label="Unsaved workspace recovery"
      className="min-h-screen grid place-content-center gap-4 p-8 bg-background text-foreground text-sm"
    >
      <h1 className="text-lg font-semibold">Unsaved edits need attention</h1>
      <p className="max-w-md">
        {ownerMatches
          ? "Your edits are still in memory. Save them, download a recovery copy, or explicitly discard them before continuing."
          : "Unsaved edits belong to another account. Sign in with the original account to save or download them, or explicitly discard them to continue with this account."}
      </p>
      <p className="max-w-md text-muted-foreground">
        Do not close or reload this tab. Recovery data is not stored on this device.
      </p>
      {error && <p>{error}</p>}
      <div className="flex flex-wrap gap-4">
        {ownerMatches ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => {
                setBusy(true);
                setError(null);
                cloudWorkspace.resume();
                void cloudWorkspace
                  .runTransition(async () => {})
                  .then(() => {
                    if (active.current) {
                      onRecovered();
                    }
                  })
                  .catch((cause: unknown) => {
                    if (active.current) {
                      cloudWorkspace.suspend();
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Save failed. Download a recovery copy before discarding.",
                      );
                    }
                  })
                  .finally(() => {
                    if (active.current) {
                      setBusy(false);
                    }
                  });
              }}
            >
              Retry saving edits
            </button>
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => {
                try {
                  const snapshot = useDiagramStore.getState().exportDiagram();
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "branch-recovery.json";
                  link.click();
                  URL.revokeObjectURL(url);
                } catch {
                  setError("Could not download recovery data. Your edits remain in memory.");
                }
              }}
            >
              Download recovery JSON
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="underline"
            onClick={() => {
              setBusy(true);
              setError(null);
              // Suppress Clerk's default redirect so recovery survives signing back in.
              void signOut(() => {})
                .catch(() => {
                  if (active.current) {
                    setError("Could not sign out. Retry to sign in with the original account.");
                  }
                })
                .finally(() => {
                  if (active.current) {
                    setBusy(false);
                  }
                });
            }}
          >
            Sign in with original account
          </button>
        )}
        {!confirmDiscard ? (
          <button
            type="button"
            disabled={busy}
            className="underline"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard edits and continue
          </button>
        ) : (
          <>
            <span>Discard these edits permanently?</span>
            <button type="button" disabled={busy} className="underline" onClick={onDiscard}>
              Confirm discard and continue
            </button>
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => setConfirmDiscard(false)}
            >
              Keep edits
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export function RequireAuth() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    authenticatedOwner = isLoaded && isSignedIn ? userId : null;
    // Clerk redirects must stay in this tab's SPA to retain recovery data in memory.
    workspaceNavigate = (url, replace) => {
      void navigate(url, { replace });
    };
    return () => {
      workspaceNavigate = null;
      authenticatedOwner = null;
    };
  }, [navigate, isLoaded, isSignedIn, userId]);
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
      <button
        type="button"
        disabled={cloud.locked}
        onClick={() => openUserProfile()}
        className="hover:underline"
      >
        Account
      </button>
      <button
        type="button"
        disabled={leaving || cloud.locked || pendingDeletes > 0}
        className="hover:underline disabled:opacity-50"
        onClick={() => {
          if (
            cloudWorkspace.getState().locked ||
            useAnimationStore.getState().pendingDeletions.size > 0
          ) {
            return;
          }
          setLeaving(true);
          setError(null);
          void cloudWorkspace
            .runTransition(() => signOut())
            .catch(() => {
              setError("Could not sign out. Your edits are still available; retry when ready.");
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
