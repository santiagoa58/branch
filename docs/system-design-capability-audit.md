# System-design capability audit (120 exercises)

This document assesses whether Branch can **represent** the design, not whether Branch implements each target application. Repository inspection only; a functioning design has not been manually constructed for each of the 120 prompts.

## Existing verified primitives

- 69 component types, configurable names, descriptions, technology names and icons
- Protocol-specific directed edges, sync/async and bidirectional controls, request and response data contracts
- VPC, cluster, region and subnet grouping; notes and tags
- Saved diagrams, versions, import/export, undo/redo, auto-layout
- BFS-derived path visualization and sequence export, failure and chaos simulation

## Critical gaps and acceptance criteria

| Priority | Primitive                                               | Why it matters                                                                                                                                                 | Acceptance criteria                                                                                                                     |
| -------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | General-purpose logical boundaries and frontend screens | Frontend #1–40 and fullstack #81–120 require page, module, application, tenant, trust and data ownership boundaries that are not necessarily VPCs              | Create, rename, nest, collapse, save, import and export arbitrary scopes; labels describe their actual meaning                          |
| P0       | Editable architecture attributes                        | Cache TTL, replicas, shard keys, concurrency, rendering, UI states and auth rules currently have no node-properties editor despite schema support for metadata | Add, edit and remove keyed attributes; display key facts on nodes; preserve via Zod and persistence                                     |
| P0       | Explicit scenario steps and decisions                   | Flows currently trace the graph with BFS; BFS order is not application execution order                                                                         | Ordered edges, conditional branches, loops and return/error paths; independent named scenarios; sequence output respects authored steps |
| P1       | UI state/transition notation                            | Autocomplete, virtual tables, offline, resumable uploads, calendar, dynamic forms and frontend caching require state machines                                  | Distinguish actions, transitions, states, loading/empty/error and events without misleading protocol labels                             |
| P1       | Interaction and transport semantics                     | SSE, WebRTC, polling, optimistic updates, streaming, retries, backpressure and saga flows have different behaviors                                             | Typed relationship semantics with visible edge labels and legend                                                                        |
| P1       | Data ownership, schema and operational information      | Backend #41–80 require partition/replication, indexes, consistency, idempotency, DLQ, retry, retention and SLOs                                                | Compact on-node facts; expanded details; guardrails and sensible editing defaults                                                       |
| P1       | Multiple views of one design                            | Complex applications #81–120 become unreadable in one graph                                                                                                    | Link overview, component, deployment, sequence and data model views without duplicating content ambiguously                             |
| P2       | Table/entity, statechart and UI-specific visual shapes  | ER models, responsive screens and collaboration data models are hard to distinguish from service boxes                                                         | Fit-purpose presentational constructs with clear relationships                                                                          |
| P2       | Guided validation and usability tests                   | Component presence does not demonstrate intuitive editor use                                                                                                   | End-to-end exercise for at least one frontend, backend, fullstack, data-intensive and real-time design                                  |

## Representative validation scenarios

- **Autocomplete search (#1):** input state, debounce, cancellation, cache, loading/empty/error, ARIA keyboard behavior and API boundary.
- **Collaborative editor (#12, #94):** local edits, CRDT/OT operations, websocket sync, reconnect, presence and conflict convergence.
- **Distributed queue (#45):** partitions, producers, consumers, offsets, acknowledgments, replay and retention.
- **Ride matching (#66, #105):** realtime location updates, geo index, matching, payments, queue and regional failure.
- **LLM routing and AI assistant (#80, #120):** request gateway, quotas, model routing, vector retrieval, streaming, tools, evaluations and observability.

### Interpretation

The catalog covers many core **components** for all three categories, but representation is not complete until state, time, semantics, operations and failure paths are legible. No assertion that all 120 cases pass should be made without authoring and validating representative complex designs.
