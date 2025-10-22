import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log("Upload API called");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", user.id);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("No file in form data");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("File received:", file.name, file.size, file.type);

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    console.log("Uploading to:", fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log("Buffer created, size:", buffer.length);

    const adminClient = createAdminClient();

    const { error: uploadError } = await adminClient.storage
      .from("profile-pictures")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    console.log("Upload successful, updating database");

    await prisma.user.update({
      where: { authUserId: user.id },
      data: { profilePicture: fileName },
    });

    console.log("Database updated successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in upload API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
