import type { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import { attachDecisions } from "./define";
import { decide } from "./reasoning";
import type { DiagramTemplate } from "./types";

const decisions = {
  backend: decide(
    "Private VPC for the AI backend",
    "Conversations and documents should not be reachable from outside.",
    ["Sensitive data stays private"],
    ["Model calls need controlled egress"],
    [["Public services", "More exposed endpoints"]],
    ["Everything moves to managed AI services"],
  ),
  "chat-ui": decide(
    "React chat UI with sources",
    "Streamed replies with source links let users check answers.",
    ["Users can verify answers"],
    ["Streaming adds UI complexity"],
    [["Plain answer text", "No way to check claims"]],
    ["Answers never need sources"],
  ),
  gw: decide(
    "API gateway",
    "Auth and quotas run before any costly model call.",
    ["Stops abuse early"],
    ["Must support streaming"],
    [["Orchestrator handles auth", "Mixes security with AI logic"]],
    ["The chatbot is internal only"],
  ),
  orchestrator: decide(
    "Python orchestrator",
    "It fetches permitted context first, then calls the model.",
    ["Rich AI library ecosystem"],
    ["Separate runtime from the rest of the stack"],
    [["Call the model from the client", "Exposes keys and skips permissions"]],
    ["Orchestration moves into a managed agent service"],
  ),
  history: decide(
    "PostgreSQL chat history",
    "Conversations are tenant-scoped and need stable message IDs.",
    ["Resume chats across devices"],
    ["Stores sensitive text"],
    [["Browser storage", "Lost across devices"]],
    ["Retention rules forbid storing chats"],
  ),
  embed: decide(
    "Pinned embedding model version",
    "Queries and documents must use the same model or matches break.",
    ["Consistent search quality"],
    ["Upgrading means re-embedding everything"],
    [["Always use the latest model", "Old and new vectors don't match"]],
    ["A much better model becomes available"],
  ),
  vec: decide(
    "pgvector with permission filters",
    "Semantic search runs inside Postgres, filtered by tenant and document access.",
    ["One database to run", "Permissions in the same query"],
    ["Slower than dedicated vector stores at scale"],
    [["Dedicated vector database", "Another system for a modest corpus"]],
    ["The corpus grows past what Postgres handles well"],
  ),
  llm: decide(
    "Claude with bounded context",
    "Only retrieved passages and recent turns are sent to the model.",
    ["Lower cost and less data shared"],
    ["Useful context can be left out"],
    [["Send the whole knowledge base", "Costly and leaks data"]],
    ["Context windows make retrieval unnecessary"],
  ),
};

const data = {
  nodes: attachDecisions(
    "rag-chatbot",
    [
      archNode("chat-ui", "client", "Chat UI", 0, 280),
      archNode("gw", "gateway", "API Gateway", 230, 280),
      groupNode("backend", "vpc", "AI Backend", 470, 40, 740, 520),
      archNode("history", "database", "Chat History", 300, 60, {
        parentId: "backend",
      }),
      archNode("orchestrator", "service", "Chat Orchestrator", 40, 220, {
        parentId: "backend",
      }),
      archNode("llm", "llm", "LLM", 540, 220, {
        parentId: "backend",
      }),
      archNode("embed", "embedding", "Embedding Service", 300, 380, {
        parentId: "backend",
        attributes: [{ name: "Illustrative vector size", value: "1536", unit: "dimensions" }],
      }),
      archNode("vec", "vectordb", "Vector Store", 540, 380, {
        parentId: "backend",
        attributes: [{ name: "Illustrative context retrieval limit", value: "8", unit: "chunks" }],
      }),
    ],
    decisions,
  ),
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
      description: "Illustrative simulation delay in ms; not a production measurement.",
      decision: decide(
        "Send only permitted passages and recent turns",
        "The model provider shouldn't receive unrelated documents or history.",
        ["Less data leaves our systems"],
        ["Smaller context can omit useful evidence"],
        [["Send full history every time", "Costly and overshares"]],
        ["Answers suffer from missing context"],
      ),
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
  category: "ai",
  inspiredBy: "Perplexity",
  keywords: [
    "rag",
    "chatbot",
    "support bot",
    "knowledge base",
    "embeddings",
    "vector search",
    "llm",
  ],
  highlights: ["AI/ML node types", "Inference & vector edges", "Response contract"],
  data,
};
