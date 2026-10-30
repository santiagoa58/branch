import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AnimatedThemeToggler } from "./animated-theme-toggler";

const root = document.documentElement;
const originalStart = Object.getOwnPropertyDescriptor(document, "startViewTransition");
const originalAnimate = Object.getOwnPropertyDescriptor(root, "animate");
const writeStorage = vi.fn<Storage["setItem"]>();

function mockMatchMedia(matches = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn<typeof window.matchMedia>().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn<MediaQueryList["addListener"]>(),
      removeListener: vi.fn<MediaQueryList["removeListener"]>(),
      addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
      removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
      dispatchEvent: vi.fn<MediaQueryList["dispatchEvent"]>().mockReturnValue(false),
    })),
  );
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockTransition(runUpdate = true) {
  const ready = deferred();
  const finished = deferred();
  const updateCallbackDone = deferred();
  const skipTransition = vi.fn<ViewTransition["skipTransition"]>();
  const transition: ViewTransition = {
    ready: ready.promise,
    finished: finished.promise,
    updateCallbackDone: updateCallbackDone.promise,
    skipTransition,
    types: new Set<string>(),
  };
  const start = vi.fn<typeof document.startViewTransition>().mockImplementation((update) => {
    if (runUpdate && typeof update === "function") {
      update();
      updateCallbackDone.resolve();
    }
    return transition;
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: start,
  });
  return { ready, finished, updateCallbackDone, skipTransition, start };
}

function mockAnimation() {
  const finished = deferred<Animation>();
  const cancel = vi.fn<Animation["cancel"]>();
  const animation: Partial<Animation> = { cancel, finished: finished.promise };
  const animate = vi.fn<Element["animate"]>().mockReturnValue(animation as Animation);
  Object.defineProperty(root, "animate", { configurable: true, value: animate });
  return { animate, cancel, finished };
}

function expectReleased() {
  expect(root).not.toHaveAttribute("data-magicui-theme-vt");
  expect(root.style.getPropertyValue("--magicui-theme-toggle-vt-duration")).toBe("");
  expect(root.style.getPropertyValue("--magicui-theme-vt-clip-from")).toBe("");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(localStorage, "setItem").mockImplementation(writeStorage);
  mockMatchMedia();
  root.classList.remove("dark");
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 800);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalStart) {
    Object.defineProperty(document, "startViewTransition", originalStart);
  } else {
    Reflect.deleteProperty(document, "startViewTransition");
  }
  if (originalAnimate) {
    Object.defineProperty(root, "animate", originalAnimate);
  } else {
    Reflect.deleteProperty(root, "animate");
  }
  root.classList.remove("dark");
});

