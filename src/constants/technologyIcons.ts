export interface TechnologyIcon {
  id: string;
  name: string;
  aliases?: readonly string[];
}

export interface TechnologyIconGroup {
  name: string;
  icons: readonly TechnologyIcon[];
}

/** Curated Iconify IDs, grouped for browsing without a search query. */
export const TECHNOLOGY_ICON_GROUPS: readonly TechnologyIconGroup[] = [
  {
    name: "Frontend",
    icons: [
      { id: "logos:react", name: "React" },
      { id: "logos:vue", name: "Vue" },
      { id: "logos:angular-icon", name: "Angular" },
      { id: "logos:svelte-icon", name: "Svelte" },
      { id: "logos:nextjs-icon", name: "Next.js" },
      { id: "logos:nuxt-icon", name: "Nuxt" },
      { id: "logos:astro-icon", name: "Astro" },
      { id: "logos:javascript", name: "JavaScript" },
      { id: "logos:typescript-icon", name: "TypeScript" },
      { id: "logos:html-5", name: "HTML" },
      { id: "logos:css-3", name: "CSS" },
      { id: "logos:tailwindcss-icon", name: "Tailwind CSS" },
      { id: "logos:vitejs", name: "Vite" },
      { id: "logos:webpack", name: "webpack" },
    ],
  },
  {
    name: "Backend",
    icons: [
      { id: "logos:nodejs-icon", name: "Node.js", aliases: ["node", "nodejs"] },
      { id: "logos:deno", name: "Deno" },
      { id: "logos:bun", name: "Bun" },
      { id: "logos:python", name: "Python" },
      { id: "logos:go", name: "Go" },
      { id: "logos:rust", name: "Rust" },
      { id: "logos:java", name: "Java" },
      { id: "logos:kotlin-icon", name: "Kotlin" },
      { id: "logos:php", name: "PHP" },
      { id: "logos:ruby", name: "Ruby" },
      { id: "logos:dotnet", name: ".NET" },
      { id: "logos:django-icon", name: "Django" },
      { id: "logos:fastapi-icon", name: "FastAPI" },
      { id: "logos:nestjs", name: "NestJS" },
      { id: "logos:spring-icon", name: "Spring" },
      { id: "logos:graphql", name: "GraphQL" },
      { id: "logos:grpc", name: "gRPC" },
    ],
  },
  {
    name: "Cloud and infrastructure",
    icons: [
      { id: "logos:aws", name: "AWS", aliases: ["Amazon Web Services", "Amazon cloud"] },
      { id: "logos:google-cloud", name: "Google Cloud", aliases: ["GCP"] },
      { id: "logos:microsoft-azure", name: "Microsoft Azure", aliases: ["Azure"] },
      { id: "logos:cloudflare-icon", name: "Cloudflare" },
      { id: "logos:vercel-icon", name: "Vercel" },
      { id: "logos:netlify-icon", name: "Netlify" },
      { id: "logos:digital-ocean-icon", name: "DigitalOcean" },
      { id: "logos:docker-icon", name: "Docker" },
      { id: "logos:kubernetes", name: "Kubernetes" },
      { id: "logos:terraform-icon", name: "Terraform" },
      { id: "logos:nginx", name: "NGINX" },
      { id: "logos:github-icon", name: "GitHub" },
      { id: "logos:gitlab", name: "GitLab" },
      { id: "logos:prometheus", name: "Prometheus" },
      { id: "logos:grafana", name: "Grafana" },
      { id: "logos:ansible", name: "Ansible" },
    ],
  },
  {
    name: "Data and messaging",
    icons: [
      { id: "logos:postgresql", name: "PostgreSQL", aliases: ["Postgres"] },
      { id: "logos:mysql-icon", name: "MySQL" },
      { id: "logos:mariadb-icon", name: "MariaDB" },
      { id: "logos:mongodb-icon", name: "MongoDB" },
      { id: "logos:redis", name: "Redis" },
      { id: "logos:sqlite", name: "SQLite" },
      { id: "logos:elasticsearch", name: "Elasticsearch" },
      { id: "devicon:apachekafka", name: "Apache Kafka" },
      { id: "logos:rabbitmq-icon", name: "RabbitMQ" },
      { id: "logos:cassandra", name: "Apache Cassandra" },
      { id: "logos:firebase-icon", name: "Firebase" },
      { id: "logos:supabase-icon", name: "Supabase" },
      { id: "logos:prisma", name: "Prisma" },
      { id: "logos:sequelize", name: "Sequelize" },
    ],
  },
  {
    name: "AI and machine learning",
    icons: [
      { id: "logos:openai-icon", name: "OpenAI" },
      { id: "logos:hugging-face-icon", name: "Hugging Face" },
      { id: "logos:tensorflow", name: "TensorFlow" },
      { id: "logos:pytorch-icon", name: "PyTorch" },
      { id: "devicon:keras", name: "Keras" },
      { id: "logos:jupyter", name: "Jupyter" },
      { id: "logos:numpy", name: "NumPy" },
      { id: "logos:pandas-icon", name: "pandas" },
    ],
  },
];
