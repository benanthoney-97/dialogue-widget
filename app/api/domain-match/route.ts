
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Domain matching is disabled for this MVP" },
    { status: 410 }
  );
}
