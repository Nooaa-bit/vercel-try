//hype-hire/vercel/app/[lang]/dashboard/settings/page.tsx
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
    },
  });

  if (!user) {
    console.error(`User profile not found for auth user ${authUserId}`);
    redirect(`/${lang}/error?message=profile_not_found`);
  }

  // ✅ CHANGE: profilePicture now stores full URL, use it directly
  let profilePictureUrl: string | null = null;
  if (user.profilePicture) {
    // Check if it's already a full URL or legacy path format
    if (user.profilePicture.startsWith("http")) {
      // New format: full URL stored in database
      profilePictureUrl = user.profilePicture;
    } else {
      // Legacy format: path stored, generate URL (backward compatibility)
      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(user.profilePicture);
      profilePictureUrl = data.publicUrl;
    }
  }

  // ✅ Get translations on server
  const translations = await import(
    `@/translations/${lang}/settings.json`
  ).then((mod) => mod.default);

  return (
    <div className="min-h-screen bg-background p-20">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {translations.pageTitle}
          </h1>
        </div>

        <SettingsForm
          user={{
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            profilePictureUrl: profilePictureUrl,
          }}
        />
      </div>
    </div>
  );
}
