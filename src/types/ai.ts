import { DiagramData, EdgeProtocol } from "./index";

// AI Provider types
export type AIProviderType = "openai" | "anthropic";

export type AIModel =
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-3.5-turbo"
  | "claude-3-opus"
  | "claude-3-sonnet";

// Settings
export interface AISettings {
  provider: AIProviderType;
  apiKey: string | null;
  model: AIModel;
}

// Analysis result from AI
export interface ArchitectureAnalysis {
  summary: string;
  score: number; // 0-100
  issues: Issue[];
  recommendations: Recommendation[];
  analyzedAt: Date;
}

export type IssueSeverity = "critical" | "warning" | "info";
export type IssueCategory = "security" | "performance" | "reliability" | "scalability";

export interface Issue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  affectedNodes: string[]; // node IDs
  suggestedFix?: string;
}

export type Priority = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  effort: Effort;
}

// Connection suggestions
export interface ConnectionSuggestion {
  id: string;
  sourceId: string;
  targetId: string;
  protocol: EdgeProtocol;
  reason: string;
  confidence: number; // 0-1
  accepted?: boolean;
}

// Chat messages
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
}

// AI Provider interface
export interface AIProvider {
  name: string;
  analyzeArchitecture(diagram: DiagramData): Promise<ArchitectureAnalysis>;
  suggestConnections(diagram: DiagramData): Promise<ConnectionSuggestion[]>;
  generateDocumentation(diagram: DiagramData): Promise<string>;
  chat(messages: ChatMessage[], diagram: DiagramData): Promise<string>;
}

// Serialized diagram for AI prompts
export interface SerializedDiagram {
  nodes: {
    id: string;
    type: string;
    label: string;
    description?: string;
    technology?: string;
    port?: string;
    groupType?: string;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    protocol?: string;
    method?: string;
    description?: string;
  }[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
    protocols: Record<string, number>;
  };
}
