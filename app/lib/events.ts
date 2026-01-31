import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const entitiesRoot = path.join(process.cwd(), "entities");

// Encrypted payload structure (server only sees this)
export type EncryptedPayload = {
  version: number;
  alg: string;
  nonce: string;
  ciphertext: string;
};

// Encrypted event stored on server (server cannot read content)
export type EncryptedEvent = {
  id: string;
  timestamp: string;
  payload: EncryptedPayload;
};

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function getEventLogPath(entityId: string): string {
  return path.join(entitiesRoot, entityId, "events.json");
}

export async function getEventStream(entityId: string): Promise<EncryptedEvent[]> {
  const filePath = getEventLogPath(entityId);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as EncryptedEvent[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendEvent(
  entityId: string,
  payload: EncryptedPayload
): Promise<EncryptedEvent> {
  const entityDir = path.join(entitiesRoot, entityId);
  await ensureDir(entityDir);

  const filePath = getEventLogPath(entityId);
  const events = await getEventStream(entityId);

  const newEvent: EncryptedEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    payload,
  };

  events.push(newEvent);
  await fs.writeFile(filePath, JSON.stringify(events, null, 2), "utf8");

  return newEvent;
}
