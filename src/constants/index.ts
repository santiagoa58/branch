import { ArchitectureNodeType, GroupNodeType, CommentColor, EdgeProtocol } from "@/types";
import {
  CpuChipIcon,
  CircleStackIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  GlobeAltIcon,
  CloudIcon,
  ArchiveBoxIcon,
  UserIcon,
  ServerStackIcon,
  GlobeAmericasIcon,
  RectangleGroupIcon,
  ChatBubbleBottomCenterTextIcon,
  // Tier 1: Cloud Infrastructure
  ArrowsRightLeftIcon,
  ShieldCheckIcon,
  CubeIcon,
  LinkIcon,
  SignalIcon,
  // Tier 2: AI/ML
  SparklesIcon,
  CubeTransparentIcon,
  ArrowPathIcon,
  // Tier 3: Cloud Services
  KeyIcon,
  QueueListIcon,
  InboxStackIcon,
  MagnifyingGlassCircleIcon,
  BellAlertIcon,
  ShareIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  CreditCardIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// Node type configuration with colors and icons
export interface NodeTypeConfig {
  label: string;
  description: string;
  icon: typeof CpuChipIcon;
  iconColor: string;
  bgClass: string;
  borderClass: string;
  // Legacy props for compatibility
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  keywords?: readonly string[];
}

const ORIGINAL_NODE_TYPES_CONFIG = {
  service: {
    label: "Service",
    description: "Microservice",
    icon: CpuChipIcon,
    iconColor: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
    color: "text-blue-400",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-950",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-800",
  },
  database: {
    label: "PostgreSQL",
    description: "Relational DB",
    icon: CircleStackIcon,
    iconColor: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    color: "text-emerald-400",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950",
    borderLight: "border-emerald-200",
    borderDark: "dark:border-emerald-800",
  },
  queue: {
    label: "RabbitMQ",
    description: "Message Broker",
    icon: ChatBubbleLeftRightIcon,
    iconColor: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    color: "text-amber-400",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-950",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
  },
  cache: {
    label: "Redis Cache",
    description: "In-memory",
    icon: BoltIcon,
    iconColor: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
    color: "text-red-400",
    bgLight: "bg-yellow-50",
    bgDark: "dark:bg-yellow-950",
    borderLight: "border-yellow-200",
    borderDark: "dark:border-yellow-800",
  },
  gateway: {
    label: "Gateway",
    description: "API Gateway",
    icon: GlobeAltIcon,
    iconColor: "text-purple-400",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/20",
    color: "text-purple-400",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-950",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-800",
  },
  external: {
    label: "External API",
    description: "Third-party",
    icon: CloudIcon,
    iconColor: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/20",
    color: "text-slate-400",
    bgLight: "bg-slate-50",
    bgDark: "dark:bg-slate-950",
    borderLight: "border-slate-200",
    borderDark: "dark:border-slate-800",
  },
  storage: {
    label: "S3 Storage",
    description: "Object Storage",
    icon: ArchiveBoxIcon,
    iconColor: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
    color: "text-cyan-400",
    bgLight: "bg-cyan-50",
    bgDark: "dark:bg-cyan-950",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-800",
  },
  client: {
    label: "Client",
    description: "Frontend App",
    icon: UserIcon,
    iconColor: "text-pink-400",
    bgClass: "bg-pink-500/10",
    borderClass: "border-pink-500/20",
    color: "text-pink-400",
    bgLight: "bg-pink-50",
    bgDark: "dark:bg-pink-950",
    borderLight: "border-pink-200",
    borderDark: "dark:border-pink-800",
  },
  // ═══════════════════════════════════════════════════════════
  // TIER 1: Cloud Infrastructure
  // ═══════════════════════════════════════════════════════════
  lambda: {
    label: "Lambda",
    description: "Serverless Function",
    icon: BoltIcon,
    iconColor: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/20",
    color: "text-orange-400",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-950",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
  },
  loadbalancer: {
    label: "Load Balancer",
    description: "Traffic Distribution",
    icon: ArrowsRightLeftIcon,
    iconColor: "text-indigo-400",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-500/20",
    color: "text-indigo-400",
    bgLight: "bg-indigo-50",
    bgDark: "dark:bg-indigo-950",
    borderLight: "border-indigo-200",
    borderDark: "dark:border-indigo-800",
  },
  cdn: {
    label: "CDN",
    description: "Edge Delivery",
    icon: SignalIcon,
    iconColor: "text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/20",
    color: "text-sky-400",
    bgLight: "bg-sky-50",
    bgDark: "dark:bg-sky-950",
    borderLight: "border-sky-200",
    borderDark: "dark:border-sky-800",
  },
  auth: {
    label: "Auth Provider",
    description: "Identity & Access",
    icon: ShieldCheckIcon,
    iconColor: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
    color: "text-violet-400",
    bgLight: "bg-violet-50",
    bgDark: "dark:bg-violet-950",
    borderLight: "border-violet-200",
    borderDark: "dark:border-violet-800",
  },
  container: {
    label: "Container",
    description: "Docker/Pod",
    icon: CubeIcon,
    iconColor: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/20",
    color: "text-slate-400",
    bgLight: "bg-slate-50",
    bgDark: "dark:bg-slate-950",
    borderLight: "border-slate-200",
    borderDark: "dark:border-slate-800",
  },
  dns: {
    label: "DNS",
    description: "Domain Routing",
    icon: LinkIcon,
    iconColor: "text-lime-400",
    bgClass: "bg-lime-500/10",
    borderClass: "border-lime-500/20",
    color: "text-lime-400",
    bgLight: "bg-lime-50",
    bgDark: "dark:bg-lime-950",
    borderLight: "border-lime-200",
    borderDark: "dark:border-lime-800",
  },
  // ═══════════════════════════════════════════════════════════
  // TIER 2: AI/ML
  // ═══════════════════════════════════════════════════════════
  llm: {
    label: "LLM",
    description: "Language Model",
    icon: SparklesIcon,
    iconColor: "text-fuchsia-400",
    bgClass: "bg-fuchsia-500/10",
    borderClass: "border-fuchsia-500/20",
    color: "text-fuchsia-400",
    bgLight: "bg-fuchsia-50",
    bgDark: "dark:bg-fuchsia-950",
    borderLight: "border-fuchsia-200",
    borderDark: "dark:border-fuchsia-800",
  },
  vectordb: {
    label: "Vector DB",
    description: "Embeddings Store",
    icon: CircleStackIcon,
    iconColor: "text-teal-400",
    bgClass: "bg-teal-500/10",
    borderClass: "border-teal-500/20",
    color: "text-teal-400",
    bgLight: "bg-teal-50",
    bgDark: "dark:bg-teal-950",
    borderLight: "border-teal-200",
    borderDark: "dark:border-teal-800",
  },
  mlpipeline: {
    label: "ML Pipeline",
    description: "Training/Inference",
    icon: ArrowPathIcon,
    iconColor: "text-pink-400",
    bgClass: "bg-pink-500/10",
    borderClass: "border-pink-500/20",
    color: "text-pink-400",
    bgLight: "bg-pink-50",
    bgDark: "dark:bg-pink-950",
    borderLight: "border-pink-200",
    borderDark: "dark:border-pink-800",
  },
  embedding: {
    label: "Embedding",
    description: "Vector Encoder",
    icon: CubeTransparentIcon,
    iconColor: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/20",
    color: "text-rose-400",
    bgLight: "bg-rose-50",
    bgDark: "dark:bg-rose-950",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-800",
  },
  // ═══════════════════════════════════════════════════════════
  // TIER 3: Cloud Services
  // ═══════════════════════════════════════════════════════════
  secrets: {
    label: "Secrets",
    description: "Secrets Manager",
    icon: KeyIcon,
    iconColor: "text-yellow-400",
    bgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500/20",
    color: "text-yellow-400",
    bgLight: "bg-yellow-50",
    bgDark: "dark:bg-yellow-950",
    borderLight: "border-yellow-200",
    borderDark: "dark:border-yellow-800",
  },
  eventbus: {
    label: "Event Bus",
    description: "Event Broker",
    icon: QueueListIcon,
    iconColor: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/20",
    color: "text-orange-400",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-950",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
  },
  datalake: {
    label: "Data Lake",
    description: "Big Data Storage",
    icon: InboxStackIcon,
    iconColor: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
    color: "text-cyan-400",
    bgLight: "bg-cyan-50",
    bgDark: "dark:bg-cyan-950",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-800",
  },
  search: {
    label: "Search",
    description: "Search Engine",
    icon: MagnifyingGlassCircleIcon,
    iconColor: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    color: "text-amber-400",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-800",
  },
  notification: {
    label: "Notification",
    description: "Push/Alert Service",
    icon: BellAlertIcon,
    iconColor: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
    color: "text-red-400",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-950",
    borderLight: "border-red-200",
    borderDark: "dark:border-red-800",
  },
} satisfies Record<string, NodeTypeConfig>;

// Reuse complete, statically declared styles so Tailwind can discover every class.
function catalogNode(
  preset: keyof typeof ORIGINAL_NODE_TYPES_CONFIG,
  label: string,
  description: string,
  icon: NodeTypeConfig["icon"],
  keywords: readonly string[],
): NodeTypeConfig {
  return { ...ORIGINAL_NODE_TYPES_CONFIG[preset], label, description, icon, keywords };
}

export const NODE_TYPES_CONFIG: Record<ArchitectureNodeType, NodeTypeConfig> = {
  ...ORIGINAL_NODE_TYPES_CONFIG,
  webapp: catalogNode("client", "Web App", "Browser-based application", GlobeAltIcon, [
    "frontend",
    "browser",
    "spa",
    "ssr",
  ]),
  mobileapp: catalogNode("client", "Mobile App", "Native or hybrid mobile application", UserIcon, [
    "frontend",
    "ios",
    "android",
    "mobile",
  ]),
  component: catalogNode("client", "UI Component", "Reusable user interface component", CubeIcon, [
    "frontend",
    "ui",
    "widget",
    "design system",
  ]),
  microfrontend: catalogNode(
    "client",
    "Microfrontend",
    "Independently deployed frontend module",
    RectangleGroupIcon,
    ["frontend", "module federation", "ui"],
  ),
  router: catalogNode(
    "gateway",
    "Router",
    "Client-side navigation and route resolution",
    ArrowsRightLeftIcon,
    ["frontend", "navigation", "routes"],
  ),
  statestore: catalogNode("cache", "State Store", "Shared application state", CircleStackIcon, [
    "frontend",
    "state management",
    "store",
    "zustand",
    "redux",
    "pinia",
  ]),
  serviceworker: catalogNode(
    "client",
    "Service Worker",
    "Browser background tasks and offline caching",
    ArrowPathIcon,
    ["frontend", "offline", "pwa", "browser"],
  ),
  bff: catalogNode(
    "service",
    "Backend for Frontend",
    "Client-specific API aggregation",
    ServerStackIcon,
    ["frontend", "backend", "bff", "aggregation"],
  ),
  worker: catalogNode("service", "Worker", "Background job processing", CpuChipIcon, [
    "backend",
    "job",
    "consumer",
    "async",
  ]),
  scheduler: catalogNode("lambda", "Scheduler", "Time-based job scheduling", ArrowPathIcon, [
    "backend",
    "cron",
    "timer",
    "scheduled jobs",
  ]),
  workflow: catalogNode(
    "service",
    "Workflow",
    "Durable multi-step task orchestration",
    RectangleGroupIcon,
    ["backend", "orchestration", "saga", "durable execution"],
  ),
  ratelimiter: catalogNode(
    "gateway",
    "Rate Limiter",
    "Request throttling and quota enforcement",
    ShieldCheckIcon,
    ["backend", "throttling", "quota", "traffic"],
  ),
  webhook: catalogNode("eventbus", "Webhook", "Event-triggered HTTP callback", LinkIcon, [
    "backend",
    "callback",
    "http",
    "event",
  ]),
  server: catalogNode("container", "Server", "Physical or virtual compute host", ServerStackIcon, [
    "infrastructure",
    "vm",
    "host",
    "compute",
  ]),
  kubernetes: catalogNode("container", "Kubernetes", "Container orchestration platform", CubeIcon, [
    "infrastructure",
    "k8s",
    "orchestration",
    "pods",
  ]),
  ingress: catalogNode(
    "gateway",
    "Ingress",
    "Inbound application traffic routing",
    ArrowsRightLeftIcon,
    ["infrastructure", "routing", "entrypoint", "k8s"],
  ),
  proxy: catalogNode(
    "loadbalancer",
    "Proxy",
    "Forward or reverse traffic proxy",
    ArrowsRightLeftIcon,
    ["infrastructure", "reverse proxy", "forward proxy"],
  ),
  firewall: catalogNode(
    "auth",
    "Firewall",
    "Network traffic filtering and protection",
    ShieldCheckIcon,
    ["infrastructure", "security", "waf", "network"],
  ),
  vpn: catalogNode("auth", "VPN", "Encrypted private network tunnel", KeyIcon, [
    "infrastructure",
    "tunnel",
    "network",
    "security",
  ]),
  nosql: catalogNode(
    "database",
    "NoSQL Database",
    "Document or key-value database",
    CircleStackIcon,
    ["data", "document", "key value", "nonrelational"],
  ),
  graphdb: catalogNode(
    "database",
    "Graph Database",
    "Relationship-oriented data storage",
    ShareIcon,
    ["data", "graph", "relationships", "vertices"],
  ),
  timeseries: catalogNode(
    "database",
    "Time Series Database",
    "Timestamped measurements and events",
    ChartBarIcon,
    ["data", "temporal", "measurements", "tsdb"],
  ),
  warehouse: catalogNode(
    "datalake",
    "Data Warehouse",
    "Structured analytical data storage",
    InboxStackIcon,
    ["data", "analytics", "olap", "bi"],
  ),
  etl: catalogNode("datalake", "ETL Pipeline", "Extract, transform, and load data", ArrowPathIcon, [
    "data",
    "elt",
    "transformation",
    "ingestion",
  ]),
  stream: catalogNode(
    "eventbus",
    "Data Stream",
    "Continuous event and data processing",
    SignalIcon,
    ["data", "streaming", "realtime", "events"],
  ),
  backup: catalogNode("storage", "Backup", "Recovery snapshots and archived data", ArchiveBoxIcon, [
    "data",
    "restore",
    "snapshot",
    "disaster recovery",
  ]),
  logging: catalogNode(
    "search",
    "Logging",
    "Centralized log collection and analysis",
    QueueListIcon,
    ["observability", "logs", "audit", "diagnostics"],
  ),
  metrics: catalogNode(
    "search",
    "Metrics",
    "Operational measurements and dashboards",
    ChartBarIcon,
    ["observability", "monitoring", "telemetry", "dashboard"],
  ),
  tracing: catalogNode("search", "Tracing", "Distributed request and span tracking", ShareIcon, [
    "observability",
    "trace",
    "spans",
    "apm",
  ]),
  alerting: catalogNode(
    "notification",
    "Alerting",
    "Incident detection and escalation",
    BellAlertIcon,
    ["observability", "incident", "on call", "alarms"],
  ),
  agent: catalogNode("llm", "AI Agent", "Model-driven planning and task execution", SparklesIcon, [
    "ai",
    "autonomous",
    "planning",
    "tool calling",
  ]),
  retriever: catalogNode(
    "vectordb",
    "Retriever",
    "Fetch relevant context for model input",
    MagnifyingGlassCircleIcon,
    ["ai", "rag", "retrieval", "context"],
  ),
  reranker: catalogNode(
    "embedding",
    "Reranker",
    "Reorder retrieved results by relevance",
    ArrowsRightLeftIcon,
    ["ai", "rag", "ranking", "relevance"],
  ),
  prompt: catalogNode(
    "llm",
    "Prompt",
    "Model instructions and context template",
    ChatBubbleBottomCenterTextIcon,
    ["ai", "template", "instructions", "context"],
  ),
  guardrail: catalogNode(
    "auth",
    "Guardrail",
    "Model input and output safety checks",
    ShieldCheckIcon,
    ["ai", "safety", "validation", "moderation"],
  ),
  modelregistry: catalogNode(
    "mlpipeline",
    "Model Registry",
    "Versioned model artifacts and lifecycle",
    ArchiveBoxIcon,
    ["ai", "mlops", "model versions", "artifacts"],
  ),
  featurestore: catalogNode(
    "vectordb",
    "Feature Store",
    "Shared online and offline ML features",
    CircleStackIcon,
    ["ai", "ml", "features", "feature engineering"],
  ),
  training: catalogNode(
    "mlpipeline",
    "Training",
    "Model training and fine-tuning jobs",
    ArrowPathIcon,
    ["ai", "ml", "fine tuning", "learning"],
  ),
  inference: catalogNode("llm", "Inference", "Model serving and prediction endpoint", BoltIcon, [
    "ai",
    "prediction",
    "serving",
    "runtime",
  ]),
  gpu: catalogNode(
    "mlpipeline",
    "GPU Compute",
    "Accelerated training and inference compute",
    CpuChipIcon,
    ["ai", "accelerator", "gpu", "compute"],
  ),
  evaluation: catalogNode(
    "mlpipeline",
    "Evaluation",
    "Model quality and behavior assessment",
    ChartBarIcon,
    ["ai", "benchmark", "evals", "quality"],
  ),
  tool: catalogNode(
    "llm",
    "AI Tool",
    "Callable capability exposed to an agent",
    WrenchScrewdriverIcon,
    ["ai", "function calling", "mcp", "action"],
  ),
  payment: catalogNode("external", "Payment", "Payment processing and settlement", CreditCardIcon, [
    "integration",
    "billing",
    "checkout",
    "transactions",
  ]),
  email: catalogNode(
    "notification",
    "Email",
    "Transactional and outbound email delivery",
    EnvelopeIcon,
    ["integration", "mail", "smtp", "delivery"],
  ),
  identity: catalogNode(
    "auth",
    "Identity Directory",
    "User directory and identity federation",
    UserIcon,
    ["integration", "directory", "sso", "federation"],
  ),
  iot: catalogNode("external", "IoT Device", "Connected sensor or edge device", SignalIcon, [
    "integration",
    "sensor",
    "device",
    "telemetry",
    "edge",
  ]),
};

// Edge styles by protocol (legacy - kept for reference)
export const EDGE_STYLES: Record<
  string,
  {
    strokeDasharray?: string;
    animated?: boolean;
    strokeWidth: number;
  }
> = {
  http: { strokeWidth: 2 },
  grpc: { strokeDasharray: "5 5", strokeWidth: 2 },
  websocket: { animated: true, strokeWidth: 2 },
  tcp: { strokeWidth: 3 },
  amqp: { strokeDasharray: "2 2", animated: true, strokeWidth: 2 },
  kafka: { strokeDasharray: "2 2", animated: true, strokeWidth: 2 },
};

// Protocol configuration with colors, labels, and styles
export const PROTOCOL_CONFIG: Record<
  EdgeProtocol,
  {
    label: string;
    group: "standard" | "messaging" | "data" | "auth" | "aiml";
    color: {
      primary: string;
      secondary: string;
    };
    style: {
      strokeDasharray?: string;
      strokeWidth?: number;
      animated?: boolean;
    };
    /** Whether this protocol supports request/response semantics (false = fire-and-forget) */
    requestResponse: boolean;
    defaultForNodes?: string[]; // Node types that should default to this protocol
  }
> = {
  // ═══════════════════════════════════════════════════════════
  // STANDARD PROTOCOLS
  // ═══════════════════════════════════════════════════════════
  http: {
    label: "HTTP/REST",
    group: "standard",
    color: { primary: "#3b82f6", secondary: "#60a5fa" }, // Blue
    style: { strokeWidth: 2 },
    requestResponse: true,
    defaultForNodes: ["service", "gateway", "external", "client"],
  },
  grpc: {
    label: "gRPC",
    group: "standard",
    color: { primary: "#10b981", secondary: "#34d399" }, // Emerald
    style: { strokeDasharray: "5 5", strokeWidth: 2 },
    requestResponse: true,
  },
  graphql: {
    label: "GraphQL",
    group: "standard",
    color: { primary: "#ec4899", secondary: "#f472b6" }, // Pink
    style: { strokeWidth: 2 },
    requestResponse: true,
  },
  websocket: {
    label: "WebSocket",
    group: "standard",
    color: { primary: "#8b5cf6", secondary: "#a78bfa" }, // Purple
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: true,
  },
  tcp: {
    label: "TCP",
    group: "standard",
    color: { primary: "#06b6d4", secondary: "#22d3ee" }, // Cyan
    style: { strokeWidth: 3 },
    requestResponse: true,
    defaultForNodes: ["loadbalancer"],
  },
  // ═══════════════════════════════════════════════════════════
  // MESSAGING PROTOCOLS
  // ═══════════════════════════════════════════════════════════
  amqp: {
    label: "AMQP",
    group: "messaging",
    color: { primary: "#f59e0b", secondary: "#fbbf24" }, // Amber
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: false,
  },
  rabbitmq: {
    label: "RabbitMQ",
    group: "messaging",
    color: { primary: "#f59e0b", secondary: "#fbbf24" }, // Amber (same as AMQP)
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: false,
    defaultForNodes: ["queue"],
  },
  kafka: {
    label: "Kafka",
    group: "messaging",
    color: { primary: "#ef4444", secondary: "#f87171" }, // Red
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: false,
  },
  eventbridge: {
    label: "EventBridge",
    group: "messaging",
    color: { primary: "#f97316", secondary: "#fb923c" }, // Orange
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: false,
    defaultForNodes: ["eventbus"],
  },
  sns: {
    label: "SNS/Push",
    group: "messaging",
    color: { primary: "#f43f5e", secondary: "#fb7185" }, // Rose
    style: { strokeDasharray: "2 4", animated: true },
    requestResponse: false,
    defaultForNodes: ["notification"],
  },
  // ═══════════════════════════════════════════════════════════
  // DATA PROTOCOLS
  // ═══════════════════════════════════════════════════════════
  sql: {
    label: "SQL/Database",
    group: "data",
    color: { primary: "#eab308", secondary: "#facc15" }, // Yellow
    style: { strokeWidth: 2 },
    requestResponse: true,
    defaultForNodes: ["database"],
  },
  redis: {
    label: "Redis",
    group: "data",
    color: { primary: "#dc2626", secondary: "#f87171" }, // Red
    style: { strokeDasharray: "2 2" },
    requestResponse: true,
    defaultForNodes: ["cache"],
  },
  s3: {
    label: "S3/Blob",
    group: "data",
    color: { primary: "#10b981", secondary: "#34d399" }, // Emerald
    style: { strokeWidth: 2 },
    requestResponse: true,
    defaultForNodes: ["storage", "datalake"],
  },
  vector: {
    label: "Vector Search",
    group: "data",
    color: { primary: "#14b8a6", secondary: "#2dd4bf" }, // Teal
    style: { strokeDasharray: "4 2" },
    requestResponse: true,
    defaultForNodes: ["vectordb"],
  },
  search: {
    label: "Search",
    group: "data",
    color: { primary: "#d97706", secondary: "#fbbf24" }, // Amber
    style: { strokeDasharray: "4 2" },
    requestResponse: true,
    defaultForNodes: ["search"],
  },
  // ═══════════════════════════════════════════════════════════
  // AUTH & DNS PROTOCOLS
  // ═══════════════════════════════════════════════════════════
  oauth: {
    label: "OAuth/OIDC",
    group: "auth",
    color: { primary: "#8b5cf6", secondary: "#a78bfa" }, // Violet
    style: { strokeDasharray: "5 3" },
    requestResponse: true,
    defaultForNodes: ["auth"],
  },
  dns: {
    label: "DNS",
    group: "auth",
    color: { primary: "#84cc16", secondary: "#a3e635" }, // Lime
    style: { strokeDasharray: "5 3" },
    requestResponse: true,
    defaultForNodes: ["dns", "cdn"],
  },
  // ═══════════════════════════════════════════════════════════
  // AI/ML PROTOCOLS
  // ═══════════════════════════════════════════════════════════
  inference: {
    label: "AI Inference",
    group: "aiml",
    color: { primary: "#d946ef", secondary: "#e879f9" }, // Fuchsia
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: true,
    defaultForNodes: ["llm", "embedding", "mlpipeline"],
  },
};

// Helper function to get default protocol for a node type
export const getDefaultProtocolForNode = (nodeType: string): EdgeProtocol => {
  for (const [protocol, config] of Object.entries(PROTOCOL_CONFIG)) {
    if (config.defaultForNodes?.includes(nodeType)) {
      return protocol as EdgeProtocol;
    }
  }
  return "http";
};

// Local storage key for diagram persistence
export const STORAGE_KEY = "architecture-diagram-data";

// Debounce time for auto-save (ms)
export const AUTO_SAVE_DEBOUNCE = 1000;

// Max history states for undo/redo
export const MAX_HISTORY_LENGTH = 50;

// Group type configuration
export const GROUP_TYPES_CONFIG: Record<
  GroupNodeType,
  {
    label: string;
    description: string;
    icon: typeof CloudIcon;
    defaultLabel: string;
  }
> = {
  vpc: {
    label: "VPC",
    description: "Virtual Private Cloud",
    icon: CloudIcon,
    defaultLabel: "VPC",
  },
  cluster: {
    label: "Cluster",
    description: "Service Cluster",
    icon: ServerStackIcon,
    defaultLabel: "Cluster",
  },
  region: {
    label: "Region",
    description: "Cloud Region",
    icon: GlobeAmericasIcon,
    defaultLabel: "Region",
  },
  subnet: {
    label: "Subnet",
    description: "Network Subnet",
    icon: RectangleGroupIcon,
    defaultLabel: "Subnet",
  },
};

// Data format configuration for edge data contracts
export const DATA_FORMATS = {
  json: {
    label: "JSON",
    description: "JavaScript Object Notation",
    placeholder: '{\n  "id": "string",\n  "name": "string"\n}',
  },
  protobuf: {
    label: "Protocol Buffers",
    description: "Google Protocol Buffers",
    placeholder: 'syntax = "proto3";\n\nmessage User {\n  string id = 1;\n  string name = 2;\n}',
  },
  avro: {
    label: "Apache Avro",
    description: "Apache Avro Schema",
    placeholder:
      '{\n  "type": "record",\n  "name": "User",\n  "fields": [\n    {"name": "id", "type": "string"}\n  ]\n}',
  },
  xml: {
    label: "XML",
    description: "Extensible Markup Language",
    placeholder: "<User>\n  <id>string</id>\n  <name>string</name>\n</User>",
  },
  binary: {
    label: "Binary",
    description: "Binary data format",
    placeholder: "Binary format specification...",
  },
  text: {
    label: "Plain Text",
    description: "Plain text format",
    placeholder: "Text format description...",
  },
} as const;

// Comment/annotation configuration
export const COMMENT_CONFIG = {
  label: "Comment",
  description: "Add a note or annotation",
  icon: ChatBubbleBottomCenterTextIcon,
  colors: {
    yellow: {
      bg: "bg-yellow-50 dark:bg-yellow-950/30",
      border: "border-yellow-300 dark:border-yellow-700",
      text: "text-yellow-900 dark:text-yellow-100",
      iconBg: "bg-yellow-200 dark:bg-yellow-800",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-300 dark:border-blue-700",
      text: "text-blue-900 dark:text-blue-100",
      iconBg: "bg-blue-200 dark:bg-blue-800",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-950/30",
      border: "border-green-300 dark:border-green-700",
      text: "text-green-900 dark:text-green-100",
      iconBg: "bg-green-200 dark:bg-green-800",
    },
    pink: {
      bg: "bg-pink-50 dark:bg-pink-950/30",
      border: "border-pink-300 dark:border-pink-700",
      text: "text-pink-900 dark:text-pink-100",
      iconBg: "bg-pink-200 dark:bg-pink-800",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-300 dark:border-purple-700",
      text: "text-purple-900 dark:text-purple-100",
      iconBg: "bg-purple-200 dark:bg-purple-800",
    },
  } as Record<CommentColor, { bg: string; border: string; text: string; iconBg: string }>,
} as const;

// Health check configuration
export const HEALTH_CHECK_CONFIG = {
  timeout: 5000, // 5 seconds
  expectedStatusCodes: [200, 201, 204] as number[],
} as const;

export const HEALTH_STATUS_STYLES = {
  healthy: {
    icon: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  unhealthy: {
    icon: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
  },
  error: {
    icon: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  loading: {
    icon: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    text: "text-zinc-400",
  },
} as const;
