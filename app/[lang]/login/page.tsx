import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const validLang = (lang === 'en' || lang === 'el') ? lang : 'en';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${validLang}/dashboard`);
  }

  async function signInWithGoogle() {
    "use server";

    const supabase = await createClient();
    const headersList = await headers();
    const origin = headersList.get("origin") || headersList.get("host");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/${validLang}/dashboard`,
      },
    });

    if (error) {
      console.error("OAuth error:", error);
      return;
    }

    if (data.url) {
      redirect(data.url);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
