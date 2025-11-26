// lib/company-users.ts
"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Employee = {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  phoneNumber: string | null; // ✅ Added
  role: string;
  roleId: number;
  joinedAt: Date;
};

// ✅ Simplified version for client-side filtering
export async function getCompanyUsers(companyId: number): Promise<Employee[]> {
  try {
    const whereClause: Prisma.user_company_roleWhereInput = {
      companyId: companyId,
      revokedAt: null,
      user: {
        deletedAt: null,
      },
    };

    const userRoles = await prisma.user_company_role.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            phoneNumber: true, // ✅ Added
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

    const employees = userRoles.map((ur) => ({
      userId: ur.user.id,
      email: ur.user.email,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      profilePicture: ur.user.profilePicture,
      phoneNumber: ur.user.phoneNumber, // ✅ Added
      role: ur.role,
      roleId: ur.id,
      joinedAt: ur.createdAt,
    }));

    return employees;
  } catch (error) {
    console.error("Error fetching company users:", error);
    return [];
  }
}
