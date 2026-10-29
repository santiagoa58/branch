import { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import type { DiagramTemplate } from "./index";

const data = {
  nodes: [
    archNode("chat-ui", "client", "Chat UI", 0, 280, { technology: "React" }),
    archNode("gw", "gateway", "API Gateway", 230, 280, {}),
    groupNode("backend", "vpc", "AI Backend", 470, 40, 740, 520),
    archNode("history", "database", "Chat History", 300, 60, {
      parentId: "backend",
      technology: "Postgres",
    }),
    archNode("orchestrator", "service", "Chat Orchestrator", 40, 220, {
      parentId: "backend",
      technology: "Python",
    }),
    archNode("llm", "llm", "LLM", 540, 220, { parentId: "backend", technology: "Claude" }),
    archNode("embed", "embedding", "Embedding Service", 300, 380, { parentId: "backend" }),
    archNode("vec", "vectordb", "Vector Store", 540, 380, {
      parentId: "backend",
      technology: "pgvector",
    }),
  ],
  edges: [
    archEdge("e-ui-gw", "chat-ui", "gw", { protocol: "websocket", bidirectional: true }),
    archEdge("e-gw-orch", "gw", "orchestrator", {
      protocol: "http",
      method: "POST",
      dataContract: {
        format: "json",
        schemaName: "ChatRequest",
        schema: '{\n  "sessionId": "string",\n  "message": "string"\n}',
        description: "User prompt envelope",
      },
    }),
    archEdge("e-orch-history", "orchestrator", "history", {
      protocol: "sql",
      label: "session log",
    }),
    archEdge("e-orch-embed", "orchestrator", "embed", {
      protocol: "inference",
      label: "embed query",
    }),
    archEdge("e-embed-vec", "embed", "vec", { protocol: "vector", label: "similarity search" }),
    archEdge("e-orch-llm", "orchestrator", "llm", {
      protocol: "inference",
      latencyMs: 800,
      responseContract: {
        format: "json",
        schemaName: "Completion",
        schema: '{\n  "text": "string",\n  "stopReason": "string"\n}',
      },
    }),
  ],
  flows: [
    {
      id: "flow-user-prompt",
      name: "User prompt",
      description: "A chat message retrieving context and calling the model.",
      sourceNodeId: "chat-ui",
      color: "#d946ef",
      speed: 1 as const,
      createdAt: "2026-06-10T00:00:00.000Z",
    },
  ],
} as DiagramData;

export const ragChatbot: DiagramTemplate = {
  id: "rag-chatbot",
  name: "RAG chatbot",
  description:
    "Retrieval-augmented chat: an orchestrator service pulling context from a vector store via embeddings before calling the LLM.",
  category: "AI",
  highlights: ["AI/ML node types", "Inference & vector edges", "Response contract"],
  data,
};
