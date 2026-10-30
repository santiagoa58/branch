import type { ApiDiagram, ApiDiagramVersion } from "./api";
import { ApiError } from "./api";
import type { DiagramData } from "@/types";
import { diagramDataSchema } from "@/schemas/diagram";

export type SaveStatus =
  | "idle"
  | "loading"
  | "load-error"
  | "saved"
  | "pending"
  | "saving"
  | "error"
  | "conflict"
  | "versioning"
  | "restoring";
export interface CloudState {
  diagram: ApiDiagram | null;
  status: SaveStatus;
  dirty: boolean;
  locked: boolean;
  message: string | null;
}
interface CloudApi {
  get(id: string): Promise<ApiDiagram>;
  update(id: string, input: { data: DiagramData; expectedRevision: number }): Promise<ApiDiagram>;
  createVersion(id: string, expectedRevision: number, label?: string): Promise<ApiDiagramVersion>;
  restoreVersion(id: string, versionId: string, expectedRevision: number): Promise<ApiDiagram>;
}

/** One active document, one save in flight, no browser document persistence. */
export class CloudPersistence {
  private state: CloudState = {
    diagram: null,
    status: "idle",
    dirty: false,
    locked: false,
    message: null,
  };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private pending: DiagramData | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private operation = false;
  constructor(
    private api: CloudApi,
    private hydrate: (data: DiagramData) => void,
    private delay = 600,
  ) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<CloudState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
  private cancelTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
  isBusy = () => this.operation || this.state.dirty;
  reset = () => {
    this.cancelTimer();
    this.epoch++;
    this.pending = null;
    this.saving = null;
    this.operation = false;
    this.set({ diagram: null, status: "idle", dirty: false, locked: false, message: null });
  };
  cancelLoad = () => {
    if (this.state.status === "loading") {
      this.epoch++;
    }
  };
  load = async (id: string, projectId?: string) => {
    if (this.operation) {
      throw new Error("Wait for the version operation to finish.");
    }
    if (this.state.dirty) {
      await this.flush();
    }
    const epoch = ++this.epoch;
    this.cancelTimer();
    this.pending = null;
    this.set({ diagram: null, status: "loading", dirty: false, message: null });
    try {
      const diagram = await this.api.get(id);
      if (epoch !== this.epoch) {
        return;
      }
      if (projectId && diagram.projectId !== projectId) {
        throw new Error("This diagram does not belong to this project.");
      }
      this.hydrate(diagram.data);
      this.set({ diagram, status: "saved", message: null });
    } catch (error) {
      if (epoch === this.epoch) {
        this.set({
          status: "load-error",
          message: error instanceof Error ? error.message : "Failed to load diagram.",
        });
      }
    }
  };
  schedule = (input: unknown) => {
    if (!this.state.diagram || this.operation || this.state.status === "loading") {
      return;
    }
    this.pending = diagramDataSchema.parse(input);
    this.set({
      dirty: true,
      ...(this.state.status === "conflict" ? {} : { status: "pending", message: null }),
    });
    this.cancelTimer();
    if (this.state.status !== "conflict") {
      this.timer = setTimeout(() => {
        void this.flush().catch(() => {});
      }, this.delay);
    }
  };
  flush = (): Promise<void> => {
    this.cancelTimer();
    if (this.state.status === "conflict") {
      return Promise.reject(
        new Error(this.state.message ?? "Save conflict. Export your edits before reloading."),
      );
    }
    if (this.saving) {
      return this.saving;
    }
    if (!this.pending || !this.state.diagram) {
      return Promise.resolve();
    }
    const epoch = this.epoch;
    const save = this.saveLoop(epoch);
    this.saving = save;
    void save
      .finally(() => {
        if (this.saving === save) {
          this.saving = null;
        }
      })
      .catch(() => {});
    return save;
  };
  private async saveLoop(epoch: number) {
    while (this.pending && this.state.diagram && epoch === this.epoch) {
      const snapshot = this.pending;
      const { id, revision } = this.state.diagram;
      this.set({ status: "saving", message: null });
      try {
        const saved = await this.api.update(id, { data: snapshot, expectedRevision: revision });
        if (epoch !== this.epoch) {
          return;
        }
        if (this.pending === snapshot) {
          this.pending = null;
        }
        this.set({
          diagram: saved,
          dirty: this.pending !== null,
          status: this.pending ? "pending" : "saved",
        });
      } catch (error) {
        if (epoch === this.epoch) {
          this.set({
            status: error instanceof ApiError && error.status === 409 ? "conflict" : "error",
            dirty: true,
            message:
              error instanceof Error
                ? error.message
                : "Save failed. Your edits are still in memory.",
          });
        }
        throw error;
      }
    }
  }
  private async versionOperation<T>(
    status: "versioning" | "restoring",
    run: (diagram: ApiDiagram, epoch: number) => Promise<T>,
  ) {
    if (this.operation) {
      throw new Error("A version operation is already in progress.");
    }
    this.operation = true;
    this.set({ locked: true });
    const epoch = this.epoch;
    try {
      await this.flush();
      const diagram = this.state.diagram;
      if (!diagram || epoch !== this.epoch) {
        throw new Error("No active diagram.");
      }
      this.set({ status, message: null });
      const result = await run(diagram, epoch);
      if (epoch === this.epoch) {
        this.set({ status: "saved", message: null });
      }
      return result;
    } catch (error) {
      if (epoch === this.epoch) {
        this.set({
          status: error instanceof ApiError && error.status === 409 ? "conflict" : "error",
          message: error instanceof Error ? error.message : "Version operation failed.",
        });
      }
      throw error;
    } finally {
      if (epoch === this.epoch) {
        this.operation = false;
        this.set({ locked: false });
      }
    }
  }
  createVersion = (label?: string) =>
    this.versionOperation("versioning", async (diagram, epoch) => {
      const version = await this.api.createVersion(diagram.id, diagram.revision, label);
      if (epoch === this.epoch) {
        this.set({ diagram: { ...diagram, version: version.versionNumber } });
      }
      return version;
    });
  restoreVersion = (versionId: string) =>
    this.versionOperation("restoring", async (diagram, epoch) => {
      const restored = await this.api.restoreVersion(diagram.id, versionId, diagram.revision);
      if (epoch === this.epoch) {
        this.hydrate(restored.data);
        this.set({ diagram: restored, dirty: false });
      }
      return restored;
    });
}
