/**
 * GettingStartedChecklist — a dismissible onboarding card that ticks off the
 * user's first node, connection, data contract, and flow simulation.
 *
 * Presentational only: progress is computed by `useOnboardingProgress` (mounted
 * separately) and stored in `onboardingStore`. Rendered `absolute` inside the
 * canvas region, so it is unaffected by the transformed-ancestor `position:fixed`
 * pitfall — no portal needed.
 */
import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/onboardingStore";
import { ONBOARDING_STEPS, isAllComplete, completedCount, getActiveStep } from "@/utils/onboarding";

interface GettingStartedChecklistProps {
  /** Hide while another bottom overlay (e.g. the simulation bar) is showing. */
  hidden?: boolean;
}

export function GettingStartedChecklist({ hidden = false }: GettingStartedChecklistProps) {
  const completedSteps = useOnboardingStore((s) => s.completedSteps);
  const dismissed = useOnboardingStore((s) => s.dismissed);
  const initialized = useOnboardingStore((s) => s.initialized);
  const dismiss = useOnboardingStore((s) => s.dismiss);
  const setActiveStep = useOnboardingStore((s) => s.setActiveStep);

  const allDone = isAllComplete(completedSteps);
  const count = completedCount(completedSteps);
  const total = ONBOARDING_STEPS.length;

  // On completion, show a brief celebratory state, then auto-hide for good.
  const [celebrating, setCelebrating] = useState(false);
  const [autoHidden, setAutoHidden] = useState(false);
  useEffect(() => {
    // Only start once the card is actually visible — step 4 completes while the
    // simulation bar (and thus this card) is hidden, so defer the celebration
    // until it can be seen.
    if (!allDone || autoHidden || hidden || dismissed || !initialized) {
      return;
    }
    const startTimer = setTimeout(() => setCelebrating(true), 0);
    const hideTimer = setTimeout(() => {
      setCelebrating(false);
      setAutoHidden(true);
    }, 2500);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(hideTimer);
    };
  }, [allDone, autoHidden, hidden, dismissed, initialized]);

  // The card is visible (and so should drive guidance) only in these conditions.
  const visible = initialized && !hidden && !dismissed && !(allDone && autoHidden) && !celebrating;
  const activeStep = visible ? getActiveStep(completedSteps) : null;

  // Publish the active step so the rest of the app can pulse the matching UI.
  // Cleared on unmount so stray pulses never linger.
  useEffect(() => {
    setActiveStep(activeStep);
  }, [activeStep, setActiveStep]);
  useEffect(() => () => setActiveStep(null), [setActiveStep]);

  // Gate on `initialized` so the first-run guard can decide before we paint
  // (prevents a flash for returning users with a populated diagram).
  if (hidden || dismissed || !initialized) {
    return null;
  }
  if (allDone && autoHidden) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bottom-6 left-6 z-30 w-64 max-w-[16rem]",
        "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-800",
        "rounded-xl shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden",
      )}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Getting started
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Dismiss"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {celebrating ? (
        <div className="px-3.5 py-5 text-center">
          <CheckCircleIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-pulse" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">You're all set!</p>
        </div>
      ) : (
        <>
          <ul className="px-3 py-2 space-y-1">
            {ONBOARDING_STEPS.map((step) => {
              const done = completedSteps[step.id];
              const isActive = !done && step.id === activeStep;
              return (
                <li key={step.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border shrink-0",
                          isActive
                            ? "border-blue-500 ring-2 ring-blue-500/30"
                            : "border-zinc-300 dark:border-zinc-600",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-xs",
                        done
                          ? "text-zinc-400 dark:text-zinc-500 line-through"
                          : isActive
                            ? "text-blue-600 dark:text-blue-400 font-medium"
                            : "text-zinc-700 dark:text-zinc-300",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {isActive && (
                    <p className="pl-6 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                      {step.hint}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="px-3.5 py-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500">
            {count} of {total} done · dismiss anytime
          </div>
        </>
      )}
    </div>
  );
}
