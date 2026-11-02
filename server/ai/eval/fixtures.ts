import type { z } from "zod";
import type { RequirementsInput, Scope } from "../../../src/schemas/aiDesign";
import type {
  architectureNodeTypeSchema,
  edgeProtocolSchema,
} from "../../../src/schemas/catalogEnums";

type ArchitectureNodeType = z.infer<typeof architectureNodeTypeSchema>;
type EdgeProtocol = z.infer<typeof edgeProtocolSchema>;

// Evaluation cases for the stage prompts, drawn from the validation scenarios in
// docs/system-design-capability-audit.md. Each scope has one case per kind:
// - vague: only a prompt; the model must ask.
// - partial: some lines and answers, but a decision that changes the components is still open.
// - complete: every such decision is stated or answered; the model must not ask.
// - conflicting: user lines contradict each other; the model must ask about it.

export interface EvalCase {
  id: string;
  scope: Scope;
  kind: "vague" | "partial" | "complete" | "conflicting";
  input: RequirementsInput;
  expect: {
    asks: boolean;
    mustInclude?: { types?: ArchitectureNodeType[]; protocols?: EdgeProtocol[] };
  };
}

function input(
  prompt: string,
  scope: Scope,
  rest: Partial<Omit<RequirementsInput, "prompt" | "scope">> = {},
): RequirementsInput {
  return { prompt, scope, requirements: [], outOfScope: [], answers: [], ...rest };
}

