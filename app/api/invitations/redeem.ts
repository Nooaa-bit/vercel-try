import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma"; // your prisma instance
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin client (with service role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This is the admin key
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token } = req.body;

    // 1. Validate the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.redeemedAt) {
      return res.status(400).json({ error: "Invitation already used" });
    }

    if (invitation.deletedAt) {
      return res.status(400).json({ error: "Invitation has been revoked" });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ error: "Invitation has expired" });
    }

    // 2. Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    let isNewUser = false;

    // 3. If user doesn't exist, create them
    if (!user) {
      isNewUser = true;

      // Create auth user in Supabase
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: invitation.email,
          email_confirm: true, // Auto-confirm email
        });

      if (authError || !authUser.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      // Create user in our database
      user = await prisma.user.create({
        data: {
          authUserId: authUser.user.id,
          email: invitation.email,
          hasPassword: false,
        },
      });
    }

    // 4. Use transaction to update invitation and create role
    await prisma.$transaction(async (tx) => {
      // Update invitation as redeemed
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          redeemedAt: new Date(),
          status: "accepted",
        },
      });

      // Create user-company-role relationship
      await tx.user_company_role.create({
        data: {
          userId: user!.id,
          companyId: invitation.companyId,
          role: invitation.role,
        },
      });
    });

    res.status(200).json({
      success: true,
      isNewUser,
      userId: user.id,
      message: isNewUser
        ? "Account created and invitation accepted"
        : "Invitation accepted",
    });
  } catch (error) {
    console.error("Error redeeming invitation:", error);
    res.status(500).json({ error: "Failed to redeem invitation" });
  }
}
