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
    console.log(`\n📝 Creating test user: ${config.email}`);

    // ✅ 1. Create auth user with password
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true, // Auto-confirm email
      });

    if (authError) {
      console.error("❌ Auth user creation failed:", authError.message);
      return;
    }

    console.log("✅ Auth user created:", authUser.user?.id);

    // ✅ 2. Create user profile
    let userProfile;
    try {
      userProfile = await prisma.user.create({
        data: {
          authUserId: authUser.user!.id,
          email: config.email,
          firstName: config.firstName,
          lastName: config.lastName,
        },
      });
    } catch (error) {
      console.error("❌ User profile creation failed:", error);
      return;
    }

    console.log("✅ User profile created:", userProfile.id);

    // ✅ 3. Create user_company_role
    try {
      const roleData = await prisma.user_company_role.create({
        data: {
          userId: userProfile.id,
          companyId: config.companyId,
          role: config.role,
        },
      });
      console.log("✅ User role created:", roleData.id);
    } catch (error) {
      console.error("❌ User role creation failed:", error);
      return;
    }

    console.log(`\n✨ Test user created successfully!`);
    console.log(`📧 Email: ${config.email}`);
    console.log(`🔑 Password: ${config.password}`);
    console.log(`👤 Role: ${config.role}`);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// ============================================================
// RUN: npx ts-node scripts/create-test-user.ts
// ============================================================

const testUsers: TestUserConfig[] = [
  {
    email: "test1_Talent@localhost",
    password: "123456",
    firstName: "Talent1",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test2_Talent@localhost",
    password: "123456",
    firstName: "Talent2",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test3_Talent@localhost",
    password: "123456",
    firstName: "Talent3",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test4_Talent@localhost",
    password: "123456",
    firstName: "Talent4",
    lastName: "Test",
    companyId: 2,
    role: "talent",
  },
  {
    email: "test1_Admin@localhost",
    password: "123456",
    firstName: "Admin",
    lastName: "test",
    companyId: 2,
    role: "company_admin",
  },
  {
    email: "test1-supervisor@localhost",
    password: "123456",
    firstName: "Supervisor",
    lastName: "Test",
    companyId: 2,
    role: "supervisor",
  },
];

(async () => {
  console.log("🚀 Creating test users...");
  for (const user of testUsers) {
    await createTestUser(user);
  }
  console.log("\n✅ Done! Users are ready for testing.");
  process.exit(0);
})();
