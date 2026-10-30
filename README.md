# 🏗️ Branch — Architecture Workspace

A visual architecture documentation platform for designing, documenting, and communicating microservice systems—capturing not just _what_ components exist, but _how data flows_ between them.

Built with React 19, React Flow, GSAP, Clerk authentication, and managed PostgreSQL. One repository deploys the Vite frontend and TypeScript Vercel Functions together. Saved projects and diagrams live in the database.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![React Flow](https://img.shields.io/badge/React%20Flow-12-green) ![GSAP](https://img.shields.io/badge/GSAP-3.15-green) ![Vercel](https://img.shields.io/badge/Vercel-Functions-black) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-green)

## 🎯 Use Cases

- **📋 Onboarding** — New developers understand system architecture visually
- **📝 API Documentation** — Data contracts live alongside the diagram
- **🔍 System Review** — Trace data flow through services
- **📐 Architecture Design** — Plan new features with clear integration points
- **🧪 Resilience Testing** — Simulate failures and chaos scenarios to validate architecture

## ✨ Features

### Core Diagramming

- **Drag & Drop Interface** — Add components from the palette to the canvas
- **20+ Node Types** — Services, databases, queues, caches, gateways, storage, clients, and more
- **Cloud Infrastructure** — Lambda, Load Balancer, CDN, Auth Provider, Container, DNS
- **AI/ML Components** — LLM, Vector DB, ML Pipeline, Embedding
- **Cloud Services** — Secrets Manager, Event Bus, Data Lake, Search, Notifications
- **Group Containers** — Organize with VPCs, Clusters, Regions, and Subnets
- **Auto format** — One click arranges components using their actual dimensions, fits nested groups around their contents, respects connections across groups, and packs disconnected sections. The result fits in view and can be undone in one step.

### Data Flow & Contracts

- **17 Protocol Types** — HTTP, gRPC, GraphQL, WebSocket, TCP, and messaging protocols
- **Messaging Protocols** — AMQP, RabbitMQ, Kafka, EventBridge, SNS
- **Data Protocols** — SQL, Redis, S3/Blob, Vector Search, Search
- **Auth & DNS** — OAuth/OIDC, DNS protocols
- **AI/ML Protocols** — AI Inference with animated connections
- **Data Contracts** — Define JSON, Protobuf, Avro, XML schemas directly on edges
- **Animated Flow** — GSAP-powered protocol-colored flowing animations with MotionPathPlugin
- **Schema Labels** — Edge labels show protocol + schema name (e.g., `AMQP • TaskCreatedEvent`)

### Simulation Mode (GSAP-Powered)

- **Flow Simulation** — Animated packet traces data flow from a source node through the architecture
  - BFS/DFS path tracing with branching support (parallel packets at fork points)
  - Latency-proportional animation speed per edge
  - Step-by-step debugger mode (forward/backward)
  - Round-trip animation (request → response)
  - Real-time stats: total hops, protocols used, path length, total latency, bottleneck detection
  - **Sequence-diagram export** — generate a Mermaid `sequenceDiagram` from the traced path (sync vs. async arrows, protocol/method/schema/latency labels); copy, download as Markdown, or open in mermaid.live
- **Failure Simulation** — Mark nodes as failed and visualize cascading impact
  - Click nodes to toggle failure state (red pulsing glow)
  - Automatic blast radius computation (BFS downstream)
  - Domino-effect cascade animation (level-by-level ripple)
  - Affected nodes dimmed with grayscale; broken edges turn red
  - Stats: failed count, affected count, impact percentage, broken edges
- **Chaos Engineering Mode** — Automated resilience testing
  - **Random Failure** — Probability-weighted random node failures with configurable max per round
  - **Network Partition** — Severs ~30-50% of edges using Union-Find to split the graph into partitions
  - Protected nodes (click to toggle, cyan "P" badge) are immune to chaos
  - Configurable interval (1s–10s), failure probability, and max failures per round
  - Scrollable event log with color-coded entries (failures, cascades, partitions, recoveries)
  - Stats: rounds, total failures, MTBF, severed edges
- **Floating Control Panel** — Bottom-center overlay with mode selector, playback controls, speed (0.25x–4x)
- **Non-destructive** — Simulation state is ephemeral, not persisted or included in undo/redo

### Node Destruction Animation

- **Shatter/Explode Effect** — Deleted nodes explode into a 4×4 grid of fragments
- **Clone-and-Animate** — Captures node position, clones to overlay, removes from state, then animates fragments flying outward with staggered rotation/scale/opacity
- **Connected edges** fade out simultaneously during the shatter animation

### AI Integration (OpenAI)

- **Architecture Analysis** — AI-powered review with scoring and recommendations
- **Connection Suggestions** — Smart protocol recommendations based on node types
- **Documentation Generation** — Auto-generate Markdown documentation
- **Secure Key Storage** — API keys stored locally, never sent to servers
- **Settings Panel** — Configure provider, model, and test connections

### Cloud Workspace

- **Private projects and diagrams** — Sign in with Clerk and organize diagrams into projects.
- **Direct diagram access** — Home lists diagrams grouped by project in one request. Search across the workspace and open any diagram directly, without visiting a project page.
- **Cloud auto-save** — Loading, unsaved, saving, saved, failure, and conflict states are visible.
- **Version history** — Capture saved snapshots, preview them, and restore them with revision checks.
- **Ownership enforcement** — Every project, diagram, thumbnail and version API operation verifies access server-side.
- **Private links** — Copied links open your cloud document after sign-in. They do not grant another account access.
- **One deployment** — Vite SPA + Node.js Vercel Function + Neon PostgreSQL; no persistent backend process.

### Productivity

- **Multi-Select** — Box selection and Shift+click for multiple items
- **Copy/Paste** — Full clipboard support with Cmd+C/V
- **Collapsible Groups** — Hide/show group contents for cleaner views
- **Group Layer Order** — Right-click a group to bring it to front or send it to back when groups overlap
- **Export Options** — PNG, SVG, JSON, Markdown, PDF + export selected only
- **Import/Export** — Smart import with validation, supports JSON and Markdown formats
- **Import Modes** — Replace, merge, or append diagrams with conflict resolution
- **Auto-Save** — Serializes cloud writes with optimistic revision checks
- **Undo/Redo** — Full history support
- **Getting-Started Checklist** — A dismissible onboarding card that ticks off your first node, connection, data contract, and flow simulation as you do them (auto-hidden once complete; skipped for diagrams that already have content)
- **Dark/Light Mode** — Theme toggle with system preference support

The app opens at sign-in and then the workspace dashboard, with projects and their diagrams listed together. The header remains visible while the list loads, and cached lists refresh in the background on return from the editor. Existing project URLs still work as optional focused views. Authentication is required; guest editing is not enabled.

## 🚀 Quick Start

### Prerequisites

- Node.js 24.18.1 (see `.node-version`; Vite+ also supports Node.js 22.18+ and 26+)
- pnpm 11.25.0 (pinned by `packageManager`)

### Initial setup

1. Create a [Neon project](https://neon.com/docs/get-started/signing-up). Use the pooled connection string for runtime requests. Preserve the SSL parameters Neon supplies. Use an isolated Neon branch for development and each preview environment; production uses its own branch.
2. Create a [Clerk application](https://clerk.com/docs/react/getting-started/quickstart). Enable the sign-in methods you want in Clerk. Copy its publishable and secret keys. Development uses Clerk test keys; production uses the production instance and its domain/DNS setup. The publishable and secret keys must refer to the same Clerk instance.
3. Install dependencies and copy the environment template:

   ```bash
   pnpm install --frozen-lockfile
   cp .env.example .env.local
   ```

4. Edit `.env.local` with your actual connection strings, Clerk keys and exact allowed frontend origins. Never commit this file. Only `VITE_CLERK_PUBLISHABLE_KEY` is exposed to the browser; `CLERK_SECRET_KEY` and `DATABASE_URL` stay server-side. AI provider keys remain client-side preferences and are never sent to this backend.
5. For a new, empty database, run `migrations/001_workspace.sql` through the Neon SQL Editor or a trusted PostgreSQL client to create the application tables and indexes. This initializes the schema; it does not migrate legacy data. Skip this step if the tables already exist—do not rerun the file against an initialized database. Schema setup never runs during builds or API requests.

### Local development

```bash
pnpm dev
```

Open **http://localhost:3000**. This single command runs the complete app: the Vite+ frontend and the same-repository API functions through the Vercel runtime. It loads `.env.local` into the API process and fetches the current Vercel CLI on demand rather than adding its deployment-tool dependency tree to the application. Vercel runs locally without linking an account and starts Vite internally; do not open Vite's internal port directly, because it does not serve the API. There is no standalone NestJS service or local document fallback.

If an older frontend-only server is still running on port 5173, stop it and restart with `pnpm dev`. The former `dev:cloud` command has been replaced by `pnpm dev`.

Configure Clerk development origins for `http://localhost:3000`, and set `CLERK_AUTHORIZED_PARTIES=http://localhost:3000`. If testing a frontend at another origin, authorize that exact origin and supply a same-origin API; no cross-origin API URL is built into the app.

### Production and preview deployment

1. Import this Git repository as **one Vercel project**. Use the **Vite** preset, repository root, Node.js **24.x**, install command `pnpm install --frozen-lockfile`, build command `pnpm build`, and output directory `dist`.
2. Set the following variables in Vercel's appropriate Production and Preview environments:

   | Variable                     | Purpose                                                  |
   | ---------------------------- | -------------------------------------------------------- |
   | `VITE_CLERK_PUBLISHABLE_KEY` | Public browser key; required at build time               |
   | `CLERK_SECRET_KEY`           | Secret Clerk server key                                  |
   | `CLERK_AUTHORIZED_PARTIES`   | Comma-separated exact frontend origins, including scheme |
   | `DATABASE_URL`               | Neon pooled connection string for that environment       |

   For preview deployments, use Clerk development keys and an isolated Neon branch. Configure Clerk to accept the preview frontend domain, set its exact origin in `CLERK_AUTHORIZED_PARTIES`, and redeploy after changing variables. A stable preview alias avoids maintaining an allowlist of changing deployment URLs. Production uses Clerk production keys and the configured production domain. Do not use wildcard origins or production database credentials for untrusted preview branches.

3. Confirm the target database has the application tables. For a new, empty database only, initialize it with `migrations/001_workspace.sql` through the Neon SQL Editor or a trusted PostgreSQL client. Review and apply any future schema changes explicitly, testing on an isolated Neon branch first.
4. Deploy with Vercel's Git integration or `pnpm dlx vercel@latest --prod`. `vercel.json` sends `/api/*` to the catch-all Node.js function and rewrites SPA deep links to `index.html`; API errors remain JSON responses.
5. Smoke-test with two accounts: sign in, create a project and diagram, edit and reload, create/restore a version, and verify a second account cannot open the first account's copied diagram URL. Test a stale save from two tabs and a failed network save before using production data.

Clerk and Neon must be configured before live use. Local setup can use Clerk development keys; public production deployment requires Clerk's production instance, the deployed origin, and server environment variables in Vercel. See the setup steps above before deploying.

### Save behavior and recovery

The database is authoritative. Hydration does not save or add an edit history entry. The editor captures edits with the active diagram ID, debounces them, and runs one save at a time. Every write uses the last known `expectedRevision`; stale writes return HTTP 409. Version creation first flushes edits and snapshots the expected saved revision under a database lock. Restore flushes edits, locks editing for the operation, then hydrates the new cloud revision.

Navigation flushes pending edits. If saving fails, navigation stays blocked and the canvas remains available. Retry the save, or export JSON and explicitly discard before leaving. If a session expires, pending edits remain in memory and are recoverable after signing back into the same account. Account changes clear private clipboard and document state. Browser refresh/close warns while edits are pending; closing anyway loses unsaved memory. Conflicts never retry over newer cloud data: export your edits, explicitly reload, then use Import if you want to apply them. There is no automatic merge or offline synchronization. Requests are bounded to 4 MB (including thumbnail/data JSON); larger documents fail visibly and remain exportable.

Import remains an explicit editor action that edits the active cloud document and schedules a save. URL parameters never implicitly load a document snapshot. Theme, panel preferences, onboarding progress and AI provider settings remain browser preferences; AI analysis caches now stay in memory.

### Validate and build

```bash
pnpm audit
pnpm check
pnpm test:run
pnpm test:coverage
pnpm build
pnpm preview
```

The API tests apply the real migration to an embedded PostgreSQL-compatible engine and exercise ownership, CRUD, revision conflicts, and snapshots/restoration. Live Clerk/Neon/Vercel smoke tests require the external setup above. `pnpm preview` serves the built frontend only.

## ⌨️ Keyboard Shortcuts

| Shortcut             | Action                                   |
| -------------------- | ---------------------------------------- |
| `V`                  | Select mode                              |
| `H`                  | Pan mode                                 |
| `Cmd/Ctrl + C`       | Copy selected                            |
| `Cmd/Ctrl + V`       | Paste                                    |
| `Cmd/Ctrl + D`       | Duplicate selected                       |
| `Cmd/Ctrl + L`       | Auto format                              |
| `Delete / Backspace` | Delete selected (with shatter animation) |
| `Cmd/Ctrl + Z`       | Undo                                     |
| `Cmd/Ctrl + Y`       | Redo                                     |
| `[`                  | Toggle left panel                        |
| `]`                  | Toggle right panel                       |
| `Shift + Click`      | Add to selection                         |
| `Shift + S`          | Toggle simulation panel                  |
| `N`                  | Add a comment node                       |

## 🧩 Component Types

### Nodes

| Type                     | Description                          |
| ------------------------ | ------------------------------------ |
| **Core**                 |                                      |
| Service                  | Microservice or API component        |
| Database                 | SQL/NoSQL data storage               |
| Queue                    | Message queue (RabbitMQ, Kafka, SQS) |
| Cache                    | In-memory store (Redis, Memcached)   |
| Gateway                  | API Gateway                          |
| External                 | Third-party service                  |
| Storage                  | Object storage (S3, Azure Blob)      |
| Client                   | Web, mobile, or desktop app          |
| **Cloud Infrastructure** |                                      |
| Lambda                   | Serverless function                  |
| Load Balancer            | Traffic distribution                 |
| CDN                      | Edge delivery network                |
| Auth Provider            | Identity & access management         |
| Container                | Docker/Pod                           |
| DNS                      | Domain routing                       |
| **AI/ML**                |                                      |
| LLM                      | Large language model                 |
| Vector DB                | Embeddings store                     |
| ML Pipeline              | Training/inference pipeline          |
| Embedding                | Vector encoder                       |
| **Cloud Services**       |                                      |
| Secrets                  | Secrets manager                      |
| Event Bus                | Event broker                         |
| Data Lake                | Big data storage                     |
| Search                   | Search engine                        |
| Notification             | Push/alert service                   |

### Groups

| Type    | Description                      |
| ------- | -------------------------------- |
| VPC     | Virtual Private Cloud boundary   |
| Cluster | Kubernetes or container cluster  |
| Region  | Cloud provider geographic region |
| Subnet  | Network subnet                   |

### Edge Protocols

| Protocol      | Style                    | Group     |
| ------------- | ------------------------ | --------- |
| HTTP/REST     | Solid blue               | Standard  |
| gRPC          | Dashed green             | Standard  |
| GraphQL       | Solid pink               | Standard  |
| WebSocket     | Dashed purple, animated  | Standard  |
| TCP           | Thick cyan               | Standard  |
| AMQP          | Dashed amber, animated   | Messaging |
| RabbitMQ      | Dashed amber, animated   | Messaging |
| Kafka         | Dashed red, animated     | Messaging |
| EventBridge   | Dashed orange, animated  | Messaging |
| SNS/Push      | Dashed rose, animated    | Messaging |
| SQL/Database  | Solid yellow             | Data      |
| Redis         | Dashed red               | Data      |
| S3/Blob       | Solid emerald            | Data      |
| Vector Search | Dashed teal              | Data      |
| Search        | Dashed amber             | Data      |
| OAuth/OIDC    | Dashed violet            | Auth      |
| DNS           | Dashed lime              | Auth      |
| AI Inference  | Dashed fuchsia, animated | AI/ML     |

### Data Contract Formats

| Format   | Description                |
| -------- | -------------------------- |
| JSON     | JavaScript Object Notation |
| Protobuf | Google Protocol Buffers    |
| Avro     | Apache Avro Schema         |
| XML      | Extensible Markup Language |
| Binary   | Binary data format         |
| Text     | Plain text format          |

## 📦 Import and Export

Export supports JSON, PNG, SVG, PDF, and Markdown. JSON is the full-fidelity backup format and can include viewport, comments, metadata, and formatted output. Markdown is intended for human-readable documentation and includes component/connection tables and Mermaid output.

The import dialog accepts JSON and Markdown through file selection or drag-and-drop, detects the format, previews content, and validates nodes, edges, protocols, and contracts. Errors block an import; warnings can be accepted.

Import modes:

- **Replace** — replaces the current diagram; recommended for restoring a backup.
- **Merge** — remaps imported IDs and offsets nodes to avoid collisions; recommended for combining diagrams.
- **Append** — preserves original IDs and can conflict with existing content.

Markdown import reconstructs components from `## Components` and connections from `## Connections` tables, with limited support for basic Mermaid flowcharts.

## 🛠️ Tech Stack

- **React 19** — UI framework
- **TypeScript 5** — Type safety
- **@xyflow/react 12** — Diagram library (React Flow)
- **Zustand 5** — State management
- **Tailwind CSS v4** — Styling
- **GSAP 3.15** — Animation engine (MotionPathPlugin for simulation)
- **React Router 7** — Client-side routing
- **TanStack React Query 5** — Server state management
- **Vite+** — Project-local unified toolchain for Vite, Vitest, Oxlint, and Oxfmt
- **Vitest** — Unit testing with V8 coverage
- **OpenAI SDK** — AI integration (client-side)
- **html-to-image** — Export functionality
- **jsPDF** — PDF generation

## 📁 Project Structure

```text
api/[...path].ts          Vercel Function entry point
server/                  Clerk verification, REST handler, pooled DB and owned queries
migrations/              SQL schema used for database initialization and API tests
src/components/          Existing canvas, nodes, edges, panels and UI
src/services/api.ts      Authenticated same-origin REST client
src/services/cloudPersistence.ts  Active document and serialized revision-checked saves
src/store/               Editor and preference stores
src/schemas/             Shared Zod trust boundaries
```

## 🧭 Development Conventions

- Node, protocol, edge-style, and group configuration is centralized in `src/constants/index.ts`; matching unions live in `src/types/index.ts`.
- Save Zustand history before user-initiated diagram changes, persist through the store APIs, and never mutate store state directly. Simulation state is ephemeral and must not enter persistence or undo/redo.
- Route user-initiated deletion through `animationStore.requestDelete()` so the shatter animation can complete.
- React Flow groups use `parentId` and `extent: 'parent'`; parents must precede children in node arrays, and child positions are relative to the parent.
- Import GSAP only through `src/lib/gsap.ts`, use `useGSAP()` for cleanup, and target React Flow elements through `data-node-id`/`data-edge-id`. Apply simulation speed with `timeline.timeScale(speed)`.
- Keep graph algorithms in `src/utils/graphTraversal.ts` pure.
- AI providers implement `AIProvider`. API keys remain client-side and must be checked before requests.
- Treat API payloads, imported files, API routes, AI responses, and browser storage as untrusted. Validate them with Zod schemas in `src/schemas/`; do not rely on type assertions or handwritten structural validators.
- Use zinc for structural UI and reserve other colors for semantic states. Reuse CSS variables from `src/index.css` and the `cn()` helper from `src/lib/utils.ts`.
- Use `src/services/notify.ts` for notifications rather than importing Sileo in feature components. Keep one top-right `Toaster` in `src/App.tsx`; do not add notification state to Zustand.

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Make focused changes that follow the conventions above.
4. Run `pnpm audit`, `pnpm check`, `pnpm test:run`, `pnpm test:coverage`, and `pnpm build`.
5. Commit and push your changes, then open a pull request.

## 📄 License and Branding

Branch is independently developed and maintained by Santiago Gomez under the included [MIT License](LICENSE). It contains MIT-licensed code originally authored by Sergio-Al; the original copyright notice is retained in `LICENSE` as required.

No proprietary visual assets from the earlier project are included. `public/branch-mark.svg` is original Branch artwork distributed under this project's MIT license. Heroicons are MIT-licensed and Lucide is ISC-licensed. Review the license of any new artwork or icon collection before redistribution.

---

Made with ❤️ using React and React Flow
