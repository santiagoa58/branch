# 🏗️ Branch — Architecture Workspace

A visual architecture documentation platform for designing, documenting, and communicating microservice systems—capturing not just _what_ components exist, but _how data flows_ between them.

Built with React 19, React Flow, GSAP, and an optional NestJS backend for multi-project workspace management and real-time collaboration. The default local mode works entirely in the browser.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![React Flow](https://img.shields.io/badge/React%20Flow-12-green) ![GSAP](https://img.shields.io/badge/GSAP-3.15-green) ![NestJS](https://img.shields.io/badge/NestJS-11-red) ![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-purple)

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
- **Auto-Layout** — Dagre.js automatic arrangement (Top-to-Bottom, Left-to-Right)

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

### Real-time Collaboration

- **Live Cursors** — See other users' cursor positions on the canvas in real time
- **User Presence** — Colored avatar badges in the navbar show who's online
- **Name Entry** — Users choose a display name when joining (saved to localStorage)
- **Diagram Sync** — Node and edge changes broadcast instantly to all connected users
- **Viewport-independent Cursors** — Cursor positions use flow-space coordinates, so they appear at the correct diagram position regardless of each user's pan/zoom
- **Socket.IO + NestJS Gateway** — WebSocket-based transport with room-per-diagram

### Multi-Project Workspace

- **Projects & Diagrams** — Organize diagrams into projects with color-coded cards
- **REST API** — Full CRUD backed by NestJS + PostgreSQL
- **Breadcrumb Navigation** — Projects › Project Name › Diagram Name in the navbar
- **React Router** — Client-side routing (`/`, `/projects/:id`, `/projects/:id/diagrams/:id`)
- **TanStack React Query** — Server state management with caching

### Productivity

- **Multi-Select** — Box selection and Shift+click for multiple items
- **Copy/Paste** — Full clipboard support with Cmd+C/V
- **Collapsible Groups** — Hide/show group contents for cleaner views
- **Group Layer Order** — Right-click a group to bring it to front or send it to back when groups overlap
- **Export Options** — PNG, SVG, JSON, Markdown, PDF + export selected only
- **Import/Export** — Smart import with validation, supports JSON and Markdown formats
- **Import Modes** — Replace, merge, or append diagrams with conflict resolution
- **Auto-Save** — Persists to localStorage automatically
- **Undo/Redo** — Full history support
- **Getting-Started Checklist** — A dismissible onboarding card that ticks off your first node, connection, data contract, and flow simulation as you do them (auto-hidden once complete; skipped for diagrams that already have content)
- **Dark/Light Mode** — Theme toggle with system preference support

## 🚀 Quick Start

### Prerequisites

- Node.js 24.18.1 (see `.node-version`; Vite+ also supports Node.js 22.18+ and 26+)
- pnpm 11.25.0 (pinned by `packageManager`)

Local mode requires no API server, database, cloud account, or AI key. The [architecture-diagram-api](../architecture-diagram-api) backend and Docker/PostgreSQL are only required for server-mode projects, diagrams, and collaboration.

### Backend Setup (server mode only)

```bash
# From the API repo
cd architecture-diagram-api

# Start PostgreSQL
docker compose up -d

# Install dependencies & start
npm install
npm run start:dev
```

The API will be available at `http://localhost:3000`

### Frontend Setup

```bash
# From this repo
cd branch

# Install dependencies
pnpm install --frozen-lockfile

# Start development server
pnpm dev
```

The landing page will be available at `http://localhost:5173`; the standalone local editor is at `http://localhost:5173/app`.

### Environment Variables

Create a `.env` file (optional — defaults work for local development):

```env
VITE_APP_MODE=local
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_COLLAB=true
```

Mode notes:

- `VITE_APP_MODE=local` runs the standalone editor at `/app` and keeps persistence local-first.
- `VITE_APP_MODE=server` enables workspace routing (`/`, `/projects/:id`, `/projects/:id/diagrams/:id`) with API-backed data.
- `VITE_ENABLE_COLLAB=false` disables realtime collaboration sockets even in server mode.
- Runtime interpretation belongs in `src/config/runtime.ts`. API access must be guarded by `IS_SERVER_MODE`; sockets must be guarded by `ENABLE_COLLAB`. Keep safe local persistence enabled in both modes.

### Validate and Build

```bash
pnpm audit
pnpm check
pnpm test:run
pnpm test:coverage
pnpm build
pnpm preview
```

## ⌨️ Keyboard Shortcuts

| Shortcut             | Action                                   |
| -------------------- | ---------------------------------------- |
| `V`                  | Select mode                              |
| `H`                  | Pan mode                                 |
| `Cmd/Ctrl + C`       | Copy selected                            |
| `Cmd/Ctrl + V`       | Paste                                    |
| `Cmd/Ctrl + D`       | Duplicate selected                       |
| `Cmd/Ctrl + L`       | Auto-layout                              |
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
- **Socket.IO Client** — Real-time collaboration transport
- **Yjs** — CRDT for conflict-free collaborative editing
- **Vite+** — Project-local unified toolchain for Vite, Vitest, Oxlint, and Oxfmt
- **Vitest** — Unit testing with V8 coverage
- **OpenAI SDK** — AI integration (client-side)
- **html-to-image** — Export functionality
- **jsPDF** — PDF generation

## 📁 Project Structure

```
src/
├── components/
│   ├── nodes/           # Custom node components (ArchitectureNode, GroupNode, CommentNode)
│   ├── edges/           # Custom edge components (GSAP-animated ArchitectureEdge)
│   ├── panels/          # Sidebar & overlay panels
│   │   ├── NodePalette.tsx        # Draggable node palette
│   │   ├── PropertiesPanel.tsx    # Node/edge property editor
│   │   ├── SettingsPanel.tsx      # AI configuration
│   │   ├── SimulationPanel.tsx    # Floating simulation control bar
│   │   ├── SimulationStats.tsx    # Real-time simulation metrics overlay
│   │   ├── ChaosEventLog.tsx      # Chaos mode event timeline
│   │   └── ShortcutsHelp.tsx      # Keyboard shortcuts modal
│   └── ui/              # Reusable UI components
│       ├── ImportDialog.tsx       # Diagram import modal
│       ├── JoinDiagramDialog.tsx  # Collaboration name entry dialog
│       ├── CollaboratorBadges.tsx # Online user avatar badges
│       ├── CollaboratorCursors.tsx # Remote cursor SVG overlay
│       └── ...
├── hooks/
│   ├── useCollaboration.ts        # Socket.IO collaboration (cursors, sync, presence)
│   ├── useEdgeAnimation.ts        # GSAP edge flow animation
│   ├── useSimulationAnimation.ts  # GSAP simulation orchestration (flow + failure)
│   ├── useChaosSimulation.ts      # Chaos engineering interval engine
│   ├── useDestroyAnimation.ts     # GSAP shatter/explode for node deletion
│   └── useDragEvent.ts            # Palette drag-and-drop handler
├── pages/
│   ├── ProjectsPage.tsx     # Project cards grid (/)
│   └── ProjectPage.tsx      # Diagram cards for a project (/projects/:id)
├── services/
│   ├── api.ts           # Typed fetch wrapper for backend API
│   ├── notify.ts        # App-facing Sileo notification wrapper
│   └── ai/              # AI provider integrations
│       └── providers/   # OpenAI provider implementation
├── store/
│   ├── diagramStore.ts      # Nodes, edges, clipboard, undo/redo
│   ├── workspaceStore.ts    # Current project/diagram context
│   ├── simulationStore.ts   # Simulation state (flow, failure, chaos)
│   ├── animationStore.ts    # Pending deletion animation orchestration
│   ├── uiStore.ts           # Panel visibility and UI state
│   ├── themeStore.ts        # Dark/light/system theme
│   └── aiStore.ts           # AI provider settings & cache
├── types/
│   ├── index.ts         # Core diagram types
│   ├── simulation.ts    # Simulation & chaos types
│   └── ai.ts            # AI provider types
├── schemas/             # Zod contracts for API, persistence, imports, and external data
├── lib/
│   ├── gsap.ts          # GSAP initialization & plugin registration
│   └── utils.ts         # Utility functions (cn helper)
├── utils/
│   ├── graphTraversal.ts    # BFS path tracing, blast radius, partition (Union-Find)
│   ├── export.ts            # Export utilities
│   ├── import.ts            # Import utilities
│   └── layout.ts            # Auto-layout algorithms
└── constants/           # Configuration constants
```

## 🧭 Development Conventions

- Node, protocol, edge-style, and group configuration is centralized in `src/constants/index.ts`; matching unions live in `src/types/index.ts`.
- Save Zustand history before user-initiated diagram changes, persist through the store APIs, and never mutate store state directly. Simulation state is ephemeral and must not enter persistence or undo/redo.
- Route user-initiated deletion through `animationStore.requestDelete()` so the shatter animation can complete.
- React Flow groups use `parentId` and `extent: 'parent'`; parents must precede children in node arrays, and child positions are relative to the parent.
- Import GSAP only through `src/lib/gsap.ts`, use `useGSAP()` for cleanup, and target React Flow elements through `data-node-id`/`data-edge-id`. Apply simulation speed with `timeline.timeScale(speed)`.
- Keep graph algorithms in `src/utils/graphTraversal.ts` pure.
- AI providers implement `AIProvider`. API keys remain client-side and must be checked before requests.
- Treat API payloads, imported files, share URLs, collaboration messages, AI responses, and browser storage as untrusted. Validate them with Zod schemas in `src/schemas/`; do not rely on type assertions or handwritten structural validators.
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
