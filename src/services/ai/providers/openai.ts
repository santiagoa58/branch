import OpenAI from "openai";
import { AIProvider, ArchitectureAnalysis, ConnectionSuggestion, ChatMessage } from "@/types/ai";
import { DiagramData } from "@/types";
import {
  architectureAnalysisResponseSchema,
  connectionSuggestionsResponseSchema,
  completionTextResponseSchema,
} from "@/schemas/ai";
import { serializeDiagram, diagramToText } from "../diagramSerializer";

export class OpenAIProvider implements AIProvider {
  name = "OpenAI";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-4-turbo") {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Client-side usage
    });
    this.model = model;
  }

  async analyzeArchitecture(diagram: DiagramData): Promise<ArchitectureAnalysis> {
    const serialized = serializeDiagram(diagram);
    const diagramText = diagramToText(serialized);

    const systemPrompt = `You are an expert cloud architect and system designer. Review the following microservices architecture diagram and provide a comprehensive analysis.

Analyze for:
- Single points of failure
- Security vulnerabilities (missing gateways, unencrypted protocols, exposed services)
- Performance bottlenecks (missing caches, synchronous dependencies)
- Scalability concerns (stateful services, database dependencies)
- Reliability issues (missing redundancy, lack of circuit breakers)
- Best practices violations

Return your analysis as JSON with this exact structure:
{
  "summary": "Brief 2-3 sentence overview of the architecture",
  "score": <number 0-100>,
  "issues": [
    {
      "id": "unique-id",
      "severity": "critical" | "warning" | "info",
      "category": "security" | "performance" | "reliability" | "scalability",
      "title": "Short issue title",
      "description": "Detailed description",
      "affectedNodes": ["node-id-1", "node-id-2"],
      "suggestedFix": "How to fix this issue"
    }
  ],
  "recommendations": [
    {
      "id": "unique-id",
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "priority": "high" | "medium" | "low",
      "effort": "low" | "medium" | "high"
    }
  ]
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: diagramText },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = completionTextResponseSchema.parse(response);

      return architectureAnalysisResponseSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw Object.assign(
        new Error(error instanceof Error ? error.message : "Failed to analyze architecture"),
        { cause: error },
      );
    }
  }

  async suggestConnections(diagram: DiagramData): Promise<ConnectionSuggestion[]> {
    const serialized = serializeDiagram(diagram);
    const diagramText = diagramToText(serialized);

    const systemPrompt = `You are an expert system architect. Analyze this architecture diagram and suggest missing connections based on common patterns.

Look for:
- Services without database connections
- API gateways not connected to services
- Services that could benefit from caching
- Services that should use message queues for async operations
- Missing load balancer connections
- External services that should go through a gateway

Return a JSON object with this exact structure:
{"suggestions": [
  {
    "id": "unique-id",
    "sourceId": "node-id",
    "targetId": "node-id",
    "protocol": "http" | "https" | "grpc" | "tcp" | "amqp" | "kafka",
    "reason": "Why this connection makes sense",
    "confidence": 0.0-1.0
  }
]}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: diagramText },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const content = completionTextResponseSchema.parse(response);

      return connectionSuggestionsResponseSchema.parse(JSON.parse(content)).suggestions;
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw Object.assign(
        new Error(error instanceof Error ? error.message : "Failed to generate suggestions"),
        { cause: error },
      );
    }
  }

  async generateDocumentation(diagram: DiagramData): Promise<string> {
    const serialized = serializeDiagram(diagram);
    const diagramText = diagramToText(serialized);

    const systemPrompt = `You are a technical writer specializing in system architecture documentation. Generate comprehensive markdown documentation for this architecture.

Include:
- Architecture Overview (purpose, key components)
- Component Descriptions (what each service/database does)
- Data Flow (how information flows through the system)
- Integration Points (external services, APIs)
- Deployment Considerations
- Technology Stack

Write in clear, professional language suitable for technical documentation.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate documentation for:\n\n${diagramText}` },
        ],
        temperature: 0.5,
      });

      return completionTextResponseSchema.parse(response);
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw Object.assign(
        new Error(error instanceof Error ? error.message : "Failed to generate documentation"),
        { cause: error },
      );
    }
  }

  async chat(messages: ChatMessage[], diagram: DiagramData): Promise<string> {
    const serialized = serializeDiagram(diagram);
    const diagramText = diagramToText(serialized);

    const systemPrompt = `You are an AI assistant helping with architecture design. You have access to the current architecture diagram.

Answer questions about:
- Architecture patterns and best practices
- Component suggestions
- How to improve the architecture
- Explanations of the current design

Be concise and helpful. When suggesting changes, be specific about components and connections.

Current diagram:
${diagramText}`;

    try {
      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      return completionTextResponseSchema.parse(response);
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw Object.assign(new Error(error instanceof Error ? error.message : "Chat failed"), {
        cause: error,
      });
    }
  }
}
