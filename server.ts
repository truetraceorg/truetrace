import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { parse } from "url";
import {
  appendEvent,
  getEventStream,
  type EncryptedPayload
} from "./app/lib/events";
import { getShares } from "./app/api/_lib/storage";
import { setSocketIOServer } from "./app/lib/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Shared event envelope for target entities
type SharedEventEnvelope = {
  sourceEntityId: string;
  propertyName: string;
  event: {
    id: string;
    timestamp: string;
    payload: EncryptedPayload;
  };
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
  });

  // Make io instance available to API routes
  setSocketIOServer(io);

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Client subscribes to an entity's event stream
    socket.on("subscribe", async (entityId: string) => {
      console.log(`[Socket.IO] ${socket.id} subscribing to entity: ${entityId}`);

      // Join the entity room
      socket.join(`entity:${entityId}`);

      // Replay all existing encrypted events to this client
      try {
        const events = await getEventStream(entityId);
        socket.emit("replay", events);
      } catch (error) {
        socket.emit("error", { message: "Failed to load event stream" });
      }
    });

    // Client unsubscribes from an entity
    socket.on("unsubscribe", (entityId: string) => {
      console.log(`[Socket.IO] ${socket.id} unsubscribing from entity: ${entityId}`);
      socket.leave(`entity:${entityId}`);
    });

    // Client appends a new encrypted event (server cannot read content)
    // Optionally includes propertyHints for shared property propagation
    socket.on("append", async (data: {
      entityId: string;
      payload: EncryptedPayload;
      propertyHints?: string[]; // Property names being updated (for share propagation)
    }) => {
      const { entityId, payload, propertyHints } = data;
      console.log(`[Socket.IO] ${socket.id} appending encrypted event to ${entityId}`);

      try {
        const savedEvent = await appendEvent(entityId, payload);
        // Broadcast to all clients subscribed to this entity (including sender)
        io.to(`entity:${entityId}`).emit("event", savedEvent);

        // Propagate to shared entities if property hints are provided
        if (propertyHints && propertyHints.length > 0) {
          const shares = await getShares(entityId);
          for (const share of shares.outgoing) {
            if (propertyHints.includes(share.propertyName)) {
              console.log(`[Socket.IO] Propagating ${share.propertyName} to ${share.targetEntityId}`);
              const envelope: SharedEventEnvelope = {
                sourceEntityId: entityId,
                propertyName: share.propertyName,
                event: savedEvent,
              };
              io.to(`entity:${share.targetEntityId}`).emit("sharedEvent", envelope);
            }
          }
        }
      } catch (error) {
        console.error("[Socket.IO] Error appending event:", error);
        socket.emit("error", { message: "Failed to append event" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
