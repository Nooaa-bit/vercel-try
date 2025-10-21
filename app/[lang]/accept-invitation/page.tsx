"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accept = async () => {
      const token = searchParams.get("token");
      if (!token) {
        router.replace("/?error=no-token");
        return;
      }

      try {
        // Call API to process invitation
        const response = await fetch(`/api/invitations/accept?token=${token}`);

        if (!response.ok) {
          const error = await response.json();
          router.replace(`/?error=${error.message}`);
          return;
        }

        const { hashedToken } = await response.json();

        // Verify OTP to create session
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({
          token_hash: hashedToken,
          type: "magiclink",
        });

        if (error) throw error;

        // Redirect to dashboard
        router.replace("/dashboard");
      } catch (error) {
        console.error(error);
        router.replace("/?error=failed");
      }
    };

    accept();
  }, []);

  return null; // No UI - instant redirect
}
