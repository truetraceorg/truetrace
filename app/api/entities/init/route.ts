import { NextResponse } from "next/server";

import {
  createEntity,
  getEntityIdForPasskey,
  linkPasskeyToEntity
} from "../../_lib/storage";

type InitRequest = {
  passkeyId?: string;
  createIfMissing?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as InitRequest;
  const passkeyId = body.passkeyId?.trim();
  if (!passkeyId) {
    return NextResponse.json({ error: "passkeyId is required" }, { status: 400 });
  }

  const existingEntityId = await getEntityIdForPasskey(passkeyId);
  if (existingEntityId) {
    return NextResponse.json({ entityId: existingEntityId, created: false });
  }

  if (body.createIfMissing === false) {
    return NextResponse.json({ entityId: null, created: false });
  }

  const entityId = await createEntity();
  await linkPasskeyToEntity(passkeyId, entityId);
  return NextResponse.json({ entityId, created: true });
}
