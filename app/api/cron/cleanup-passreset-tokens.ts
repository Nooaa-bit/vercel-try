//hype-hire/vercel/app/api/cron/cleanup-passreset-tokens.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Verify the cron request is actually from Vercel
function isValidCronRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  // Verify this is a real Vercel cron request
  if (!isValidCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🧹 Starting cleanup of expired password reset tokens...");

    // Delete all tokens older than 24 hours
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(`✅ Deleted ${result.count} expired tokens`);

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Cleanup job failed:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