export const evalCases: EvalCase[] = [
  // --- Frontend: autocomplete search (#1), collaborative editor (#12) ---
  {
    id: "frontend-vague",
    scope: "frontend",
    kind: "vague",
    input: input("Design an autocomplete search box.", "frontend"),
    expect: { asks: true },
  },
  {
    id: "frontend-partial",
    scope: "frontend",
    kind: "partial",
    input: input("Design the client side of a collaborative document editor.", "frontend", {
      requirements: [
        { kind: "functional", text: "Several people edit one document at the same time" },
        { kind: "functional", text: "Each person sees the others' cursors" },
      ],
      answers: [
        { question: "Which platforms must it support?", answer: "Web only", assumed: false },
      ],
    }),
    expect: { asks: true },
  },
  {
    id: "frontend-complete",
    scope: "frontend",
    kind: "complete",
    input: input("Design an autocomplete search box for a product catalogue.", "frontend", {
      requirements: [
        { kind: "functional", text: "Suggestions appear as the user types" },
        {
          kind: "functional",
          text: "Arrow keys and Enter select a suggestion, with ARIA announcements",
        },
        { kind: "functional", text: "Show loading, empty and error states" },
        { kind: "nonFunctional", text: "Suggestions appear within 200 ms of a pause in typing" },
        { kind: "constraint", text: "Single-page web app; the suggestions API already exists" },
      ],
      outOfScope: ["Search results page", "Voice input"],
      answers: [
        {
          question: "How should keystrokes be throttled?",
          answer: "Debounce 150 ms and cancel the request that is still in flight",
          assumed: false,
        },
        {
          question: "Should earlier suggestions be cached?",
          answer: "Yes, cache per query in memory for the session",
          assumed: false,
        },
        { question: "Which platforms must it support?", answer: "Web only", assumed: false },
        {
          question: "How large is the catalogue?",
          answer: "About 50,000 products",
          assumed: false,
        },
      ],
    }),
    expect: { asks: false, mustInclude: { types: ["component", "cache"], protocols: ["http"] } },
  },
  {
    id: "frontend-conflicting",
    scope: "frontend",
    kind: "conflicting",
    input: input("Design the client side of a note-taking app.", "frontend", {
      requirements: [
        { kind: "functional", text: "Notes can be created and edited fully offline" },
        { kind: "functional", text: "Every edit is confirmed by the server before it appears" },
        { kind: "nonFunctional", text: "Edits appear instantly with no spinner" },
      ],
    }),
    expect: { asks: true },
  },

  // --- Backend: distributed queue (#45), ride matching (#66) ---
  {
    id: "backend-vague",
    scope: "backend",
    kind: "vague",
    input: input("Design a distributed message queue.", "backend"),
    expect: { asks: true },
  },
  {
    id: "backend-partial",
    scope: "backend",
    kind: "partial",
    input: input("Design the backend of a ride-matching service.", "backend", {
      requirements: [
        { kind: "functional", text: "Riders request a ride and are matched with a nearby driver" },
        { kind: "functional", text: "Drivers stream their location while online" },
      ],
      outOfScope: ["Driver onboarding"],
    }),
    expect: { asks: true },
  },
  {
    id: "backend-complete",
    scope: "backend",
    kind: "complete",
    input: input("Design a distributed message queue like Kafka.", "backend", {
      requirements: [
        { kind: "functional", text: "Producers publish messages to named topics" },
        {
          kind: "functional",
          text: "Consumer groups read each partition in order and commit offsets",
        },
        { kind: "functional", text: "Messages can be replayed from any retained offset" },
        { kind: "nonFunctional", text: "Handle 100,000 messages per second" },
        { kind: "nonFunctional", text: "No acknowledged message is lost when one broker fails" },
        { kind: "constraint", text: "Retain messages for seven days" },
      ],
      outOfScope: ["Multi-region replication", "Schema registry"],
      answers: [
        {
          question: "Is at-least-once delivery acceptable?",
          answer: "Yes, consumers deduplicate",
          assumed: false,
        },
        {
          question: "How is ordering guaranteed?",
          answer: "Per partition only, with producers choosing the partition by key",
          assumed: false,
        },
        {
          question: "Who coordinates the brokers?",
          answer: "A coordinator service",
          assumed: false,
        },
      ],
    }),
    expect: { asks: false, mustInclude: { types: ["stream", "coordinator"] } },
  },
  {
    id: "backend-conflicting",
    scope: "backend",
    kind: "conflicting",
    input: input("Design the backend of an order management system.", "backend", {
      requirements: [
        { kind: "constraint", text: "All data must stay in a single region" },
        {
          kind: "nonFunctional",
          text: "Keep serving orders with zero downtime if that region goes down",
        },
        {
          kind: "nonFunctional",
          text: "Reads and writes must always be strongly consistent worldwide",
        },
      ],
    }),
    expect: { asks: true },
  },

  // --- Fullstack: collaborative editor (#94), ride matching (#105), LLM assistant (#120) ---
  {
    id: "fullstack-vague",
    scope: "fullstack",
    kind: "vague",
    input: input("Design an AI assistant with retrieval and tools.", "fullstack"),
    expect: { asks: true },
  },
  {
    id: "fullstack-partial",
    scope: "fullstack",
    kind: "partial",
    input: input(
      "Design a ride-hailing app, from the rider's phone to the matching backend.",
      "fullstack",
      {
        requirements: [
          { kind: "functional", text: "Riders see nearby drivers on a map and request a ride" },
          { kind: "functional", text: "Riders pay in the app after the trip" },
        ],
        answers: [
          {
            question: "Which platforms must it support?",
            answer: "iOS and Android",
            assumed: false,
          },
        ],
      },
    ),
    expect: { asks: true },
  },
  {
    id: "fullstack-complete",
    scope: "fullstack",
    kind: "complete",
    input: input("Design a collaborative document editor.", "fullstack", {
      requirements: [
        {
          kind: "functional",
          text: "Several people edit one document at once and see each other's cursors",
        },
        { kind: "functional", text: "Edits made offline merge when the client reconnects" },
        { kind: "functional", text: "Documents are saved and have a revision history" },
        { kind: "nonFunctional", text: "Remote edits appear within 300 ms" },
        { kind: "nonFunctional", text: "Support 100 concurrent editors per document" },
        { kind: "constraint", text: "Web client only" },
      ],
      outOfScope: ["Comments", "Export to PDF"],
      answers: [
        {
          question: "Which conflict-resolution approach should merge concurrent edits?",
          answer: "CRDT",
          assumed: false,
        },
        {
          question: "How do clients receive live updates?",
          answer: "A WebSocket per open document",
          assumed: false,
        },
        { question: "How are users authenticated?", answer: "Hosted OAuth login", assumed: false },
      ],
    }),
    expect: {
      asks: false,
      mustInclude: { types: ["webapp", "database"], protocols: ["websocket"] },
    },
  },
  {
    id: "fullstack-conflicting",
    scope: "fullstack",
    kind: "conflicting",
    input: input("Design a chat app with an AI assistant.", "fullstack", {
      requirements: [
        { kind: "constraint", text: "No user message may ever leave our own servers" },
        { kind: "functional", text: "Answers come from a hosted third-party LLM API" },
        { kind: "nonFunctional", text: "Streamed answers start within 300 ms" },
        {
          kind: "nonFunctional",
          text: "Every answer must be reviewed by a person before it is shown",
        },
      ],
    }),
    expect: { asks: true },
  },
];
