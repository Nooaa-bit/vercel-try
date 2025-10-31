//hype-hire/vercel/app/api/password-reset/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ValidateTokenRequest {
  token: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ValidateTokenRequest = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Validating password reset token...");

    // Find the token in database
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      console.log("❌ Token not found in database");
      return NextResponse.json(
        { code: "TOKEN_NOT_FOUND", error: "Invalid reset link" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      console.log("❌ Token has expired");
      return NextResponse.json(
        { code: "TOKEN_EXPIRED", error: "Reset link has expired" },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (resetToken.usedAt) {
      console.log("❌ Token has already been used");
      return NextResponse.json(
        { code: "TOKEN_USED", error: "This reset link has already been used" },
        { status: 400 }
      );
    }

    console.log("✅ Token is valid");

    return NextResponse.json({
      success: true,
      message: "Token is valid",
    });
  } catch (error) {
    console.error("❌ Token validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
