"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function InvitationsPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const pathname = usePathname();

  // Extract language from URL path (e.g., "/en/invitations" -> "en")
  const currentLanguage = pathname.split("/")[1] as "en" | "el";
  const language = currentLanguage === "el" ? "el" : "en";

  const sendInvitation = async () => {
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }

    setSending(true);

    try {
      const supabase = createClient();

      // Get current user
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated");

      const { data: user } = await supabase
        .from("user")
        .select("id")
        .eq("auth_user_id", authData.user.id)
        .single();

      if (!user) throw new Error("User not found");

      const { data: roleRow } = await supabase
        .from("user_company_role")
        .select("company_id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .single();

      if (!roleRow) throw new Error("No company role found");

      // Create invitation
      const { data: invitation, error } = await supabase
        .from("invitation")
        .insert({
          email: email.trim(),
          role: "talent",
          company_id: roleRow.company_id,
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Send email with detected language
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: invitation.id,
          language: language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to send email");
      }

      toast.success("Invitation sent!");
      setEmail("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send invitation";
      toast.error("Failed to send invitation", {
        description: errorMessage,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 mt-14">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendInvitation()}
          className="flex-1"
          disabled={sending}
        />
        <Button onClick={sendInvitation} disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
