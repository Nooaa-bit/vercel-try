import { createClient } from "@/lib/supabase/server";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log("Update profile API called");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", user.id);

    const { firstName, lastName } = await request.json();

    console.log("Updating profile with:", { firstName, lastName });

    await prisma.user.update({
      where: { authUserId: user.id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });

    console.log("Profile updated successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
