import { NextResponse } from "next/server";
import { getServerSession } from "../../lib/session";

export async function GET() {
  const session = await getServerSession();
  return NextResponse.json({ passkeyId: session.passkeyId ?? null });
}

export async function POST(request: Request) {
  const body = await request.json();
  const passkeyId = body.passkeyId?.trim();

  if (!passkeyId) {
    return NextResponse.json({ error: "passkeyId is required" }, { status: 400 });
  }

  const session = await getServerSession();
  session.passkeyId = passkeyId;
  await session.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
