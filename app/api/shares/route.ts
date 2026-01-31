import { NextResponse } from "next/server";

import { getShares, getEntityIdForPasskey } from "../_lib/storage";
import { getServerSession } from "../../lib/session";

export async function GET() {
  const session = await getServerSession();
  if (!session.passkeyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entityId = await getEntityIdForPasskey(session.passkeyId);
  if (!entityId) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const shares = await getShares(entityId);
  return NextResponse.json(shares);
}
