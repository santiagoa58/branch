CREATE TABLE projects (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_idx ON projects(owner_id, updated_at DESC);

CREATE TABLE diagrams (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text,
  data jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"flows":[]}'::jsonb,
  thumbnail text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diagrams_project_idx ON diagrams(project_id, updated_at DESC);

CREATE TABLE diagram_versions (
  id uuid PRIMARY KEY,
  diagram_id uuid NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  label text,
  data jsonb NOT NULL,
  thumbnail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(diagram_id, version_number)
);
