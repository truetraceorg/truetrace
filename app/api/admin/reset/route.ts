import { NextResponse } from "next/server";

import { resetAllEntities } from "../../_lib/storage";

export async function POST() {
  await resetAllEntities();
  return NextResponse.json({ ok: true });
}
