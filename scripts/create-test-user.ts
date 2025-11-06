import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUserConfig {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyId: number;
  role: "talent" | "supervisor" | "company_admin" | "superadmin";
}

async function createTestUser(config: TestUserConfig) {
  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📝 Creating test user: ${config.email}`);
    console.log(`${"=".repeat(60)}`);

    let authUserId: string;

    // ✅ 1. Create auth user with password
    console.log("\n[STEP 1] Creating Supabase auth user...");
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
      });

    if (authError) {
      console.error("❌ Auth user creation failed:", authError);
      return;
    }

    authUserId = authUser.user!.id;
    console.log("✅ Auth user created successfully");
    console.log(`   UUID: ${authUserId}`);

    // ✅ 2. Create or get user profile
    console.log("\n[STEP 2] Creating or retrieving user profile...");

    let userProfile;
    try {
      userProfile = await prisma.user.create({
        data: {
          authUserId,
          email: config.email,
          firstName: config.firstName,
          lastName: config.lastName,
        },
      });
      console.log("✅ User profile created successfully");
    } catch (error: any) {
      // If user already exists, just fetch it
      if (
        error.code === "P2002" &&
        error.meta?.target?.includes("auth_user_id")
      ) {
        console.log("⚠️  User already exists, retrieving existing profile...");
        userProfile = await prisma.user.findUnique({
          where: { authUserId },
        });
      } else if (
        error.code === "P2002" &&
        error.meta?.target?.includes("email")
      ) {
        console.log("⚠️  Email already exists, retrieving existing profile...");
        userProfile = await prisma.user.findUnique({
          where: { email: config.email },
        });
      } else {
        console.error("❌ User profile creation failed:", error);
        return;
      }
    }

    if (!userProfile) {
      console.error("❌ Could not create or find user profile");
      return;
    }

    console.log(`   ID: ${userProfile.id}`);
    console.log(`   Email: ${userProfile.email}`);

    // ✅ 3. Create user_company_role
    console.log("\n[STEP 3] Creating user_company_role...");

    try {
      const roleData = await prisma.user_company_role.create({
        data: {
          userId: userProfile.id,
          companyId: config.companyId,
          role: config.role,
        },
      });

      console.log("✅ User role created successfully");
      console.log(`   Role: ${roleData.role}`);
    } catch (error) {
      console.error("❌ User role creation failed");
      console.error("   Error:", error);
      return;
    }

    console.log(`✨ Test user completed successfully!`);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// Add your test users here
const testUsers: TestUserConfig[] = [
  {
    email: "test1-talent@localhost",
    password: "123456",
    firstName: "Talent1",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test2-talent@localhost",
    password: "123456",
    firstName: "Talent2",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test-supervisor@localhost",
    password: "123456",
    firstName: "Supervisor1",
    lastName: "Test",
    companyId: 2,
    role: "supervisor",
  },
];

(async () => {
  console.log("🚀 Creating test users...\n");

  for (const user of testUsers) {
    await createTestUser(user);
  }

  // Verify all created users
  console.log("\n" + "=".repeat(60));
  console.log("📊 Final database verification");
  console.log("=".repeat(60));

  const createdUsers = await prisma.user.findMany({
    where: {
      email: {
        contains: "@localhost",
      },
    },
    include: { userCompanyRoles: true },
  });

  console.log(`\n✅ Total users created: ${createdUsers.length}`);
  createdUsers.forEach((user, index) => {
    console.log(`\n[${index + 1}] ${user.email}`);
    console.log(`    ID: ${user.id}`);
    console.log(`    Roles: ${user.userCompanyRoles.length}`);
    user.userCompanyRoles.forEach((role) => {
      console.log(`      - ${role.role} (Company ID: ${role.companyId})`);
    });
  });

  console.log("\n✅ Done! Users are ready for testing.");
  process.exit(0);
})();
