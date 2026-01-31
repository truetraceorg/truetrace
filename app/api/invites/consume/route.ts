import { NextResponse } from "next/server";

import { consumeInvite } from "../../_lib/storage";

type ConsumeInviteRequest = {
  code?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ConsumeInviteRequest;
  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const record = await consumeInvite(code);
  if (!record) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (record.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  return NextResponse.json({ entityId: record.entityId, sealed: record.sealed });
}
