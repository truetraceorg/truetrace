import { NextResponse } from "next/server";

import { ensureEntityDir, relinkPasskeyToEntity } from "../../_lib/storage";

type LinkRequest = {
  passkeyId?: string;
  entityId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LinkRequest;
  const passkeyId = body.passkeyId?.trim();
  const entityId = body.entityId?.trim();

  if (!passkeyId || !entityId) {
    return NextResponse.json(
      { error: "passkeyId and entityId are required" },
      { status: 400 }
    );
  }

  await ensureEntityDir(entityId);
  await relinkPasskeyToEntity(passkeyId, entityId);
  return NextResponse.json({ ok: true });
}
