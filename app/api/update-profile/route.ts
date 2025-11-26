// app/api/update-profile/route.ts
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];
const MAX_NAME_LENGTH = 100;

export async function POST(request: NextRequest) {
  try {
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
    const phoneNumber = formData.get("phoneNumber") as string; // ✅ Get phone number
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

    let profilePictureUrl: string | null = null;

    // Handle file upload if present
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Only JPG, PNG, WebP, and HEIC images are allowed" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Image must be smaller than 10MB" },
          { status: 400 }
        );
      }

      // Get current profile picture to delete old one
      const currentUser = await prisma.user.findUnique({
        where: { authUserId: user.id },
        select: { profilePicture: true },
      });

      // Convert HEIC/HEIF to JPEG, use other formats as-is
      let fileToUpload: Buffer;
      let finalContentType: string;
      let fileExtension: string;

      if (file.type === "image/heic" || file.type === "image/heif") {
        try {
          const buffer = await file.arrayBuffer();
          fileToUpload = await sharp(Buffer.from(buffer))
            .jpeg({ quality: 85 })
            .toBuffer();
          finalContentType = "image/jpeg";
          fileExtension = "jpg";
        } catch (error) {
          console.error("Error converting HEIC:", error);
          return NextResponse.json(
            {
              error: "Failed to process image. Please try a different format.",
            },
            { status: 500 }
          );
        }
      } else {
        const buffer = await file.arrayBuffer();
        fileToUpload = Buffer.from(buffer);
        finalContentType = file.type;
        fileExtension = file.name.split(".").pop() || "jpg";
      }

      const timestamp = Date.now();
      const fileName = `${user.id}/profile-${timestamp}.${fileExtension}`;

      const adminClient = createAdminClient();

      const { error: uploadError } = await adminClient.storage
        .from("profile-pictures")
        .upload(fileName, fileToUpload, {
          contentType: finalContentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Extract old path from URL if it exists (for cleanup)
      let oldFilePath: string | null = null;
      if (currentUser?.profilePicture) {
        if (
          currentUser.profilePicture.includes(
            "/storage/v1/object/public/profile-pictures/"
          )
        ) {
          oldFilePath = currentUser.profilePicture.split(
            "/storage/v1/object/public/profile-pictures/"
          )[1];
        } else {
          oldFilePath = currentUser.profilePicture;
        }
      }

      // Delete old file if it exists
      if (oldFilePath) {
        await adminClient.storage
          .from("profile-pictures")
          .remove([oldFilePath]);
      }

      // Generate and store the full public URL
      const { data } = adminClient.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);
      profilePictureUrl = data.publicUrl;
    }

    // ✅ Update user profile INCLUDING phone number
    await prisma.user.update({
      where: { authUserId: user.id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber?.trim() || null, // ✅ Save phone number (allow empty)
        ...(profilePictureUrl && { profilePicture: profilePictureUrl }),
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
