// app/api/debug-log/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, data, timestamp } = body;

    // ✅ This will appear in your VS Code terminal
    console.log(
      `[${timestamp}] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in debug-log:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
