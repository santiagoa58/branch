import type {
  ApiOutput,
  ComponentsOutput,
  DecisionsOutput,
  DesignContext,
} from "../../../src/schemas/aiDesign";

// Few-shot example for the stage 2, 3 and 4 prompts, copied from the url-shortener starter
// template (src/templates/catalog/web.ts). examples.test.ts fails when the two drift apart.

const context: DesignContext = {
  prompt: "Design a URL shortener like Bitly.",
  scope: "backend",
  requirements: [
    {
      kind: "functional",
      text: "Creators shorten a URL, optionally with a custom alias",
      assumed: false,
    },
    { kind: "functional", text: "Visitors are redirected from the short link", assumed: false },
    { kind: "functional", text: "Creators see click analytics", assumed: false },
    {
      kind: "nonFunctional",
      text: "Redirects take milliseconds worldwide",
      assumed: false,
      category: "latency",
    },
    { kind: "nonFunctional", text: "Reads far outnumber writes", assumed: true, category: "scale" },
  ],
  outOfScope: ["Link previews", "Billing"],
};

const components: ComponentsOutput = {
  summary:
    "Creators make links through an API gateway and a links API that takes unique codes from a key generator. Visitors are redirected by an edge function that reads hot links from a cache. Clicks stream to a warehouse in the background so analytics never slow a redirect.",
  groups: [],
  components: [
    {
      key: "creator",
      type: "webapp",
      label: "Link dashboard",
      responsibility: "Creators make and manage links",
    },
    {
      key: "visitor",
      type: "client",
      label: "Visitor browser",
      responsibility: "Follows short links",
    },
    {
      key: "gateway",
      type: "gateway",
      label: "API gateway",
      responsibility: "Auth and abuse limits for link management",
    },
    {
      key: "api",
      type: "service",
      label: "Links API",
      responsibility: "Validates and stores new links",
    },
    {
      key: "keys",
      type: "service",
      label: "Key generator",
      responsibility: "Hands out unique short codes",
    },
    { key: "store", type: "nosql", label: "Links", responsibility: "Maps short codes to URLs" },
    {
      key: "edge",
      type: "edgefunction",
      label: "Edge redirect",
      responsibility: "Resolves a code and redirects close to the visitor",
    },
    {
      key: "cache",
      type: "cache",
      label: "Hot links",
      responsibility: "Serves popular links without a database read",
    },
    {
      key: "clicks",
      type: "stream",
      label: "Click events",
      responsibility: "Carries clicks off the redirect path",
    },
    {
      key: "warehouse",
      type: "warehouse",
      label: "Click analytics",
      responsibility: "Answers click queries by time, country and referrer",
    },
  ],
  connections: [
    { from: "creator", to: "gateway", protocol: "http", purpose: "Create a link", async: false },
    {
      from: "gateway",
      to: "api",
      protocol: "http",
      purpose: "Forward authorised requests",
      async: false,
    },
    {
      from: "api",
      to: "keys",
      protocol: "grpc",
      purpose: "Take the next short code",
      async: false,
    },
    { from: "api", to: "store", protocol: "http", purpose: "Save the link", async: false },
    { from: "visitor", to: "edge", protocol: "http", purpose: "Open a short link", async: false },
    { from: "edge", to: "cache", protocol: "redis", purpose: "Look up a hot link", async: false },
    {
      from: "edge",
      to: "store",
      protocol: "http",
      purpose: "Look up on a cache miss",
      async: false,
    },
    { from: "edge", to: "clicks", protocol: "kafka", purpose: "Record the click", async: true },
    {
      from: "clicks",
      to: "warehouse",
      protocol: "kafka",
      purpose: "Load clicks for analytics",
      async: true,
    },
  ],
  mainFlow: {
    name: "Follow a link",
    description: "Resolve a short code and record the click.",
    entry: "visitor",
  },
};

// The store's decision names a concrete technology, which the decisions prompt asks for.
const decision: { key: string; output: DecisionsOutput } = {
  key: "store",
  output: {
    choice: "DynamoDB for links",
    reason: "Every redirect is a lookup by short code, nothing more.",
    gains: ["Fast key lookups at any scale"],
    costs: ["Hard to query links by owner without extra indexes"],
    considered: [{ option: "PostgreSQL", whyNot: "Redirect volume needs replicas and sharding" }],
    revisitWhen: ["Links need rich querying"],
  },
};

const api: ApiOutput = {
  endpoints: [
    {
      key: "create-link",
      service: "api",
      calledBy: ["creator"],
      method: "POST",
      path: "/links",
      summary: "Create a short link",
      auth: "user",
      style: "request",
      request: { url: "string", alias: "string?" },
      response: { code: "string", shortUrl: "string" },
      errors: [
        { status: 400, when: "The URL is invalid" },
        { status: 409, when: "The alias is taken" },
      ],
    },
    {
      key: "follow-link",
      service: "edge",
      calledBy: ["visitor"],
      method: "GET",
      path: "/{code}",
      summary: "Redirect to the link's URL",
      auth: "none",
      style: "request",
      response: { location: "string" },
      errors: [{ status: 404, when: "No link has this code" }],
    },
  ],
  events: [
    {
      name: "link.clicked",
      producer: "edge",
      consumers: ["warehouse"],
      payload: { code: "string", referrer: "string?", country: "string", clickedAt: "timestamp" },
    },
  ],
};

export const urlShortenerExample = { context, components, decision, api };
