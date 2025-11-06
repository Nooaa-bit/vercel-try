import { prisma } from "@/lib/prisma";

(async () => {
  console.log("🔍 Investigating database state...\n");

  // Find all users with that email
  console.log("[1] All users with debug-test@localhost:");
  const users = await prisma.user.findMany({
    where: { email: "debug-test@localhost" },
    include: { userCompanyRoles: true },
  });
  console.log(`Found ${users.length} users:`);
  users.forEach((u, i) => {
    console.log(`  [${i}] ID: ${u.id}, AuthUserId: ${u.authUserId}`);
    console.log(`      Roles: ${u.userCompanyRoles.length}`);
  });

  // Check for duplicate auth_user_ids
  console.log("\n[2] Checking for duplicate auth_user_ids:");
  const allUsers = await prisma.user.findMany();
  const authUserIdCounts: Record<string, number> = {};
  allUsers.forEach((u) => {
    authUserIdCounts[u.authUserId] = (authUserIdCounts[u.authUserId] || 0) + 1;
  });

  Object.entries(authUserIdCounts).forEach(([id, count]) => {
    if (count > 1) {
      console.log(`  ⚠️  AuthUserId ${id} appears ${count} times!`);
    }
  });

  if (Object.values(authUserIdCounts).every((c) => c === 1)) {
    console.log("  ✅ No duplicate auth_user_ids found");
  }

  // Manual cleanup
  console.log("\n[3] Manual cleanup:");
  const deleted = await prisma.user.deleteMany({
    where: { email: "debug-test@localhost" },
  });
  console.log(`   Deleted ${deleted.count} user records`);

  // Reset Prisma client
  console.log("\n[4] Resetting Prisma client...");
  await prisma.$disconnect();
  console.log("   ✅ Done");

  process.exit(0);
})();
