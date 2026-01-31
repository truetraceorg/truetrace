import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const entitiesRoot = path.join(process.cwd(), "entities");
const passkeyMapFile = path.join(entitiesRoot, "_passkeys.json");
const inviteMapFile = path.join(entitiesRoot, "_invites.json");
const shareMapFile = path.join(entitiesRoot, "_shares.json");

type PasskeyMap = Record<string, string>;
type InviteRecord = {
  entityId: string;
  sealed: unknown;
  expiresAt: number;
};
type InviteMap = Record<string, InviteRecord>;

export type ShareRecord = {
  sourceEntityId: string;
  propertyName: string;
  sealedKey: unknown;
  expiresAt: number;
};
type ShareMap = Record<string, ShareRecord>;

export type OutgoingShare = {
  targetEntityId: string;
  propertyName: string;
};

export type IncomingShare = {
  sourceEntityId: string;
  propertyName: string;
  keyWrapped: unknown;
};

export type EntityShares = {
  outgoing: OutgoingShare[];
  incoming: IncomingShare[];
};

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeFilename(filename: string): string {
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new Error("Invalid filename.");
  }
  return filename;
}

export async function ensureEntitiesRoot(): Promise<void> {
  await ensureDir(entitiesRoot);
}

export async function resetAllEntities(): Promise<void> {
  await fs.rm(entitiesRoot, { recursive: true, force: true });
}

export async function getEntityIdForPasskey(passkeyId: string): Promise<string | null> {
  const map = await readJsonFile<PasskeyMap>(passkeyMapFile, {});
  return map[passkeyId] ?? null;
}

export async function linkPasskeyToEntity(passkeyId: string, entityId: string): Promise<void> {
  const map = await readJsonFile<PasskeyMap>(passkeyMapFile, {});
  map[passkeyId] = entityId;
  await writeJsonFile(passkeyMapFile, map);
}

async function removeEntity(entityId: string): Promise<void> {
  const entityDir = path.join(entitiesRoot, entityId);
  await fs.rm(entityDir, { recursive: true, force: true });
}

function hasOtherPasskeys(map: PasskeyMap, entityId: string, passkeyId: string): boolean {
  return Object.entries(map).some(
    ([key, value]) => value === entityId && key !== passkeyId
  );
}

export async function relinkPasskeyToEntity(
  passkeyId: string,
  nextEntityId: string
): Promise<void> {
  const map = await readJsonFile<PasskeyMap>(passkeyMapFile, {});
  const previousEntityId = map[passkeyId];
  map[passkeyId] = nextEntityId;
  await writeJsonFile(passkeyMapFile, map);

  if (previousEntityId && previousEntityId !== nextEntityId) {
    const hasOthers = hasOtherPasskeys(map, previousEntityId, passkeyId);
    if (!hasOthers) {
      await removeEntity(previousEntityId);
    }
  }
}

export async function createEntity(): Promise<string> {
  await ensureEntitiesRoot();
  const entityId = randomUUID();
  await ensureDir(path.join(entitiesRoot, entityId));
  return entityId;
}

export async function ensureEntityDir(entityId: string): Promise<void> {
  await ensureDir(path.join(entitiesRoot, entityId));
}

export async function writeEntityFile(
  entityId: string,
  filename: string,
  payload: unknown
): Promise<void> {
  const safeName = sanitizeFilename(filename);
  const filePath = path.join(entitiesRoot, entityId, safeName);
  await ensureEntityDir(entityId);
  await writeJsonFile(filePath, payload);
}

export async function readEntityFile(
  entityId: string,
  filename: string
): Promise<unknown | null> {
  const safeName = sanitizeFilename(filename);
  const filePath = path.join(entitiesRoot, entityId, safeName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function createInvite(
  code: string,
  record: InviteRecord
): Promise<void> {
  const map = await readJsonFile<InviteMap>(inviteMapFile, {});
  map[code] = record;
  await writeJsonFile(inviteMapFile, map);
}

export async function consumeInvite(
  code: string
): Promise<InviteRecord | null> {
  const map = await readJsonFile<InviteMap>(inviteMapFile, {});
  const record = map[code];
  if (!record) return null;
  delete map[code];
  await writeJsonFile(inviteMapFile, map);
  return record;
}

export async function getInvite(code: string): Promise<InviteRecord | null> {
  const map = await readJsonFile<InviteMap>(inviteMapFile, {});
  return map[code] ?? null;
}

// =====================
// Share Storage
// =====================

function getEntitySharesPath(entityId: string): string {
  return path.join(entitiesRoot, entityId, "shares.json");
}

export async function createShare(
  code: string,
  record: ShareRecord
): Promise<void> {
  const map = await readJsonFile<ShareMap>(shareMapFile, {});
  map[code] = record;
  await writeJsonFile(shareMapFile, map);
}

export async function consumeShare(
  code: string
): Promise<ShareRecord | null> {
  const map = await readJsonFile<ShareMap>(shareMapFile, {});
  const record = map[code];
  if (!record) return null;
  delete map[code];
  await writeJsonFile(shareMapFile, map);
  return record;
}

export async function getShare(code: string): Promise<ShareRecord | null> {
  const map = await readJsonFile<ShareMap>(shareMapFile, {});
  return map[code] ?? null;
}

export async function getShares(entityId: string): Promise<EntityShares> {
  const filePath = getEntitySharesPath(entityId);
  return readJsonFile<EntityShares>(filePath, { outgoing: [], incoming: [] });
}

export async function addOutgoingShare(
  entityId: string,
  share: OutgoingShare
): Promise<void> {
  const shares = await getShares(entityId);
  // Avoid duplicates
  const exists = shares.outgoing.some(
    (s) => s.targetEntityId === share.targetEntityId && s.propertyName === share.propertyName
  );
  if (!exists) {
    shares.outgoing.push(share);
    await writeJsonFile(getEntitySharesPath(entityId), shares);
  }
}

export async function addIncomingShare(
  entityId: string,
  share: IncomingShare
): Promise<void> {
  const shares = await getShares(entityId);
  // Avoid duplicates
  const exists = shares.incoming.some(
    (s) => s.sourceEntityId === share.sourceEntityId && s.propertyName === share.propertyName
  );
  if (!exists) {
    shares.incoming.push(share);
    await writeJsonFile(getEntitySharesPath(entityId), shares);
  }
}

export async function removeOutgoingShare(
  entityId: string,
  targetEntityId: string,
  propertyName: string
): Promise<boolean> {
  const shares = await getShares(entityId);
  const originalLength = shares.outgoing.length;
  shares.outgoing = shares.outgoing.filter(
    (s) => !(s.targetEntityId === targetEntityId && s.propertyName === propertyName)
  );
  if (shares.outgoing.length !== originalLength) {
    await writeJsonFile(getEntitySharesPath(entityId), shares);
    return true;
  }
  return false;
}

export async function removeIncomingShare(
  entityId: string,
  sourceEntityId: string,
  propertyName: string
): Promise<boolean> {
  const shares = await getShares(entityId);
  const originalLength = shares.incoming.length;
  shares.incoming = shares.incoming.filter(
    (s) => !(s.sourceEntityId === sourceEntityId && s.propertyName === propertyName)
  );
  if (shares.incoming.length !== originalLength) {
    await writeJsonFile(getEntitySharesPath(entityId), shares);
    return true;
  }
  return false;
}
