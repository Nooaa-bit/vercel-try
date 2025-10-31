//hype-hire/vercel/app/api/password-reset/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

interface VerifyTokenRequest {
  token: string;
  newPassword: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VerifyTokenRequest = await req.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    console.log("🔐 Processing password reset...");

    // Find the token in database and include user
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      console.log("❌ Token not found");
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
      console.log("❌ Token already used");
      return NextResponse.json(
        { code: "TOKEN_USED", error: "This reset link has already been used" },
        { status: 400 }
      );
    }

    console.log("👤 User ID:", resetToken.userId);
    console.log("📧 Auth User ID:", resetToken.user.authUserId);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update password using the authUserId (Supabase UUID)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resetToken.user.authUserId,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      console.error("❌ Failed to update password in Supabase:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    console.log("✅ Password updated in Supabase");

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    console.log("✅ Token marked as used");

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("❌ Password reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
