# Architecture asset catalog

Branch includes 69 architecture node types across frontend, backend and messaging,
infrastructure and security, data and storage, observability, AI and machine
learning, and integrations and identity. Existing node identifiers and keyboard
shortcuts remain supported.

## Building a diagram

- Search the component palette by component name, description, or technology
  keyword, then drag a component onto the canvas.
- Use groups for VPCs, clusters, regions, and subnets, and notes for annotations.
- Double-click a node's icon to open the icon picker. Browse 69 featured technology
  logos or search the supported Iconify collections: Logos, Simple Icons, Devicon,
  Skill Icons, Lucide, Solar, Phosphor, and Iconamoon.
- Confirm an icon to persist its Iconify ID with the node. Labels, technology,
  descriptions, metadata, tags, and icon/accent colors remain customizable.

For example, model a frontend with web apps, microfrontends, components, routing,
state stores, service workers, and a backend for frontend. Model a retrieval
augmented AI system with ingestion/ETL, embeddings, vector storage, retrieval,
reranking, prompts, models, agents/tools, guardrails, and evaluation. Compose these
with generic services and integrations for domain-specific systems.

## Network and licensing

Technology logos are loaded on demand through Iconify, not bundled as local SVG
files. Searching and loading logos requires network access to Iconify and sends
search queries/icon IDs to that service. Generic node icons are bundled with the
application. Existing saved icon IDs remain usable.

Brand marks belong to their respective owners; inclusion does not imply
endorsement or grant trademark rights. Each Iconify collection has its own icon
license. Review the upstream collection's license and brand usage guidelines
before redistributing artwork or publishing diagrams.

## Extending the catalog

Keep these files aligned when adding a node type:

1. `src/types/index.ts`: `ArchitectureNodeType`.
2. `src/constants/index.ts`: `NODE_TYPES_CONFIG`, including its icon and styles.
3. `src/schemas/diagram.ts`: `architectureNodeTypeSchema` for imports and saves.
4. `src/constants/nodeCategories.ts`: include the type in exactly one category.

Palette search, property type selection, template preview colors, and minimap
colors use the catalog. New types do not receive keyboard shortcuts automatically.
Add featured technology logos in `src/constants/technologyIcons.ts`; these are
visual choices, independent of the node's architecture type.

Run the catalog, palette, icon picker, and Iconify service tests after changes.
