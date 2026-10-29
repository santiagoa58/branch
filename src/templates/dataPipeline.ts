import { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import type { DiagramTemplate } from "./index";

const data = {
  nodes: [
    archNode("producers", "external", "App Events", 0, 280, { technology: "SDK / webhooks" }),
    groupNode("region", "region", "Analytics Region", 240, 40, 980, 560),
    groupNode("subnet", "subnet", "Ingest Subnet", 40, 70, 580, 420, { parentId: "region" }),
    archNode("stream", "queue", "Kinesis Stream", 40, 60, {
      parentId: "subnet",
      technology: "AWS Kinesis",
    }),
    archNode("etl", "service", "Glue ETL", 330, 60, { parentId: "subnet", technology: "AWS Glue" }),
    archNode("raw", "storage", "Raw Bucket", 40, 250, { parentId: "subnet", technology: "S3" }),
    archNode("lake", "datalake", "Data Lake", 330, 250, {
      parentId: "subnet",
      technology: "Parquet on S3",
    }),
    archNode("athena", "service", "Athena", 680, 220, {
      parentId: "region",
      technology: "AWS Athena",
    }),
    archNode("dashboard", "client", "BI Dashboard", 1290, 300, { technology: "QuickSight" }),
  ],
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
  category: "Data",
  highlights: ["Nested groups", "Streaming/async edges", "Saved flow"],
  data,
};
