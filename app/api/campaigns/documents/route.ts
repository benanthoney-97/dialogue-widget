import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This route has been deprecated. Please submit documents with the /api/campaigns request.",
    },
    { status: 410 }
  );
}
