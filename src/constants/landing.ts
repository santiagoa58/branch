/**
 * Shared landing-page content.
 *
 * Single source of truth for the marketing copy rendered by both the desktop
 * `LandingPage` and the `MobileLandingPage`, so the two surfaces never drift.
 * Colors follow the design system (see `.cursor/design-system.md`): zinc neutrals
 * plus the per-node-type accent palette.
 */
import {
  CubeTransparentIcon,
  BoltIcon,
  UsersIcon,
  ArrowDownTrayIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  BeakerIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** Public, deployed editor URL — used by the mobile "open on desktop" CTA. */
export const APP_URL = "/app";

/** In-app route for the editor in local mode (the landing page lives at `/`). */
export const EDITOR_PATH = "/app";

export const BRAND = {
  name: "Branch",
  tagline: "Design and simulate software architecture — visually.",
  // Two halves of the value prop so each can be emphasized independently.
  whatLabel: "what",
  howLabel: "how data flows",
} as const;

export interface LandingFeature {
  icon: IconType;
  title: string;
  desc: string;
  /** Tailwind accent classes (kept as literals so Tailwind's scanner keeps them). */
  accentText: string;
  accentBg: string;
  accentBorder: string;
  /** Raw accent hex — drives the hover border-flow light (see `FeatureCard`). */
  accentHex: string;
}

export const FEATURES: LandingFeature[] = [
  {
    icon: CubeTransparentIcon,
    title: "Visual Builder",
    desc: "Drag & drop 20+ node types across services, cloud, and AI/ML.",
    accentText: "text-blue-400",
    accentBg: "bg-blue-500/10",
    accentBorder: "border-blue-500/20",
    accentHex: "#60a5fa",
  },
  {
    icon: BoltIcon,
    title: "Failure Simulation",
    desc: "Chaos engineering, cascade analysis, and blast radius.",
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/20",
    accentHex: "#fbbf24",
  },
  {
    icon: UsersIcon,
    title: "Collaboration",
    desc: "Real-time multi-user editing with live cursors.",
    accentText: "text-violet-400",
    accentBg: "bg-violet-500/10",
    accentBorder: "border-violet-500/20",
    accentHex: "#a78bfa",
  },
  {
    icon: ArrowDownTrayIcon,
    title: "Export Anywhere",
    desc: "PNG, SVG, PDF, JSON & Markdown — or shareable links.",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    accentBorder: "border-emerald-500/20",
    accentHex: "#34d399",
  },
];

export interface LandingUseCase {
  icon: IconType;
  label: string;
  desc: string;
}

export const USE_CASES: LandingUseCase[] = [
  {
    icon: AcademicCapIcon,
    label: "Onboarding",
    desc: "Help new developers understand the system visually.",
  },
  {
    icon: DocumentTextIcon,
    label: "API Documentation",
    desc: "Data contracts live alongside the diagram.",
  },
  {
    icon: MagnifyingGlassIcon,
    label: "System Review",
    desc: "Trace data flow through services end-to-end.",
  },
  {
    icon: PencilSquareIcon,
    label: "Architecture Design",
    desc: "Plan new features with clear integration points.",
  },
  {
    icon: BeakerIcon,
    label: "Resilience Testing",
    desc: "Simulate failures and chaos to validate architecture.",
  },
];

/**
 * Simulation modes showcased on the desktop page. Colors mirror the simulation
 * palette in the design system.
 */
export interface SimMode {
  title: string;
  desc: string;
  /** Hex used for the indicator dot / glow. */
  color: string;
  /** Which mini-preview animation to play on hover (see `SimModePreview`). */
  kind: "flow" | "cascade" | "partition" | "chaos";
}

export const SIM_MODES: SimMode[] = [
  {
    kind: "flow",
    title: "Flow tracing",
    desc: "Watch a request animate hop-by-hop across services, colored by protocol.",
    color: "#fbbf24",
  },
  {
    kind: "cascade",
    title: "Failure cascade",
    desc: "Fail a node and see the blast radius ripple downstream in real time.",
    color: "#f87171",
  },
  {
    kind: "partition",
    title: "Network partition",
    desc: "Sever the graph and find which services get stranded.",
    color: "#c084fc",
  },
  {
    kind: "chaos",
    title: "Chaos engineering",
    desc: "Inject random failures and recoveries to validate resilience.",
    color: "#34d399",
  },
];

/** Wire protocols you can attach to edges, with their design-system colors. */
export interface ProtocolBadge {
  label: string;
  color: string;
}

export const PROTOCOLS: ProtocolBadge[] = [
  { label: "HTTP/REST", color: "#60a5fa" },
  { label: "gRPC", color: "#34d399" },
  { label: "GraphQL", color: "#f472b6" },
  { label: "WebSocket", color: "#a78bfa" },
  { label: "Kafka", color: "#fb923c" },
  { label: "AMQP", color: "#fbbf24" },
  { label: "TCP", color: "#22d3ee" },
];
