import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import { ENABLE_COLLAB, WS_BASE_URL } from "@/config/runtime";
import type { ZodType } from "zod";
import {
  collaborativeDiagramSchema,
  joinRoomSchema,
  leaveRoomSchema,
  outgoingCursorSchema,
  outgoingDiagramSchema,
  outgoingYjsUpdateSchema,
  remoteCursorSchema,
  usersChangedSchema,
  yjsSyncSchema,
  yjsUpdateSchema,
  type CollaboratorUser,
  type RemoteCursor,
} from "@/schemas/collaboration";

export type { CollaboratorUser, RemoteCursor } from "@/schemas/collaboration";

interface UseCollaborationOptions {
  diagramId: string | null;
  userName: string | null;
  onRemoteDiagramState?: (nodes: Node[], edges: Edge[]) => void;
}

const WS_URL = WS_BASE_URL;

export function useCollaboration({
  diagramId,
  userName,
  onRemoteDiagramState,
}: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const onRemoteRef = useRef(onRemoteDiagramState);

  useEffect(() => {
    onRemoteRef.current = onRemoteDiagramState;
  }, [onRemoteDiagramState]);

  const [users, setUsers] = useState<CollaboratorUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [connected, setConnected] = useState(false);
  const [myColor, setMyColor] = useState<string>("#3b82f6");

  // Connect to collaboration server
  useEffect(() => {
    if (!ENABLE_COLLAB) {
      return undefined;
    }
    if (!diagramId || !userName) {
      return undefined;
    }
    const room = joinRoomSchema.safeParse({ diagramId, userName });
    if (!room.success) {
      console.warn("Ignored invalid collaboration identity");
      return undefined;
    }

    const socket = io(`${WS_URL}/collaboration`, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const doc = new Y.Doc();
    ydocRef.current = doc;

    // All event bodies enter as unknown and are validated before any state change.
    function onValidated<T>(event: string, schema: ZodType<T>, handle: (data: T) => void) {
      socket.on(event, (payload: unknown) => {
        const result = schema.safeParse(payload);
        if (!result.success) {
          console.warn(`Ignored invalid collaboration event: ${event}`);
          return;
        }
        handle(result.data);
      });
    }

    socket.on("connect", () => {
      setConnected(true);
      // Join the room
      socket.emit("join-room", room.data);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Handle user list updates
    onValidated("users-changed", usersChangedSchema, (data) => {
      setUsers(data.users);
      // Find our own color
      const me = data.users.find((u) => u.name === userName);
      if (me) {
        setMyColor(me.color);
      }

      // Remove cursors for users who are no longer in the room
      const activeNames = new Set(data.users.map((u) => u.name));
      setRemoteCursors((prev) => prev.filter((c) => activeNames.has(c.userName)));
    });

    // Handle Yjs sync messages from server
    onValidated("yjs-sync", yjsSyncSchema, (data) => {
      // For now we handle sync at the transport level
      // The initial sync step 1 from server gives us the doc state
      if (data.type === "sync-step-1" || data.type === "sync-step-2") {
        const update = new Uint8Array(data.data);
        Y.applyUpdate(doc, update, "server");
      }
    });

    // Handle remote Yjs updates
    onValidated("yjs-update", yjsUpdateSchema, (data) => {
      const update = new Uint8Array(data.update);
      Y.applyUpdate(doc, update, "remote");
    });

    // Handle remote cursor updates
    onValidated("cursor-update", remoteCursorSchema, (data) => {
      setRemoteCursors((prev) => {
        if (data.cursor === null) {
          return prev.filter((c) => c.socketId !== data.socketId);
        }
        const exists = prev.find((c) => c.socketId === data.socketId);
        if (exists) {
          return prev.map((c) => (c.socketId === data.socketId ? data : c));
        }
        return [...prev, data];
      });
    });

    // Handle remote diagram state updates (nodes/edges sync)
    onValidated("diagram-state", collaborativeDiagramSchema, (data) => {
      onRemoteRef.current?.(data.nodes, data.edges);
    });

    return () => {
      socket.emit("leave-room", leaveRoomSchema.parse({ diagramId: room.data.diagramId }));
      socket.disconnect();
      doc.destroy();
      socketRef.current = null;
      ydocRef.current = null;
      setUsers([]);
      setRemoteCursors([]);
      setConnected(false);
    };
  }, [diagramId, userName]);

  // Send Yjs update to server
  const sendUpdate = useCallback(
    (update: Uint8Array) => {
      if (!socketRef.current || !diagramId) {
        return;
      }
      const result = outgoingYjsUpdateSchema.safeParse({
        diagramId,
        update: Array.from(update),
      });
      if (!result.success) {
        console.warn("Skipped invalid outgoing Yjs update");
        return;
      }
      socketRef.current.emit("yjs-update", result.data);
    },
    [diagramId],
  );

  // Send cursor position to server
  const sendCursorUpdate = useCallback(
    (cursor: { x: number; y: number } | null) => {
      if (!socketRef.current || !diagramId || !userName) {
        return;
      }
      const result = outgoingCursorSchema.safeParse({
        diagramId,
        cursor,
        userName,
        color: myColor,
      });
      if (!result.success) {
        console.warn("Skipped invalid outgoing cursor update");
        return;
      }
      socketRef.current.emit("cursor-update", result.data);
    },
    [diagramId, userName, myColor],
  );

  // Send diagram state (nodes/edges) to other clients
  const sendDiagramState = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (!socketRef.current || !diagramId) {
        return;
      }
      const result = outgoingDiagramSchema.safeParse({
        diagramId,
        nodes,
        edges,
      });
      if (!result.success) {
        console.warn("Skipped invalid outgoing diagram state");
        return;
      }
      socketRef.current.emit("diagram-state", result.data);
    },
    [diagramId],
  );

  return {
    users,
    remoteCursors,
    connected,
    myColor,
    sendUpdate,
    sendCursorUpdate,
    sendDiagramState,
  };
}
