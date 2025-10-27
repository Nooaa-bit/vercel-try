//hype-hire/vercel/lib/email/send-magic-link.ts
import { createAdminClient } from "@/lib/supabase/server"; //bring me that special admin connection to the database that can do anything
import { sendSignInLinkEmail } from "@/lib/email/send-magic-link"; //bring me the function that knows how to send emails
import { NextResponse } from "next/server"; //Give me the tool to send responses back to the user's browser
import type { PostgrestError } from "@supabase/supabase-js"; //Import the blueprint for what database errors look like (just for TypeScript, not actual functionality).

// Simplified interfaces "Here's what user information looks like when I get it from the database."

interface UserData {
  id: number;
  email: string;
  auth_user_id: string;
}

interface UserRoleData {
  role: string;
  company: {
    id: number;
    name: string;
  };
}

//handles POST requests (when someone submits a form). It's async because it has to wait for database operations
export async function POST(request: Request) {
  console.log("🎯 API route called successfully");
  try {
    const { email, language = "en" } = await request.json();
    console.log("🌐 Received language from request:", language); // ✅ Add this debug log

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    console.log("🔍 Checking if user exists:", email);

    // ONLY check if user exists - that's it!
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("id, email, auth_user_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (userError) {
      console.log("❌ Database error:", userError.message);
      return NextResponse.json(
        { success: false, error: "Database error: " + userError.message },
        { status: 500 }
      );
    }

    // If user doesn't exist, reject
    if (!userData) {
      console.log("❌ User not found in database:", email);
      return NextResponse.json(
        {
          success: false,
          error:
            "Only invited team members can use magic links. Please contact your administrator.",
          code: "USER_NOT_FOUND",
        },
        { status: 403 }
      );
    }

    console.log("✅ User found - generating magic link");

    // Generate magic link
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase().trim(),
        options: {
          redirectTo: `${new URL(request.url).origin}/${language}/dashboard`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.log("❌ Magic link generation error:", linkError?.message);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to generate magic link: " +
            (linkError?.message || "Unknown error"),
        },
        { status: 500 }
      );
    }

    // Send simple email (no role complexity)
    const emailResult = await sendSignInLinkEmail({
      to: email,
      magicLink: linkData.properties.action_link,
      companyName: "Your Organization", // Simple default
      role: "team member", // Simple default
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      userType: "existing",
      language: language, 
    });

    return NextResponse.json({
      success: true,
      message: "Sign-in link sent successfully",
      emailSent: true,
      messageId: emailResult.messageId,
    });
  } catch (error) {
    console.error("💥 Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


     

//Bring me the special admin key to my database (Supabase) that has superpowers - it can look up users and create magic links without needing to be logged in


/*
        // Define role hierarchy (highest first)
        const rolePriority = ["superadmin", "admin", "manager", "team member"];

        // Find the highest priority role
        let bestRole = roleData[0];
        for (const role of roleData) {
          const currentIndex = rolePriority.indexOf(role.role);
          const bestIndex = rolePriority.indexOf(bestRole.role);
          if (
            currentIndex !== -1 && //currentIndex !== -1: "Does this role exist in our priority list?"
            (bestIndex === -1 || //"Is the current best role invalid?" (shouldn't happen)
              currentIndex < bestIndex) //Is this role higher priority than our current best?"
          ) {
            bestRole = role;
          }
        }

        primaryRole = bestRole.role || "team member";
        primaryCompany = bestRole.company?.name || "Your Organization";
        companiesCount = roleData.length;

        console.log("✅ Found user roles:", {
          allRoles: roleData,
          selectedRole: bestRole,
          primaryCompany,
          primaryRole,
          companiesCount,
        });
      } else {
        console.log("ℹ️ User has no company roles, using defaults");
      }
    } catch (roleError) {
      console.log("⚠️ Could not fetch roles, using defaults:", roleError);
      // Continue with defaults - this is not a blocking error
    }*/