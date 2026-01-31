import { NextResponse } from "next/server";

import { createShare, getShare, addOutgoingShare, getEntityIdForPasskey } from "../../_lib/storage";
import { getServerSession } from "../../../lib/session";

type CreateShareRequest = {
  code?: string;
  propertyName?: string;
  sealedKey?: unknown;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session.passkeyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sourceEntityId = await getEntityIdForPasskey(session.passkeyId);
  if (!sourceEntityId) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const body = (await request.json()) as CreateShareRequest;
  const code = body.code?.trim();
  const propertyName = body.propertyName?.trim();
  const sealedKey = body.sealedKey;

  if (!code || !propertyName || !sealedKey) {
    return NextResponse.json(
      { error: "code, propertyName, and sealedKey are required" },
      { status: 400 }
    );
  }

  const existing = await getShare(code);
  if (existing) {
    return NextResponse.json({ error: "Share code already exists" }, { status: 409 });
  }

  const ttlMs = body.ttlMs && body.ttlMs > 0 ? body.ttlMs : DEFAULT_TTL_MS;
  const expiresAt = Date.now() + ttlMs;

  await createShare(code, {
    sourceEntityId,
    propertyName,
    sealedKey,
    expiresAt,
  });

  return NextResponse.json({ expiresAt });
}
