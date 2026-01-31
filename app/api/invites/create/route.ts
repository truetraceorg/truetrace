import { NextResponse } from "next/server";

import { createInvite, getInvite } from "../../_lib/storage";

type CreateInviteRequest = {
  code?: string;
  entityId?: string;
  sealed?: unknown;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as CreateInviteRequest;
  const code = body.code?.trim();
  const entityId = body.entityId?.trim();
  const sealed = body.sealed;

  if (!code || !entityId || !sealed) {
    return NextResponse.json(
      { error: "code, entityId, and sealed are required" },
      { status: 400 }
    );
  }

  const existing = await getInvite(code);
  if (existing) {
    return NextResponse.json({ error: "Invite code already exists" }, { status: 409 });
  }

  const ttlMs = body.ttlMs && body.ttlMs > 0 ? body.ttlMs : DEFAULT_TTL_MS;
  const expiresAt = Date.now() + ttlMs;
  await createInvite(code, { entityId, sealed, expiresAt });

  return NextResponse.json({ expiresAt });
}
