/** Generic system architecture capabilities; no vendor or product logos. */
const CATEGORIES = [
  "Clients",
  "Services",
  "Databases",
  "Caches",
  "Queues",
  "Object storage",
  "CDNs",
  "Authentication",
  "Search",
  "Observability",
];

export function LogoMarquee() {
  return (
    <section className="border-y border-zinc-900 bg-zinc-950 py-8">
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
        Model your architecture
      </p>
      <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-3 px-6">
        {CATEGORIES.map((category) => (
          <span
            key={category}
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300"
          >
            {category}
          </span>
        ))}
      </div>
    </section>
  );
}
