import { createClient } from "@/lib/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

const prisma = new PrismaClient();

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
    },
  });

  async function getProfilePictureUrl(path: string | null) {
    if (!path) return null;

    const supabase = await createClient();
    const { data } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  const profilePictureUrl = user?.profilePicture
    ? await getProfilePictureUrl(user.profilePicture)
    : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Personal Information
          </h1>
        </div>

        <SettingsForm
          user={{
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            profilePictureUrl: profilePictureUrl,
          }}
        />
      </div>
    </div>
  );
}
