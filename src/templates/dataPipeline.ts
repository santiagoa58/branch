import { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import { attachDecisions } from "./define";
import { decide } from "./reasoning";
import type { DiagramTemplate } from "./types";

const decisions = {
  region: decide(
    "Single analytics region",
    "All analytics data stays in one region for cost and residency.",
    ["Simple data residency"],
    ["Regional outage stops analytics"],
    [["Multi-region lake", "Costly replication for internal analytics"]],
    ["Data residency rules require more regions"],
  ),
  subnet: decide(
    "Private ingest subnet",
    "Ingest jobs and buckets don't need public access.",
    ["No public path to raw data"],
    ["Needs VPC endpoints for AWS services"],
    [["Public subnet", "Raw events exposed"]],
    ["Ingest moves to fully managed services"],
  ),
  producers: decide(
    "Versioned events from SDKs and webhooks",
    "Apps send events with a schema version so changes don't break ingestion.",
    ["Schema changes are explicit"],
    ["Old versions must be supported"],
    [["Free-form JSON", "Breaks downstream silently"]],
    ["One producer controls all events"],
  ),
  stream: decide(
    "Kinesis with per-source partition keys",
    "Events from one source stay in order while sources scale out.",
    ["Ordered events per source"],
    ["Hot sources can overload a shard"],
    [["Write straight to S3", "No buffer during spikes"]],
    ["Event volume is low and bursty"],
  ),
  raw: decide(
    "Immutable raw bucket",
    "Original events are kept so failed transforms can be replayed.",
    ["Replay after bugs"],
    ["Storage grows forever without lifecycle rules"],
    [["Keep only transformed data", "Bugs lose data permanently"]],
    ["Retention rules require deletion"],
  ),
  etl: decide(
    "Checkpointed Glue jobs",
    "Jobs validate events and resume where they stopped after failures.",
    ["No reprocessing from scratch"],
    ["Slower to iterate than local scripts"],
    [["Custom ETL servers", "More infrastructure to run"]],
    ["Transforms need streaming latency"],
  ),
  lake: decide(
    "Parquet partitioned by date and source",
    "Queries usually filter by date, so partitions skip most data.",
    ["Cheap, fast scans"],
    ["Partition layout is hard to change"],
    [["Raw JSON files", "Slow and costly queries"]],
    ["Queries mostly filter by other fields"],
  ),
  athena: decide(
    "Athena for on-demand SQL",
    "Analysts query occasionally, so paying per query beats a running warehouse.",
    ["No cluster to manage"],
    ["Cost grows with data scanned"],
    [["Provisioned warehouse", "Pays for idle time"]],
    ["Queries run constantly"],
  ),
  dashboard: decide(
    "QuickSight dashboards",
    "Business users need governed dashboards without writing SQL.",
    ["Self-serve reporting"],
    ["Per-user licensing"],
    [["Share SQL results by hand", "Stale and inconsistent reports"]],
    ["Teams standardize on another BI tool"],
  ),
};

const data = {
  nodes: attachDecisions(
    "data-analytics-pipeline",
    [
      archNode("producers", "external", "App Events", 0, 280),
      groupNode("region", "region", "Analytics Region", 240, 40, 980, 560),
      groupNode("subnet", "subnet", "Ingest Subnet", 40, 70, 580, 420, { parentId: "region" }),
      archNode("stream", "queue", "Kinesis Stream", 40, 60, {
        parentId: "subnet",
        attributes: [{ name: "Illustrative stream retention", value: "24", unit: "h" }],
      }),
      archNode("etl", "service", "Glue ETL", 330, 60, {
        parentId: "subnet",
      }),
      archNode("raw", "storage", "Raw Bucket", 40, 250, {
        parentId: "subnet",
      }),
      archNode("lake", "datalake", "Data Lake", 330, 250, {
        parentId: "subnet",
        attributes: [{ name: "Illustrative target file size", value: "128", unit: "MiB" }],
      }),
      archNode("athena", "service", "Athena", 680, 220, {
        parentId: "region",
      }),
      archNode("dashboard", "client", "BI Dashboard", 1290, 300),
    ],
    decisions,
  ),
  edges: [
    archEdge("e-producers-stream", "producers", "stream", { protocol: "http", async: true }),
    archEdge("e-stream-raw", "stream", "raw", { protocol: "s3", async: true, label: "firehose" }),
    archEdge("e-stream-etl", "stream", "etl", { protocol: "kafka", async: true, label: "consume" }),
    archEdge("e-etl-lake", "etl", "lake", { protocol: "s3", label: "parquet write" }),
    archEdge("e-athena-lake", "athena", "lake", { protocol: "sql", label: "query" }),
    archEdge("e-dashboard-athena", "dashboard", "athena", { protocol: "http" }),
  ],
  flows: [
    {
      id: "flow-ingestion",
      name: "Event ingestion",
      description: "Raw events streaming from producers into the lake.",
      sourceNodeId: "producers",
      color: "#06b6d4",
      speed: 1 as const,
      createdAt: "2026-06-10T00:00:00.000Z",
    },
  ],
} as DiagramData;

export const dataPipeline: DiagramTemplate = {
  id: "data-analytics-pipeline",
  name: "Data analytics pipeline",
  description:
    "Streaming ingestion into a data lake: Kinesis feeding S3 and Glue ETL inside a nested subnet, queried by Athena and a BI dashboard.",
  category: "data",
  keywords: [
    "analytics",
    "data lake",
    "etl",
    "streaming",
    "kinesis",
    "athena",
    "bi",
    "dashboards",
    "warehouse",
  ],
  highlights: ["Nested groups", "Streaming/async edges", "Saved flow"],
  data,
};
