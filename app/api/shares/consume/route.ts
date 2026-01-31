import { NextResponse } from "next/server";

import { consumeShare, addOutgoingShare, addIncomingShare, getEntityIdForPasskey } from "../../_lib/storage";
import { getServerSession } from "../../../lib/session";
import { getEventStream } from "../../../lib/events";
import { getSocketIOServer } from "../../../lib/socket";

type ConsumeShareRequest = {
  code?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session.passkeyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const targetEntityId = await getEntityIdForPasskey(session.passkeyId);
  if (!targetEntityId) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const body = (await request.json()) as ConsumeShareRequest;
  const code = body.code?.trim();

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const record = await consumeShare(code);
  if (!record) {
    return NextResponse.json({ error: "Share code not found or expired" }, { status: 404 });
  }

  if (record.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Share code expired" }, { status: 410 });
  }

  // Cannot share with yourself
  if (record.sourceEntityId === targetEntityId) {
    return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
  }

  // Register outgoing share on the source entity's side
  await addOutgoingShare(record.sourceEntityId, {
    targetEntityId,
    propertyName: record.propertyName,
  });

  // Register incoming share on the target entity's side
  await addIncomingShare(targetEntityId, {
    sourceEntityId: record.sourceEntityId,
    propertyName: record.propertyName,
    keyWrapped: record.sealedKey,
  });

  // Fetch the source entity's event stream to find recent events
  const sourceEvents = await getEventStream(record.sourceEntityId);

  // Emit recent events immediately to the target entity
  // The client will decrypt them and use the one that matches the shared property
  const io = getSocketIOServer();
  if (io && sourceEvents.length > 0) {
    // Send the last 10 events (or all if fewer) to increase chances of finding the current value
    // The client will decrypt and filter for the correct property
    const recentEvents = sourceEvents.slice(-10);
    const roomName = `entity:${targetEntityId}`;
    for (const event of recentEvents) {
      const envelope = {
        sourceEntityId: record.sourceEntityId,
        propertyName: record.propertyName,
        event: event,
      };
      io.to(roomName).emit("sharedEvent", envelope);
    }
  }

  return NextResponse.json({
    sourceEntityId: record.sourceEntityId,
    propertyName: record.propertyName,
    sealedKey: record.sealedKey,
  });
}
