// app/[lang]/dashboard/settings/page.tsx
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsForm from "@/app/[lang]/dashboard/settings/SettingsForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/${lang}/login`);
  }

  const authUserId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { authUserId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      phoneNumber: true,
    },
  });

  if (!user) {
    console.error(`User profile not found for auth user ${authUserId}`);
    redirect(`/${lang}/error?message=profile_not_found`);
  }

  let profilePictureUrl: string | null = null;
  if (user.profilePicture) {
    if (user.profilePicture.startsWith("http")) {
      profilePictureUrl = user.profilePicture;
    } else {
      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(user.profilePicture);
      profilePictureUrl = data.publicUrl;
    }
  }

  const translations = await import(
    `@/translations/${lang}/settings.json`
  ).then((mod) => mod.default);

  return (
    <div className="min-h-screen bg-background p-20">
      {" "}
      {/* ✅ p-8 → p-4 */}
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          {" "}
          {/* ✅ mb-6 → mb-4 */}
          <h1 className="text-3xl font-bold text-foreground">
            {translations.pageTitle}
          </h1>
        </div>

        <SettingsForm
          user={{
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            phoneNumber: user.phoneNumber || "",
            profilePictureUrl: profilePictureUrl,
          }}
        />
      </div>
    </div>
  );
}

// ✅ OPTIONAL: Add revalidation if data doesn't change often
// export const revalidate = 60; // Revalidate every 60 seconds
