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
  UserCircleIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  CodeBracketIcon,
  LockClosedIcon,
  ClockIcon,
  Square2StackIcon,
  TableCellsIcon,
  WindowIcon,
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

// Complete, statically declared color presets; node types pick one so Tailwind discovers every class.
const NODE_STYLE_PRESETS = {
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

function catalogNode(
  preset: keyof typeof NODE_STYLE_PRESETS,
  label: string,
  description: string,
  icon: NodeTypeConfig["icon"],
  keywords: readonly string[],
): NodeTypeConfig {
  return { ...NODE_STYLE_PRESETS[preset], label, description, icon, keywords };
}

/**
 * Every node type is a role, not a product: put the technology (Postgres, Kafka, Stripe) in the
 * label or icon. Descriptions say when to use the type so similar roles stay distinguishable.
 */
export const NODE_TYPES_CONFIG: Record<ArchitectureNodeType, NodeTypeConfig> = {
  // Clients and people
  user: catalogNode("client", "User", "A person or role using the system", UserCircleIcon, [
    "person",
    "actor",
    "customer",
    "admin",
  ]),
  webapp: catalogNode(
    "client",
    "Web App",
    "Browser app: SPA, server-rendered or static site",
    GlobeAltIcon,
    ["frontend", "browser", "spa", "ssr", "website"],
  ),
  mobileapp: catalogNode(
    "client",
    "Mobile App",
    "Native or cross-platform phone app",
    DevicePhoneMobileIcon,
    ["frontend", "ios", "android", "react native"],
  ),
  client: catalogNode(
    "client",
    "Client App",
    "Desktop, CLI, game or other non-browser client",
    ComputerDesktopIcon,
    ["desktop", "cli", "game client", "electron"],
  ),
  iot: catalogNode(
    "external",
    "Device",
    "IoT sensor, smart device or embedded hardware",
    SignalIcon,
    ["iot", "sensor", "edge", "hardware"],
  ),
  // Inside a frontend app (in-process, not network hops)
  component: catalogNode(
    "client",
    "UI Component",
    "A piece of UI inside an app, such as a list or editor",
    CubeIcon,
    ["frontend", "ui", "widget", "design system"],
  ),
  statestore: catalogNode(
    "cache",
    "Client State",
    "In-memory state shared across the UI, such as a store or query cache",
    CircleStackIcon,
    ["frontend", "state management", "redux", "zustand", "query cache"],
  ),
  clientstorage: catalogNode(
    "database",
    "Browser Storage",
    "Data kept on the device: IndexedDB, local storage, Cache API",
    ArchiveBoxIcon,
    ["frontend", "indexeddb", "localstorage", "offline", "persistence"],
  ),
  router: catalogNode(
    "gateway",
    "Client Router",
    "Maps URLs to screens inside the app",
    ArrowsRightLeftIcon,
    ["frontend", "navigation", "routes"],
  ),
  serviceworker: catalogNode(
    "client",
    "Service Worker",
    "Background script for offline use, push and caching",
    ArrowPathIcon,
    ["frontend", "offline", "pwa", "web worker"],
  ),
  sdk: catalogNode(
    "client",
    "SDK / Library",
    "Packaged code other apps embed or import",
    CodeBracketIcon,
    ["frontend", "library", "package", "component library", "embed"],
  ),
  // Edge and traffic
  dns: catalogNode("dns", "DNS", "Resolves domain names to addresses", GlobeAmericasIcon, [
    "domain",
    "routing",
    "geo dns",
  ]),
  cdn: catalogNode(
    "cdn",
    "CDN",
    "Caches static and media content close to users",
    GlobeAmericasIcon,
    ["edge", "cache", "static assets", "media delivery"],
  ),
  edgefunction: catalogNode(
    "cdn",
    "Edge Function",
    "Code that runs at CDN edge locations",
    BoltIcon,
    ["edge", "middleware", "workers", "lambda@edge"],
  ),
  loadbalancer: catalogNode(
    "loadbalancer",
    "Load Balancer",
    "Spreads traffic across instances (L4/L7, ingress)",
    ArrowsRightLeftIcon,
    ["ingress", "reverse proxy", "traffic", "l7"],
  ),
  gateway: catalogNode(
    "gateway",
    "API Gateway",
    "One entry for APIs and sockets: auth, routing and limits",
    GlobeAltIcon,
    ["api", "entrypoint", "websocket gateway", "routing"],
  ),
  bff: catalogNode(
    "service",
    "Backend for Frontend",
    "API shaped for one client app",
    ServerStackIcon,
    ["bff", "aggregation", "graphql"],
  ),
  ratelimiter: catalogNode(
    "gateway",
    "Rate Limiter",
    "Caps requests per user, key or tenant",
    ShieldCheckIcon,
    ["throttling", "quota", "admission control"],
  ),
  proxy: catalogNode(
    "loadbalancer",
    "Proxy / Relay",
    "Forwards traffic: forward or egress proxy, TURN relay",
    ArrowsRightLeftIcon,
    ["forward proxy", "egress", "turn", "relay"],
  ),
  // Compute
  service: catalogNode("service", "Service", "Runs business logic behind an API", CpuChipIcon, [
    "microservice",
    "backend",
    "api",
    "server",
  ]),
  worker: catalogNode("service", "Worker", "Processes background jobs or messages", CpuChipIcon, [
    "background",
    "job",
    "consumer",
    "async",
  ]),
  lambda: catalogNode(
    "lambda",
    "Serverless Function",
    "Runs on demand and scales to zero",
    BoltIcon,
    ["lambda", "cloud function", "faas"],
  ),
  scheduler: catalogNode("lambda", "Scheduler", "Triggers jobs on a timer or cron", ClockIcon, [
    "cron",
    "timer",
    "scheduled jobs",
  ]),
  workflow: catalogNode(
    "service",
    "Workflow Engine",
    "Durable multi-step process with retries and timeouts",
    RectangleGroupIcon,
    ["orchestration", "saga", "temporal", "state machine"],
  ),
  coordinator: catalogNode(
    "auth",
    "Coordination Service",
    "Locks, leader election, config and service discovery",
    LockClosedIcon,
    ["etcd", "zookeeper", "consul", "distributed lock", "service discovery"],
  ),
  server: catalogNode(
    "container",
    "Compute Host",
    "VM, container host or Kubernetes node pool",
    ServerStackIcon,
    ["vm", "host", "kubernetes", "container", "node pool"],
  ),
  // Messaging and events
  queue: catalogNode(
    "queue",
    "Message Queue",
    "Holds work items until a consumer takes them",
    QueueListIcon,
    ["rabbitmq", "sqs", "broker", "jobs"],
  ),
  eventbus: catalogNode(
    "eventbus",
    "Pub/Sub",
    "Fans each event out to many subscribers",
    ShareIcon,
    ["event bus", "topic", "sns", "eventbridge"],
  ),
  stream: catalogNode(
    "eventbus",
    "Event Stream",
    "Ordered, replayable log of events (Kafka, Kinesis)",
    SignalIcon,
    ["kafka", "kinesis", "log", "streaming"],
  ),
  webhook: catalogNode(
    "eventbus",
    "Webhook",
    "HTTP callback sent between systems when events happen",
    LinkIcon,
    ["callback", "http", "event"],
  ),
  notification: catalogNode(
    "notification",
    "Notification Service",
    "Sends push, email and SMS to people",
    BellAlertIcon,
    ["push", "email", "sms", "fan-out"],
  ),
  // Data and storage
  database: catalogNode(
    "database",
    "Relational Database",
    "SQL tables with transactions and joins",
    CircleStackIcon,
    ["sql", "postgres", "mysql", "rdbms"],
  ),
  nosql: catalogNode(
    "database",
    "Document / Key-Value Store",
    "Flexible records looked up by key",
    CircleStackIcon,
    ["nosql", "dynamodb", "mongodb", "cassandra", "key value"],
  ),
  cache: catalogNode("cache", "Cache", "Fast in-memory copy of hot data", BoltIcon, [
    "redis",
    "memcached",
    "in-memory",
  ]),
  storage: catalogNode(
    "storage",
    "Object Storage",
    "Files and blobs stored by key (S3, GCS)",
    ArchiveBoxIcon,
    ["s3", "blob", "files", "bucket"],
  ),
  search: catalogNode(
    "search",
    "Search Index",
    "Full-text and filtered search",
    MagnifyingGlassCircleIcon,
    ["elasticsearch", "opensearch", "full text"],
  ),
  vectordb: catalogNode(
    "vectordb",
    "Vector Database",
    "Similarity search over embeddings",
    CubeTransparentIcon,
    ["embeddings", "pgvector", "pinecone", "ann"],
  ),
  graphdb: catalogNode(
    "database",
    "Graph Database",
    "Data navigated through relationships",
    ShareIcon,
    ["graph", "neo4j", "relationships"],
  ),
  timeseries: catalogNode(
    "database",
    "Time Series Database",
    "Measurements recorded over time",
    ChartBarIcon,
    ["tsdb", "metrics", "timescale", "influx"],
  ),
  warehouse: catalogNode(
    "datalake",
    "Data Warehouse",
    "SQL analytics over large history",
    InboxStackIcon,
    ["olap", "bi", "snowflake", "bigquery"],
  ),
  datalake: catalogNode(
    "datalake",
    "Data Lake",
    "Raw and curated files for analytics",
    InboxStackIcon,
    ["lake", "parquet", "big data"],
  ),
  etl: catalogNode(
    "datalake",
    "Data Pipeline",
    "Batch or stream processing jobs (ETL, Spark, Flink)",
    ArrowPathIcon,
    ["etl", "elt", "spark", "flink", "transformation"],
  ),
  backup: catalogNode(
    "storage",
    "Backup",
    "Snapshots for restore and disaster recovery",
    ArchiveBoxIcon,
    ["restore", "snapshot", "disaster recovery"],
  ),
  // Identity and security
  auth: catalogNode("auth", "Identity & Auth", "Sign-in, tokens, SSO and permissions", KeyIcon, [
    "oauth",
    "oidc",
    "sso",
    "saml",
    "identity",
    "mfa",
  ]),
  secrets: catalogNode(
    "secrets",
    "Secrets Manager",
    "Stores keys, passwords and certificates",
    KeyIcon,
    ["vault", "kms", "credentials"],
  ),
  firewall: catalogNode(
    "auth",
    "Firewall / WAF",
    "Blocks unwanted network or HTTP traffic",
    ShieldCheckIcon,
    ["waf", "security", "network"],
  ),
  vpn: catalogNode("auth", "VPN", "Encrypted link between private networks", KeyIcon, [
    "tunnel",
    "site-to-site",
    "network",
  ]),
  // Observability
  logging: catalogNode("search", "Logs", "Collects and searches log lines", QueueListIcon, [
    "observability",
    "audit",
    "diagnostics",
  ]),
  metrics: catalogNode("search", "Metrics", "Numeric measurements and dashboards", ChartBarIcon, [
    "observability",
    "monitoring",
    "prometheus",
  ]),
  tracing: catalogNode("search", "Traces", "Follows one request across services", ShareIcon, [
    "observability",
    "spans",
    "apm",
    "opentelemetry",
  ]),
  alerting: catalogNode(
    "notification",
    "Alerting / On-call",
    "Detects problems and pages people",
    BellAlertIcon,
    ["observability", "incident", "pager"],
  ),
  // AI and machine learning
  llm: catalogNode("llm", "LLM", "Large language model, hosted API or self-run", SparklesIcon, [
    "ai",
    "gpt",
    "claude",
    "language model",
  ]),
  inference: catalogNode(
    "llm",
    "Model Serving",
    "Hosts a trained model behind an endpoint",
    BoltIcon,
    ["ai", "prediction", "serving", "ranking model"],
  ),
  embedding: catalogNode(
    "embedding",
    "Embedding Model",
    "Turns text or media into vectors",
    CubeTransparentIcon,
    ["ai", "vectors", "encoder"],
  ),
  agent: catalogNode("llm", "AI Agent", "Plans and calls tools to finish a task", SparklesIcon, [
    "ai",
    "autonomous",
    "tool calling",
  ]),
  retriever: catalogNode(
    "vectordb",
    "Retriever",
    "Finds relevant context for a model",
    MagnifyingGlassCircleIcon,
    ["ai", "rag", "retrieval"],
  ),
  reranker: catalogNode(
    "embedding",
    "Reranker",
    "Reorders retrieved results by relevance",
    ArrowsRightLeftIcon,
    ["ai", "rag", "ranking"],
  ),
  prompt: catalogNode(
    "llm",
    "Prompt Registry",
    "Versioned prompts and templates",
    ChatBubbleBottomCenterTextIcon,
    ["ai", "template", "instructions"],
  ),
  guardrail: catalogNode(
    "auth",
    "Guardrail",
    "Checks model input and output for safety",
    ShieldCheckIcon,
    ["ai", "safety", "moderation"],
  ),
  tool: catalogNode("llm", "AI Tool", "An action an agent can call", WrenchScrewdriverIcon, [
    "ai",
    "function calling",
    "mcp",
  ]),
  evaluation: catalogNode(
    "mlpipeline",
    "Evaluation",
    "Measures model quality against test sets",
    ChartBarIcon,
    ["ai", "benchmark", "evals"],
  ),
  training: catalogNode(
    "mlpipeline",
    "Training Pipeline",
    "Trains and fine-tunes models",
    ArrowPathIcon,
    ["ai", "ml pipeline", "fine tuning"],
  ),
  modelregistry: catalogNode(
    "mlpipeline",
    "Model Registry",
    "Versioned models and their promotion",
    ArchiveBoxIcon,
    ["ai", "mlops", "artifacts"],
  ),
  featurestore: catalogNode(
    "vectordb",
    "Feature Store",
    "Features shared by training and serving",
    CircleStackIcon,
    ["ai", "ml", "features"],
  ),
  gpu: catalogNode(
    "mlpipeline",
    "GPU Pool",
    "Accelerators for training and inference",
    CpuChipIcon,
    ["ai", "accelerator", "gpu"],
  ),
  // Systems you don't run
  external: catalogNode(
    "external",
    "Third-party Service",
    "A system you don't run: payments, email, maps, partners",
    CloudIcon,
    ["external", "saas", "payment", "stripe", "email provider", "partner api"],
  ),
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
    defaultForNodes: ["service", "gateway", "external", "client", "webapp", "mobileapp", "bff"],
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
  sse: {
    label: "Server-Sent Events",
    group: "standard",
    color: { primary: "#a855f7", secondary: "#c084fc" }, // Purple
    style: { strokeDasharray: "6 3", animated: true },
    requestResponse: false,
  },
  webrtc: {
    label: "WebRTC",
    group: "standard",
    color: { primary: "#0ea5e9", secondary: "#38bdf8" }, // Sky
    style: { strokeDasharray: "1 3", animated: true, strokeWidth: 2 },
    requestResponse: false,
  },
  udp: {
    label: "UDP",
    group: "standard",
    color: { primary: "#0891b2", secondary: "#22d3ee" }, // Cyan
    style: { strokeDasharray: "1 4", strokeWidth: 2 },
    requestResponse: false,
  },
  inapp: {
    label: "In-app call",
    group: "standard",
    color: { primary: "#71717a", secondary: "#a1a1aa" }, // Zinc
    style: { strokeDasharray: "2 3", strokeWidth: 1.5 },
    requestResponse: true,
    defaultForNodes: ["component", "statestore", "clientstorage", "router", "serviceworker", "sdk"],
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
  mqtt: {
    label: "MQTT",
    group: "messaging",
    color: { primary: "#22c55e", secondary: "#4ade80" }, // Green
    style: { strokeDasharray: "3 3", animated: true },
    requestResponse: false,
    defaultForNodes: ["iot"],
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
  replication: {
    label: "Replication",
    group: "data",
    color: { primary: "#64748b", secondary: "#94a3b8" }, // Slate
    style: { strokeDasharray: "8 4", animated: true },
    requestResponse: false,
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
    defaultForNodes: ["llm", "embedding", "inference", "reranker"],
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
  region: {
    label: "Region",
    description: "A geographic cloud region or data center",
    icon: GlobeAmericasIcon,
    defaultLabel: "Region",
  },
  vpc: {
    label: "Private Network",
    description: "A VPC that isolates your services from the internet",
    icon: CloudIcon,
    defaultLabel: "Private network",
  },
  subnet: {
    label: "Subnet",
    description: "A network segment inside a private network",
    icon: RectangleGroupIcon,
    defaultLabel: "Subnet",
  },
  cluster: {
    label: "Cluster",
    description: "Compute that runs services together, such as Kubernetes",
    icon: ServerStackIcon,
    defaultLabel: "Cluster",
  },
  replicaset: {
    label: "Replica Set",
    description: "Copies of the same data or service, such as a primary and replicas",
    icon: Square2StackIcon,
    defaultLabel: "Replica set",
  },
  shard: {
    label: "Shard",
    description: "One partition of the data, usually with its own replicas",
    icon: TableCellsIcon,
    defaultLabel: "Shard",
  },
  boundary: {
    label: "Trust Boundary",
    description: "Where ownership or trust changes: a team, tenant or third party",
    icon: CubeTransparentIcon,
    defaultLabel: "Trust boundary",
  },
  microfrontend: {
    label: "Microfrontend",
    description: "An independently deployed part of a frontend",
    icon: RectangleGroupIcon,
    defaultLabel: "Microfrontend",
  },
  view: {
    label: "Screen",
    description: "A page or screen inside a frontend app",
    icon: WindowIcon,
    defaultLabel: "Screen",
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