describe("AnimatedThemeToggler", () => {
  it("applies the explicit controlled theme inside the snapshot without writing storage", async () => {
    const transition = mockTransition();
    const { animate, cancel } = mockAnimation();
    const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
    function ControlledToggle() {
      const [theme, setTheme] = useState<"light" | "dark">("light");
      return (
        <AnimatedThemeToggler
          theme={theme}
          onThemeChange={(nextTheme) => {
            onThemeChange(nextTheme);
            setTheme(nextTheme);
          }}
        />
      );
    }
    // A stale class must not turn an intended dark theme into light.
    root.classList.add("dark");
    render(<ControlledToggle />);
    const button = screen.getByRole("button", { name: "Toggle theme" });
    fireEvent.click(button);

    expect(root).toHaveClass("dark");
    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
    expect(writeStorage).not.toHaveBeenCalled();
    expect(root).toHaveAttribute("data-magicui-theme-vt", "active");
    expect(animate).not.toHaveBeenCalled();
    await act(async () => transition.ready.resolve());
    expect(animate).toHaveBeenCalledOnce();
    await act(async () => transition.finished.resolve());
    expectReleased();
    expect(cancel).toHaveBeenCalledOnce();

    fireEvent.click(button);
    expect(onThemeChange).toHaveBeenLastCalledWith("light");
    expect(root).not.toHaveClass("dark");
  });

  it.each(["view transitions", "WAAPI", "reduced motion"])(
    "changes theme immediately with %s unavailable or disabled",
    (fallback) => {
      const { start } = mockTransition();
      const { animate } = mockAnimation();
      if (fallback === "view transitions") {
        Object.defineProperty(document, "startViewTransition", { value: undefined });
      } else if (fallback === "WAAPI") {
        Object.defineProperty(root, "animate", { value: undefined });
      } else {
        mockMatchMedia(true);
      }
      root.classList.add("dark");
      const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
      render(<AnimatedThemeToggler theme="dark" onThemeChange={onThemeChange} />);
      fireEvent.click(screen.getByRole("button"));

      expect(root).not.toHaveClass("dark");
      expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("light");
      expect(start).not.toHaveBeenCalled();
      expect(animate).not.toHaveBeenCalled();
      expect(writeStorage).not.toHaveBeenCalled();
      expectReleased();
    },
  );

  it("keeps uncontrolled theme changes working when storage is blocked", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
    writeStorage.mockImplementationOnce(() => {
      throw new Error("Storage blocked");
    });
    render(<AnimatedThemeToggler />);
    fireEvent.click(screen.getByRole("button"));
    expect(root).toHaveClass("dark");
    expect(writeStorage).toHaveBeenCalledExactlyOnceWith("theme", "dark");
    expectReleased();
  });

  it("uses percentage circle geometry around the button and synchronizes CSS duration and clip", async () => {
    const transition = mockTransition();
    const { animate } = mockAnimation();
    render(<AnimatedThemeToggler theme="light" duration={650} />);
    const button = screen.getByRole("button");
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(80, 180, 40, 40));
    fireEvent.click(button);

    const from = "circle(0% at 10% 25%)";
    const radius = (Math.hypot(900, 600) / (Math.hypot(1000, 800) / Math.SQRT2)) * 100;
    expect(root.style.getPropertyValue("--magicui-theme-vt-clip-from")).toBe(from);
    expect(root.style.getPropertyValue("--magicui-theme-toggle-vt-duration")).toBe("650ms");
    await act(async () => transition.ready.resolve());
    expect(animate).toHaveBeenCalledExactlyOnceWith(
      { clipPath: [from, `circle(${radius}% at 10% 25%)`] },
      {
        duration: 650,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });

  it("can reveal from the viewport center instead of the button", async () => {
    const transition = mockTransition();
    const { animate } = mockAnimation();
    render(<AnimatedThemeToggler theme="light" fromCenter />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => transition.ready.resolve());
    expect(animate).toHaveBeenCalledWith(
      { clipPath: ["circle(0% at 50% 50%)", expect.stringContaining("at 50% 50%)")] },
      expect.any(Object),
    );
  });

  it.each([
    ["square", 4],
    ["triangle", 3],
    ["diamond", 4],
    ["hexagon", 6],
    ["rectangle", 4],
    ["star", 10],
  ] as const)("preserves the %s registry variant and its %i vertices", async (variant, count) => {
    const transition = mockTransition();
    const { animate } = mockAnimation();
    render(<AnimatedThemeToggler theme="light" variant={variant} fromCenter />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => transition.ready.resolve());
    const keyframes = animate.mock.calls[0]?.[0];
    expect(keyframes).toMatchObject({ clipPath: [expect.any(String), expect.any(String)] });
    // The mock receives the registry's property-indexed keyframes, not a Keyframe array.
    if (!keyframes || Array.isArray(keyframes)) {
      throw new Error("Expected property-indexed clip paths");
    }
    const clips = keyframes["clipPath"];
    if (!Array.isArray(clips)) {
      throw new Error("Expected clip path endpoints");
    }
    for (const clip of clips) {
      expect(clip).toMatch(/^polygon\(/);
      expect(String(clip).split(", ")).toHaveLength(count);
      expect(clip).not.toContain("px");
    }
    expect(animate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        easing: variant === "star" ? "linear" : "cubic-bezier(0.22, 1, 0.36, 1)",
      }),
    );
  });

  it("guards rapid clicks both on the same toggle and on other mounted toggles", async () => {
    const transition = mockTransition();
    mockAnimation();
    const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
    render(
      <>
        <AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} aria-label="First" />
        <AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} aria-label="Second" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    expect(transition.start).toHaveBeenCalledOnce();
    expect(onThemeChange).toHaveBeenCalledOnce();
    await act(async () => transition.finished.resolve());
    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    expect(transition.start).toHaveBeenCalledTimes(2);
  });

  it("falls back and releases ownership when startViewTransition throws synchronously", () => {
    const { start } = mockTransition();
    mockAnimation();
    start.mockImplementation(() => {
      throw new Error("Transition unavailable");
    });
    const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
    render(<AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(root).toHaveClass("dark");
    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
    expectReleased();
    fireEvent.click(screen.getByRole("button"));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it.each(["ready", "finished", "updateCallbackDone"] as const)(
    "releases the clip and lock when %s rejects, including before the theme callback",
    async (promise) => {
      const transition = mockTransition(false);
      const { animate } = mockAnimation();
      const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
      render(<AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} />);
      fireEvent.click(screen.getByRole("button"));
      await act(async () => transition[promise].reject(new Error("Transition aborted")));
      expect(root).toHaveClass("dark");
      expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
      expect(transition.skipTransition).toHaveBeenCalledOnce();
      expectReleased();
      await act(async () => transition.ready.resolve());
      const update = transition.start.mock.calls[0]?.[0];
      if (typeof update === "function") {
        await act(async () => {
          await update();
        });
      }
      expect(animate).not.toHaveBeenCalled();
      expect(onThemeChange).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole("button"));
      expect(transition.start).toHaveBeenCalledTimes(2);
    },
  );

  it("does not double-apply the theme when ready rejects after the snapshot callback", async () => {
    const transition = mockTransition();
    mockAnimation();
    const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
    render(<AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => transition.ready.reject(new Error("Skipped")));
    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
    expect(root).toHaveClass("dark");
    expectReleased();
  });

  it("cleans up if WAAPI throws or its animation rejects", async () => {
    const transition = mockTransition();
    const { animate } = mockAnimation();
    animate.mockImplementationOnce(() => {
      throw new Error("Pseudo-element animation unsupported");
    });
    render(<AnimatedThemeToggler theme="light" />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => transition.ready.resolve());
    expect(transition.skipTransition).toHaveBeenCalledOnce();
    expectReleased();

    const next = mockTransition();
    const animation = mockAnimation();
    fireEvent.click(screen.getByRole("button"));
    await act(async () => next.ready.resolve());
    await act(async () => animation.finished.reject(new Error("Animation cancelled")));
    expect(animation.cancel).toHaveBeenCalledOnce();
    expect(next.skipTransition).toHaveBeenCalledOnce();
    expectReleased();
  });

  it("cancels and skips on unmount, and never animates or applies a delayed callback", async () => {
    const transition = mockTransition(false);
    const { animate } = mockAnimation();
    const onThemeChange = vi.fn<(theme: "light" | "dark") => void>();
    const view = render(<AnimatedThemeToggler theme="light" onThemeChange={onThemeChange} />);
    fireEvent.click(screen.getByRole("button"));
    view.unmount();
    expect(transition.skipTransition).toHaveBeenCalledOnce();
    expectReleased();
    const update = transition.start.mock.calls[0]?.[0];
    await act(async () => {
      if (typeof update === "function") {
        await update();
      }
      transition.ready.resolve();
      transition.finished.reject(new Error("Unmounted"));
    });
    expect(animate).not.toHaveBeenCalled();
    expect(onThemeChange).not.toHaveBeenCalled();
    expect(root).not.toHaveClass("dark");
  });

  it("does not let old cleanup or an idle instance unmount clear a newer transition", async () => {
    const old = mockTransition();
    const oldAnimation = mockAnimation();
    const first = render(<AnimatedThemeToggler theme="light" />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => old.ready.resolve());
    first.unmount();
    expect(oldAnimation.cancel).toHaveBeenCalledOnce();
    expect(old.skipTransition).toHaveBeenCalledOnce();

    const idle = render(<AnimatedThemeToggler theme="dark" aria-label="Idle" />);
    const next = mockTransition();
    const nextAnimation = mockAnimation();
    render(<AnimatedThemeToggler theme="dark" duration={900} aria-label="New" />);
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    await act(async () => next.ready.resolve());
    idle.unmount();
    await act(async () => old.finished.reject(new Error("Old transition aborted")));
    expect(root).toHaveAttribute("data-magicui-theme-vt", "active");
    expect(root.style.getPropertyValue("--magicui-theme-toggle-vt-duration")).toBe("900ms");
    expect(root.style.getPropertyValue("--magicui-theme-vt-clip-from")).not.toBe("");
    expect(nextAnimation.cancel).not.toHaveBeenCalled();
    await act(async () => next.finished.resolve());
    expectReleased();
  });

  it("preserves button styling, attributes, disabled behavior, and consumer click handlers", () => {
    const { start } = mockTransition();
    mockAnimation();
    const onClick = vi.fn<() => void>();
    const view = render(
      <AnimatedThemeToggler
        theme="light"
        className="size-8 text-muted-foreground"
        aria-label="Switch appearance"
        title="Appearance"
        data-testid="theme-toggle"
        disabled
        onClick={onClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Switch appearance" });
    expect(button).toHaveClass("size-8", "text-muted-foreground");
    expect(button).toHaveAttribute("title", "Appearance");
    expect(button).toHaveAttribute("data-testid", "theme-toggle");
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
    expect(start).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();

    view.rerender(
      <AnimatedThemeToggler
        theme="light"
        onClick={(event) => {
          onClick();
          event.preventDefault();
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it("still transitions after StrictMode's effect cleanup and remount", async () => {
    const transition = mockTransition();
    const { animate } = mockAnimation();
    render(
      <StrictMode>
        <AnimatedThemeToggler theme="light" />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button"));
    await act(async () => transition.ready.resolve());
    expect(animate).toHaveBeenCalledOnce();
  });
});
