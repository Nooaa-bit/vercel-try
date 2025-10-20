"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Trash2, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ============================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================

type Role = "talent" | "supervisor" | "company_admin" | "superadmin";

interface User {
  id: number;
  email: string;
  companyId: number;
  role: Role;
}

interface Draft {
  id: string;
  email: string;
  role: Role;
  warning?: string;
  conflictType?: "member" | "pending" | "expired";
  userId?: number;
  existingRole?: Role;
}

const ROLE_HIERARCHY: Record<Role, Role[]> = {
  talent: ["talent"],
  supervisor: ["talent"],
  company_admin: ["talent", "supervisor", "company_admin"],
  superadmin: ["talent", "supervisor", "company_admin", "superadmin"],
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function InvitationsPage() {
  // ============================================================
  // STATE & SETUP
  // ============================================================

  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);

  // ============================================================
  // USER AUTHENTICATION & DATA LOADING
  // ============================================================

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setLoading(false);
        return;
      }

      const { data: u } = await supabase
        .from("user")
        .select("id, email, auth_user_id")
        .eq("auth_user_id", data.user.id)
        .single();

      const { data: roleRow } = await supabase
        .from("user_company_role")
        .select("role, company_id")
        .eq("user_id", u!.id)
        .is("revoked_at", null)
        .single();

      setUser({
        id: u!.id,
        email: u!.email,
        companyId: roleRow!.company_id,
        role: roleRow!.role,
      });
      setLoading(false);
    })();
  }, []);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const allowedRoles = user ? ROLE_HIERARCHY[user.role] : [];
  const isCompanyAdmin =
    user?.role === "superadmin" || user?.role === "company_admin";
  const problematicDrafts = drafts.filter((d) => d.conflictType);

  // ============================================================
  // DRAFT MANAGEMENT FUNCTIONS
  // ============================================================

  const updateDraft = (id: string, field: "email" | "role", value: string) => {
    setDrafts((d) =>
      d.map((dr) =>
        dr.id === id
          ? {
              ...dr,
              [field]: value,
              warning: undefined,
              conflictType: undefined,
            }
          : dr
      )
    );
  };

  // ============================================================
  // CONFLICT DETECTION LOGIC
  // ============================================================

  const scanDraft = async (draft: Draft): Promise<Draft> => {
    if (!user || !draft.email.includes("@")) return draft;

    // Check if user exists and is already a company member
    const { data: u } = await supabase
      .from("user")
      .select("id")
      .eq("email", draft.email.trim())
      .maybeSingle();

    if (u) {
      const { data: member } = await supabase
        .from("user_company_role")
        .select("role")
        .eq("user_id", u.id)
        .eq("company_id", user.companyId)
        .is("revoked_at", null)
        .maybeSingle();

      if (member) {
        return {
          ...draft,
          warning: isCompanyAdmin
            ? `Already company member with role: ${member.role}`
            : "Already company member",
          conflictType: "member",
          userId: u.id,
          existingRole: member.role as Role,
        };
      }
    }

    // Check for pending or expired invitations
    const { data: invs } = await supabase
      .from("invitation")
      .select("role, status, expires_at")
      .eq("company_id", user.companyId)
      .eq("email", draft.email.trim())
      .in("status", ["pending", "expired"])
      .order("expires_at", { ascending: false })
      .limit(1);

    if (invs?.[0]) {
      const inv = invs[0];
      const isPending = inv.status === "pending";
      const dateStr = new Date(inv.expires_at).toLocaleDateString();
      const warning = isCompanyAdmin
        ? `${isPending ? "Pending" : "Expired"} invitation (${inv.role}) ${
            isPending ? "expires" : "on"
          } ${dateStr}`
        : `${isPending ? "Pending" : "Expired"} invitation`;

      return {
        ...draft,
        warning,
        conflictType: isPending ? "pending" : "expired",
      };
    }

    return draft;
  };

  const scanAll = async () => {
    setSending(true);
    const scanned = await Promise.all(drafts.map(scanDraft));
    setDrafts(scanned);
    const conflicts = scanned.filter((d) => d.conflictType);
    if (conflicts.length > 0) {
      toast.warning("Conflicts detected", {
        description: `${conflicts.length} invitation(s) require attention in Problematic Invitations.`,
      });
    }
    setSending(false);
  };

  // ============================================================
  // SEND OPERATIONS
  // ============================================================

  const sendSingle = async (draft: Draft, force: boolean = false) => {
    if (!user || !draft.email.includes("@")) return;

    // Scan for conflicts if not forcing
    if (!force) {
      const scanned = await scanDraft(draft);
      if (scanned.conflictType) {
        setDrafts((d) => d.map((dr) => (dr.id === draft.id ? scanned : dr)));
        toast.warning("Conflict detected", {
          description: "Use the button in Problematic Invitations to override.",
        });
        return;
      }
    }

    setSending(true);

    // Handle role update for existing members
    if (
      draft.conflictType === "member" &&
      isCompanyAdmin &&
      draft.existingRole !== "superadmin"
    ) {
      const { error } = await supabase
        .from("user_company_role")
        .update({ role: draft.role })
        .eq("user_id", draft.userId!)
        .eq("company_id", user.companyId)
        .is("revoked_at", null);

      if (error) {
        toast.error("Failed to update role", { description: error.message });
      } else {
        toast.success("Role updated", {
          description: `Updated role for ${draft.email}`,
        });
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      }
    }
    // Handle new invitation creation
    else {
      const { error } = await supabase.from("invitation").insert({
        email: draft.email.trim(),
        role: draft.role,
        company_id: user.companyId,
        invited_by: user.id,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: "pending",
      });

      if (error) {
        toast.error("Failed to send invitation", {
          description: error.message,
        });
      } else {
        toast.success("Invitation sent", {
          description: `Sent to ${draft.email}`,
        });
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      }
    }
    setSending(false);
  };

  const sendAll = async () => {
    if (!user) return;
    setSending(true);
    let sent = 0,
      updated = 0,
      skipped = 0;

    // Process all valid drafts
    for (const draft of drafts.filter(
      (d) => d.email.includes("@") && allowedRoles.includes(d.role)
    )) {
      const scanned = await scanDraft(draft);

      if (
        scanned.conflictType === "member" &&
        isCompanyAdmin &&
        scanned.existingRole !== "superadmin"
      ) {
        // Update existing member role
        await supabase
          .from("user_company_role")
          .update({ role: draft.role })
          .eq("user_id", scanned.userId!)
          .eq("company_id", user.companyId)
          .is("revoked_at", null);
        updated++;
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      } else if (!scanned.conflictType) {
        // Create new invitation
        await supabase.from("invitation").insert({
          email: draft.email.trim(),
          role: draft.role,
          company_id: user.companyId,
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          status: "pending",
        });
        sent++;
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      } else {
        skipped++;
      }
    }

    // Show results
    const msgs = [];
    if (sent > 0) msgs.push(`Sent ${sent}`);
    if (updated > 0) msgs.push(`Updated ${updated}`);
    if (msgs.length > 0)
      toast.success("Invitations processed", { description: msgs.join(", ") });
    if (skipped > 0)
      toast.warning(
        `${skipped} skipped - use Problematic Invitations buttons to override`
      );

    setSending(false);
  };

  // ============================================================
  // LOADING & AUTH STATES
  // ============================================================

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user)
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>Not authenticated</AlertDescription>
      </Alert>
    );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ============================================================
          PAGE HEADER
          ============================================================ */}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">New Invitations</h1>
        {/*  <div className="text-sm text-muted-foreground">
          Logged in as:{" "}
          <span className="font-medium text-foreground">{user.email}</span> |
          Company:{" "}
          <span className="font-medium text-foreground">{user.companyId}</span>
        </div> */}
      </div>

      {/* ============================================================
          PROBLEMATIC INVITATIONS CARD
          ============================================================ */}

      {problematicDrafts.length > 0 && (
        <Card className="mb-4 border-secondary bg-secondary/60">
          <CardHeader>
            <h3 className="font-semibold text-destructive dark:text-destructive-foreground">
              Problematic Invitations ({problematicDrafts.length})
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {problematicDrafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-card border border-border rounded p-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-card-foreground">
                      {draft.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {draft.warning}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {draft.conflictType === "member" ? (
                      draft.existingRole !== "superadmin" && isCompanyAdmin ? (
                        <Button
                          onClick={() => sendSingle(draft, true)}
                          disabled={sending}
                          size="sm"
                          variant="outline"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Update Role
                        </Button>
                      ) : isCompanyAdmin ? (
                        <p className="text-sm text-destructive dark:text-destructive-foreground">
                          Cannot update superadmin
                        </p>
                      ) : null
                    ) : (
                      <Button
                        onClick={() => sendSingle(draft, true)}
                        disabled={sending}
                        size="sm"
                        variant="outline"
                      >
                        <Send className="w-3 h-3 mr-1" /> Send Anyway
                      </Button>
                    )}
                    <Button
                      onClick={() =>
                        setDrafts((d) => d.filter((dr) => dr.id !== draft.id))
                      }
                      disabled={sending}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          DRAFTS CARD
          ============================================================ */}

      <Card>
        {/* Card Header - Action Buttons */}
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  setDrafts((d) => [
                    ...d,
                    { id: crypto.randomUUID(), email: "", role: "talent" },
                  ])
                }
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Draft
              </Button>
              <Button
                onClick={scanAll}
                size="sm"
                variant="outline"
                disabled={sending || drafts.length === 0}
              >
                Scan All
              </Button>
              <Button
                onClick={sendAll}
                disabled={sending || drafts.length === 0}
                size="sm"
              >
                <Send className="w-4 h-4 mr-1" /> Send All
              </Button>
            </div>
            <Button
              onClick={() => {
                setDrafts([]);
                toast.success(`Deleted ${drafts.length} draft(s)`);
              }}
              disabled={drafts.length === 0}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete All
            </Button>
          </div>
        </CardHeader>

        {/* Card Content - Draft List */}
        <CardContent className="space-y-4">
          {drafts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No drafts. Click Add Draft to start.
            </p>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div key={draft.id} className="border rounded p-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email"
                      value={draft.email}
                      onChange={(e) =>
                        updateDraft(draft.id, "email", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Select
                      value={draft.role}
                      onValueChange={(v: Role) =>
                        updateDraft(draft.id, "role", v)
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => sendSingle(draft)}
                      disabled={sending || !draft.email.includes("@")}
                      size="icon"
                      variant="outline"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() =>
                        setDrafts((d) => d.filter((dr) => dr.id !== draft.id))
                      }
                      size="icon"
                      variant="outline"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
