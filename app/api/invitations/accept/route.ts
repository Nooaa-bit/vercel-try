import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "no-token" }, { status: 400 });
    }

    // 1. Validate invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    if (invitation.redeemedAt) {
      return NextResponse.json({ error: "already-used" }, { status: 400 });
    }

    if (invitation.deletedAt) {
      return NextResponse.json({ error: "revoked" }, { status: 400 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }

    // 2. Find or create auth user
    let authUserId: string;

    const { data: authListData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authListData.users.find(
      (u) => u.email === invitation.email
    );

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
    } else {
      const { data: newAuthUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email: invitation.email,
          email_confirm: true,
        });

      if (error || !newAuthUser.user) {
        throw new Error(`Auth creation failed: ${error?.message}`);
      }

      authUserId = newAuthUser.user.id;
    }

    // 3. Find or create database user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: invitation.email }, { authUserId: authUserId }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          authUserId: authUserId,
          email: invitation.email,
          hasPassword: false,
        },
      });
    }

    // 4. Update invitation and create role
    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          redeemedAt: new Date(),
          status: "accepted",
        },
      });

      const existingRole = await tx.user_company_role.findFirst({
        where: {
          userId: user!.id,
          companyId: invitation.companyId,
          role: invitation.role,
        },
      });

      if (!existingRole) {
        await tx.user_company_role.create({
          data: {
            userId: user!.id,
            companyId: invitation.companyId,
            role: invitation.role,
          },
        });
      }
    });

    // 5. Generate hashed token for verification
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: invitation.email,
      });

    if (linkError || !linkData) {
      throw new Error(`Token generation failed: ${linkError?.message}`);
    }

    return NextResponse.json({
      hashedToken: linkData.properties.hashed_token,
    });
  } catch (error) {
    console.error("Invitation error:", error);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
