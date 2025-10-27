import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_NAME_LENGTH = 100;

export async function POST(request: NextRequest) {
  try {
    // ✅ Use regular client to get authenticated user
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const file = formData.get("profilePicture") as File | null;

    // Server-side validation
    if (!firstName?.trim() || firstName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        {
          error: "First name is required and must be less than 100 characters",
        },
        { status: 400 }
      );
    }

    if (!lastName?.trim() || lastName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Last name is required and must be less than 100 characters" },
        { status: 400 }
      );
    }

    let profilePicturePath: string | undefined;
    let profilePictureUrl: string | null = null;

    // Handle file upload if present
    if (file) {
      // Validate file
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Only JPG and PNG images are allowed" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Image must be smaller than 5MB" },
          { status: 400 }
        );
      }

      // Get current profile picture to delete old one
      const currentUser = await prisma.user.findUnique({
        where: { authUserId: user.id },
        select: { profilePicture: true },
      });

      // Use consistent filename (overwrites)
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/profile.${fileExt}`;

      // ✅ NOW use admin client for storage (needs elevated permissions)
      const adminClient = createAdminClient();

      const { error: uploadError } = await adminClient.storage
        .from("profile-pictures")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Delete old file if it exists and is different
      if (
        currentUser?.profilePicture &&
        currentUser.profilePicture !== fileName
      ) {
        await adminClient.storage
          .from("profile-pictures")
          .remove([currentUser.profilePicture]);
      }

      profilePicturePath = fileName;

      // Build public URL for response
      const { data } = adminClient.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);
      profilePictureUrl = data.publicUrl;
    }

    // Update user in database
    await prisma.user.update({
      where: { authUserId: user.id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(profilePicturePath && { profilePicture: profilePicturePath }),
      },
    });

    return NextResponse.json({
      success: true,
      profilePictureUrl,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
