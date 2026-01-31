import { NextResponse } from "next/server";

import { removeOutgoingShare, removeIncomingShare, getEntityIdForPasskey } from "../../_lib/storage";
import { getServerSession } from "../../../lib/session";

type RevokeShareRequest = {
  targetEntityId?: string;
  sourceEntityId?: string;
  propertyName?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session.passkeyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entityId = await getEntityIdForPasskey(session.passkeyId);
  if (!entityId) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const body = (await request.json()) as RevokeShareRequest;
  const propertyName = body.propertyName?.trim();

  if (!propertyName) {
    return NextResponse.json({ error: "propertyName is required" }, { status: 400 });
  }

  // Revoke outgoing share (I shared with someone)
  if (body.targetEntityId) {
    const removed = await removeOutgoingShare(entityId, body.targetEntityId, propertyName);
    if (removed) {
      // Also remove from their incoming shares
      await removeIncomingShare(body.targetEntityId, entityId, propertyName);
    }
    return NextResponse.json({ removed });
  }

  // Revoke incoming share (someone shared with me)
  if (body.sourceEntityId) {
    const removed = await removeIncomingShare(entityId, body.sourceEntityId, propertyName);
    if (removed) {
      // Also remove from their outgoing shares
      await removeOutgoingShare(body.sourceEntityId, entityId, propertyName);
    }
    return NextResponse.json({ removed });
  }

  return NextResponse.json(
    { error: "Either targetEntityId or sourceEntityId is required" },
    { status: 400 }
  );
}
