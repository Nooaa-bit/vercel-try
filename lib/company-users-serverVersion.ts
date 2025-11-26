//hype-hire/vercel/lib/company-users-serverVersion.ts
"use server";

import { prisma } from "@/lib/prisma";
import { role, Prisma } from "@prisma/client";

type PaginatedResult = {
  employees: {
    userId: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
    phoneNumber: string | null; // ✅ Added
    role: string;
    roleId: number;
    joinedAt: Date;
  }[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  availableRoles: { role: string; count: number }[];
};

export async function getCompanyUsers(
  companyId: number,
  page: number = 1,
  pageSize: number = 50,
  roleFilter?: string
): Promise<PaginatedResult> {
  try {
    const whereClause: Prisma.user_company_roleWhereInput = {
      companyId: companyId,
      revokedAt: null,
      user: {
        deletedAt: null,
      },
    };

    if (roleFilter && roleFilter !== "all") {
      whereClause.role = roleFilter as role;
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // ✅ OPTIMIZED: Run all queries in parallel
    const [totalCount, userRoles, roleCounts] = await Promise.all([
      prisma.user_company_role.count({ where: whereClause }),

      prisma.user_company_role.findMany({
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
        skip,
        take: pageSize,
      }),

      prisma.user_company_role.groupBy({
        by: ["role"],
        where: {
          companyId: companyId,
          revokedAt: null,
          user: {
            deletedAt: null,
          },
        },
        _count: {
          role: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    const availableRoles = roleCounts.map((rc) => ({
      role: rc.role,
      count: rc._count.role,
    }));

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

    return {
      employees,
      totalCount,
      totalPages,
      currentPage: page,
      availableRoles,
    };
  } catch (error) {
    console.error("Error fetching company users:", error);
    return {
      employees: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      availableRoles: [],
    };
  }
}
