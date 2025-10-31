import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendForgotPasswordEmail } from "@/lib/email/send-forgot-password";
import { randomBytes } from "crypto";

interface ResetPasswordRequest {
  email: string;
  language?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body: ResetPasswordRequest = await req.json();
    const { email, language = "en" } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log("📧 Password reset requested for:", normalizedEmail);
    console.log("🌐 Language:", language);

    // Get user from YOUR database to find Supabase ID
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.log("❌ User not found");
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const userId = user.id; // Your Supabase ID stored in Prisma
    console.log("👤 User ID found:", userId);

    // Generate a secure token (32 bytes = 256 bits, hex encoded = 64 chars)
    const token = randomBytes(32).toString("hex");

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log("🔐 Generated token for password reset");

    // Store token in database WITH user ID
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        userId: userId,
        token,
        expiresAt,
      },
    });

    console.log("✅ Token stored in database, expires at:", expiresAt);

    // Build the reset link
const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/${language}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log("🔗 Reset link:", resetLink);

    // Send email via Brevo
    await sendForgotPasswordEmail({
      to: normalizedEmail,
      resetLink,
      expiresAt: expiresAt.toISOString(),
      language,
      companyName: "Hype Hire",
    });

    console.log("📤 Password reset email sent successfully");

    return NextResponse.json({
      success: true,
      message: "Password reset link sent to email",
    });
  } catch (error) {
    console.error("❌ Password reset error:", error);

    // Don't expose internal errors to client
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }

    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
