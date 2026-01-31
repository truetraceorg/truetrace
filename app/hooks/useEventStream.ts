"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { encryptJson, decryptJson, type EncryptedPayload } from "../lib/crypto";

// Client-side event types
export type EventType = "EntityCreated" | "ProfileUpdated";

export type EntityCreatedData = {
  entityId: string;
};

export type ProfileUpdatedData = {
  givenName?: string;
  surname?: string;
};

export type EventData = EntityCreatedData | ProfileUpdatedData;

// Decrypted event (client-side only)
export type EntityEvent = {
  id: string;
  type: EventType;
  timestamp: string;
  data: EventData;
};

// Encrypted event (what server stores)
export type EncryptedEvent = {
  id: string;
  timestamp: string;
  payload: EncryptedPayload;
};

export type EntityState = {
  entityId: string;
  givenName: string;
  surname: string;
};

function reduceEvents(events: EntityEvent[]): EntityState | null {
  if (events.length === 0) return null;

  const state: EntityState = {
    entityId: "",
    givenName: "",
    surname: "",
  };

  for (const event of events) {
    switch (event.type) {
      case "EntityCreated":
        state.entityId = (event.data as EntityCreatedData).entityId;
        state.givenName = "Max";
        state.surname = "Mustermann";
        break;
      case "ProfileUpdated":
        const profileData = event.data as ProfileUpdatedData;
        if (profileData.givenName !== undefined) {
          state.givenName = profileData.givenName;
        }
        if (profileData.surname !== undefined) {
          state.surname = profileData.surname;
        }
        break;
    }
  }

  return state.entityId ? state : null;
}

type DecryptedEventContent = {
  type: EventType;
  data: EventData;
};

export function useEventStream(entityId: string | null, entityKey: Uint8Array | null) {
  const socketRef = useRef<Socket | null>(null);
  const entityKeyRef = useRef<Uint8Array | null>(entityKey);
  const [events, setEvents] = useState<EntityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<EntityState | null>(null);

  // Keep key ref updated
  useEffect(() => {
    entityKeyRef.current = entityKey;
  }, [entityKey]);

  // Decrypt a single encrypted event
  const decryptEvent = useCallback(async (encrypted: EncryptedEvent): Promise<EntityEvent | null> => {
    if (!entityKeyRef.current) return null;
    try {
      const content = await decryptJson<DecryptedEventContent>(entityKeyRef.current, encrypted.payload);
      return {
        id: encrypted.id,
        timestamp: encrypted.timestamp,
        type: content.type,
        data: content.data,
      };
    } catch (err) {
      console.error("[EventStream] Failed to decrypt event:", err);
      return null;
    }
  }, []);

  // Decrypt multiple events
  const decryptEvents = useCallback(async (encryptedEvents: EncryptedEvent[]): Promise<EntityEvent[]> => {
    const decrypted = await Promise.all(encryptedEvents.map(decryptEvent));
    return decrypted.filter((e): e is EntityEvent => e !== null);
  }, [decryptEvent]);

  // Connect and subscribe when entityId changes
  useEffect(() => {
    if (!entityId || !entityKey) {
      setEvents([]);
      setState(null);
      return;
    }

    const socket = io({
      path: "/api/socket",
      addTrailingSlash: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[EventStream] Connected");
      setConnected(true);
      socket.emit("subscribe", entityId);
    });

    socket.on("disconnect", () => {
      console.log("[EventStream] Disconnected");
      setConnected(false);
    });

    // Receive replayed encrypted events on initial subscribe
    socket.on("replay", async (encryptedEvents: EncryptedEvent[]) => {
      console.log("[EventStream] Replayed", encryptedEvents.length, "encrypted events");
      const decrypted = await decryptEvents(encryptedEvents);
      setEvents(decrypted);
      setState(reduceEvents(decrypted));
    });

    // Receive new encrypted event in real-time
    socket.on("event", async (encrypted: EncryptedEvent) => {
      console.log("[EventStream] New encrypted event received");
      const decrypted = await decryptEvent(encrypted);
      if (decrypted) {
        setEvents((prev) => {
          const updated = [...prev, decrypted];
          setState(reduceEvents(updated));
          return updated;
        });
      }
    });

    socket.on("error", (error: { message: string }) => {
      console.error("[EventStream] Error:", error.message);
    });

    return () => {
      socket.emit("unsubscribe", entityId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [entityId, entityKey, decryptEvent, decryptEvents]);

  // Append a new encrypted event
  const appendEvent = useCallback(
    async (event: Omit<EntityEvent, "id" | "timestamp">) => {
      if (!socketRef.current || !entityId || !entityKeyRef.current) return;

      // Encrypt the event content
      const content: DecryptedEventContent = {
        type: event.type,
        data: event.data,
      };
      const payload = await encryptJson(entityKeyRef.current, content);

      // Send encrypted payload to server
      socketRef.current.emit("append", { entityId, payload });
    },
    [entityId]
  );

  // Convenience method to update profile
  const updateProfile = useCallback(
    (updates: ProfileUpdatedData) => {
      appendEvent({
        type: "ProfileUpdated",
        data: updates,
      });
    },
    [appendEvent]
  );

  return {
    events,
    state,
    connected,
    appendEvent,
    updateProfile,
  };
}
