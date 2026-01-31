"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { encryptJson, decryptJson, openSharedKey, type EncryptedPayload, type SealedInvitePayload } from "../lib/crypto";

// Client-side event types
export type EventType = "EntityCreated" | "PropertySet" | "PropertyDeleted";

export type EntityCreatedData = {
  entityId: string;
};

export type PropertySetData = {
  key: string;
  value: string;
};

export type PropertyDeletedData = {
  key: string;
};

export type EventData = EntityCreatedData | PropertySetData | PropertyDeletedData;

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

// Shared event envelope from other entities
export type SharedEventEnvelope = {
  sourceEntityId: string;
  propertyName: string;
  event: EncryptedEvent;
};

// Entity state with dynamic properties
export type EntityState = {
  entityId: string;
  properties: Record<string, string>;
};

// State for shared data from other entities
export type SharedPropertyValue = {
  sourceEntityId: string;
  propertyName: string;
  value: string;
  timestamp: string;
};

function reduceEvents(events: EntityEvent[]): EntityState | null {
  if (events.length === 0) return null;

  const state: EntityState = {
    entityId: "",
    properties: {},
  };

  for (const event of events) {
    switch (event.type) {
      case "EntityCreated":
        state.entityId = (event.data as EntityCreatedData).entityId;
        break;
      case "PropertySet": {
        const data = event.data as PropertySetData;
        state.properties[data.key] = data.value;
        break;
      }
      case "PropertyDeleted": {
        const data = event.data as PropertyDeletedData;
        delete state.properties[data.key];
        break;
      }
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

  // Shared data from other entities
  const [sharedData, setSharedData] = useState<SharedPropertyValue[]>([]);
  // Cache of decrypted shared keys (sourceEntityId -> key)
  const sharedKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  // Queue for events that arrive before the shared key is registered
  const queuedEventsRef = useRef<Map<string, SharedEventEnvelope[]>>(new Map());

  // Keep key ref updated
  useEffect(() => {
    entityKeyRef.current = entityKey;
  }, [entityKey]);

  // Decrypt an event using a shared key
  const decryptSharedEvent = useCallback(async (
    sourceEntityId: string,
    encrypted: EncryptedEvent
  ): Promise<EntityEvent | null> => {
    const key = sharedKeysRef.current.get(sourceEntityId);
    if (!key) {
      console.error(`[EventStream] No shared key for ${sourceEntityId}`);
      return null;
    }
    try {
      const content = await decryptJson<DecryptedEventContent>(key, encrypted.payload);
      return {
        id: encrypted.id,
        timestamp: encrypted.timestamp,
        type: content.type,
        data: content.data,
      };
    } catch (err) {
      console.error("[EventStream] Failed to decrypt shared event:", err);
      return null;
    }
  }, []);

  // Process a shared event (used both for immediate processing and queued events)
  const processSharedEvent = useCallback(async (envelope: SharedEventEnvelope) => {
    const decrypted = await decryptSharedEvent(envelope.sourceEntityId, envelope.event);
    if (decrypted && decrypted.type === "PropertySet") {
      const data = decrypted.data as PropertySetData;
      if (data.key === envelope.propertyName) {
        setSharedData(prev => {
          const existing = prev.findIndex(
            s => s.sourceEntityId === envelope.sourceEntityId && s.propertyName === envelope.propertyName
          );
          const newEntry: SharedPropertyValue = {
            sourceEntityId: envelope.sourceEntityId,
            propertyName: envelope.propertyName,
            value: data.value,
            timestamp: decrypted.timestamp,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newEntry;
            return updated;
          }
          return [...prev, newEntry];
        });
      }
    } else if (decrypted && decrypted.type === "PropertyDeleted") {
      const data = decrypted.data as PropertyDeletedData;
      if (data.key === envelope.propertyName) {
        setSharedData(prev => prev.filter(
          s => !(s.sourceEntityId === envelope.sourceEntityId && s.propertyName === envelope.propertyName)
        ));
      }
    }
  }, [decryptSharedEvent]);

  // Register a shared key for decrypting events from another entity
  const registerSharedKey = useCallback(async (
    sourceEntityId: string,
    sealedKey: SealedInvitePayload,
    shareCode: string
  ) => {
    try {
      const key = await openSharedKey(sealedKey, shareCode);
      sharedKeysRef.current.set(sourceEntityId, key);
      console.log(`[EventStream] Registered shared key for ${sourceEntityId}`);
      
      // Process any queued events for this sourceEntityId
      const queued = queuedEventsRef.current.get(sourceEntityId);
      if (queued && queued.length > 0) {
        queuedEventsRef.current.delete(sourceEntityId);
        for (const envelope of queued) {
          await processSharedEvent(envelope);
        }
      }
    } catch (err) {
      console.error(`[EventStream] Failed to open shared key for ${sourceEntityId}:`, err);
    }
  }, [processSharedEvent]);

  // Remove a shared key
  const unregisterSharedKey = useCallback((sourceEntityId: string) => {
    sharedKeysRef.current.delete(sourceEntityId);
    queuedEventsRef.current.delete(sourceEntityId);
    setSharedData(prev => prev.filter(s => s.sourceEntityId !== sourceEntityId));
  }, []);

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
      setSharedData([]);
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

    // Receive shared event from another entity
    socket.on("sharedEvent", async (envelope: SharedEventEnvelope) => {
      console.log(`[EventStream] Shared event from ${envelope.sourceEntityId} for ${envelope.propertyName}`);
      const hasKey = sharedKeysRef.current.has(envelope.sourceEntityId);
      
      if (!hasKey) {
        // Queue the event if key is not yet registered
        const queue = queuedEventsRef.current.get(envelope.sourceEntityId) || [];
        queue.push(envelope);
        queuedEventsRef.current.set(envelope.sourceEntityId, queue);
        return;
      }
      
      // Process immediately if key is available
      await processSharedEvent(envelope);
    });

    socket.on("error", (error: { message: string }) => {
      console.error("[EventStream] Error:", error.message);
    });

    return () => {
      socket.emit("unsubscribe", entityId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [entityId, entityKey, decryptEvent, decryptEvents, decryptSharedEvent, processSharedEvent]);

  // Append a new encrypted event with optional property hints for share propagation
  const appendEvent = useCallback(
    async (event: Omit<EntityEvent, "id" | "timestamp">, propertyHints?: string[]) => {
      if (!socketRef.current || !entityId || !entityKeyRef.current) return;

      const content: DecryptedEventContent = {
        type: event.type,
        data: event.data,
      };
      const payload = await encryptJson(entityKeyRef.current, content);

      socketRef.current.emit("append", { entityId, payload, propertyHints });
    },
    [entityId]
  );

  // Set a property value
  const setProperty = useCallback(
    (key: string, value: string) => {
      appendEvent(
        { type: "PropertySet", data: { key, value } },
        [key]
      );
    },
    [appendEvent]
  );

  // Delete a property
  const deleteProperty = useCallback(
    (key: string) => {
      appendEvent(
        { type: "PropertyDeleted", data: { key } },
        [key]
      );
    },
    [appendEvent]
  );

  return {
    events,
    state,
    connected,
    sharedData,
    appendEvent,
    setProperty,
    deleteProperty,
    registerSharedKey,
    unregisterSharedKey,
  };
}
