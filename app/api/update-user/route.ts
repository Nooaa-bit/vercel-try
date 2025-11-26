// app/api/update-user/route.ts
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
    // Get authenticated admin user
    const supabase = await createClient();

    const {
      data: { user: adminAuthUser },
    } = await supabase.auth.getUser();

    if (!adminAuthUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const phoneNumber = formData.get("phoneNumber") as string; // ✅ Get phone number
    const file = formData.get("profilePicture") as File | null;

    // Validate userId is provided
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const targetUserId = parseInt(userId);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Get admin user with their roles
    const adminUser = await prisma.user.findUnique({
      where: { authUserId: adminAuthUser.id },
      select: {
        id: true,
        userCompanyRoles: {
          where: {
            revokedAt: null,
          },
          select: {
            role: true,
            companyId: true,
          },
        },
      },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Check if admin is a superadmin
    const isSuperAdmin = adminUser.userCompanyRoles.some(
      (r) => r.role === "superadmin"
    );

    // Get target user with their roles
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        authUserId: true,
        profilePicture: true,
        userCompanyRoles: {
          where: {
            revokedAt: null,
          },
          select: {
            role: true,
            companyId: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Check if target user is a superadmin
    const targetIsSuperAdmin = targetUser.userCompanyRoles.some(
      (r) => r.role === "superadmin"
    );

    // Permission Logic
    let hasPermission = false;

    if (isSuperAdmin) {
      // Superadmins can edit everyone
      hasPermission = true;
    } else {
      // Company admins cannot edit superadmins
      if (targetIsSuperAdmin) {
        return NextResponse.json(
          { error: "You don't have permission to edit superadmins" },
          { status: 403 }
        );
      }

      // Check if admin has company_admin role
      const adminCompanyAdminRoles = adminUser.userCompanyRoles.filter(
        (r) => r.role === "company_admin"
      );

      if (adminCompanyAdminRoles.length === 0) {
        return NextResponse.json(
          { error: "You don't have admin permissions" },
          { status: 403 }
        );
      }

      // Get company IDs where admin is company_admin
      const adminCompanyIds = adminCompanyAdminRoles.map((r) => r.companyId);

      // Get company IDs where target user works
      const targetCompanyIds = targetUser.userCompanyRoles.map(
        (r) => r.companyId
      );

      // Check if there's any overlap
      hasPermission = adminCompanyIds.some((id) =>
        targetCompanyIds.includes(id)
      );
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to edit this user" },
        { status: 403 }
      );
    }

    // Validate names
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

      // Use target user's authUserId for storage path with timestamp
      const timestamp = Date.now();
      const fileName = `${targetUser.authUserId}/profile-${timestamp}.${fileExtension}`;

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
      if (targetUser.profilePicture) {
        if (
          targetUser.profilePicture.includes(
            "/storage/v1/object/public/profile-pictures/"
          )
        ) {
          oldFilePath = targetUser.profilePicture.split(
            "/storage/v1/object/public/profile-pictures/"
          )[1];
        } else {
          oldFilePath = targetUser.profilePicture;
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

    // ✅ Update target user's profile INCLUDING phone number
    await prisma.user.update({
      where: { id: targetUserId },
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
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
