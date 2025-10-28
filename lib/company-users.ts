//hype-hire/vercel/lib/company-users.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getCompanyUsers(companyId: number) {
  try {
    // Get all user_company_role records for this company
    const userRoles = await prisma.user_company_role.findMany({
      where: {
        companyId: companyId,
        revokedAt: null, // Only active roles
        user: {
          deletedAt: null, // Only non-deleted users
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true, // ✅ Add profile picture
            createdAt: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    // Transform into a simpler format
    return userRoles.map((ur) => ({
      userId: ur.user.id,
      email: ur.user.email,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      profilePicture: ur.user.profilePicture, // ✅ Include in return
      role: ur.role,
      roleId: ur.id,
      joinedAt: ur.createdAt,
    }));
  } catch (error) {
    console.error("Error fetching company users:", error);
    return [];
  }
}
