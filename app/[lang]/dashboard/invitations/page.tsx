"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  Trash2,
  Plus,
  AlertCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ============================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================

type Role = "talent" | "supervisor" | "company_admin" | "superadmin";
type InvitationStatus = "pending" | "expired" | "all";

interface User {
  id: number;
  email: string;
  companyId: number;
  role: Role;
}

interface Company {
  id: number;
  name: string;
}

interface Draft {
  id: string;
  email: string;
  role: Role;
  companyId?: number;
  warning?: string;
  conflictType?: "member" | "pending" | "expired";
  userId?: number;
  existingRole?: Role;
}

interface SentInvitation {
  id: number;
  email: string;
  role: Role;
  status: string;
  expires_at: string;
  invited_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
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

  const { t } = useTranslation("invitation");
  const supabase = createClient();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [activeView, setActiveView] = useState<"draft" | "sent">("draft");
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);
  const [loadingSentInvitations, setLoadingSentInvitations] = useState(false);

  // Extract language from URL path
  const currentLanguage = pathname.split("/")[1] as "en" | "el";
  const language = currentLanguage === "el" ? "el" : "en";

  // Search/Filter state
  const [searchEmail, setSearchEmail] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterStatus, setFilterStatus] = useState<InvitationStatus>("all");

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

      // Load all companies for superadmin
      if (roleRow!.role === "superadmin") {
        const { data: companiesData } = await supabase
          .from("company")
          .select("id, name")
          .order("name");

        setCompanies(companiesData || []);
      }

      setLoading(false);
    })();
  }, []);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const allowedRoles = user ? ROLE_HIERARCHY[user.role] : [];
  const isSuperAdmin = user?.role === "superadmin";
  const isCompanyAdmin = user?.role === "company_admin";
  const isSupervisor = user?.role === "supervisor";
  const isRegularUser = user?.role === "talent" || user?.role === "supervisor";
  const canManageInvitations = isSuperAdmin || isCompanyAdmin;
  const problematicDrafts = drafts.filter((d) => d.conflictType);

  // Filtered sent invitations based on search/filters
  const filteredSentInvitations = sentInvitations.filter((inv) => {
    const matchesEmail =
      searchEmail === "" ||
      inv.email.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesRole = filterRole === "all" || inv.role === filterRole;
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;

    return matchesEmail && matchesRole && matchesStatus;
  });

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  // Remove duplicates based on email + role (and companyId for superadmin)
  const removeDuplicateDrafts = (draftArray: Draft[]): Draft[] => {
    const seen = new Set<string>();
    return draftArray.filter((draft) => {
      const key = isSuperAdmin
        ? `${draft.email.toLowerCase()}-${draft.role}-${draft.companyId}`
        : `${draft.email.toLowerCase()}-${draft.role}`;

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchEmail("");
    setFilterRole("all");
    setFilterStatus("all");
  };

  const hasActiveFilters =
    searchEmail !== "" || filterRole !== "all" || filterStatus !== "all";

  // Fetch sent invitations for the company
  const fetchSentInvitations = async () => {
    if (!user) return;

    setLoadingSentInvitations(true);
    const { data, error } = await supabase
      .from("invitation")
      .select(
        "id, email, role, status, expires_at, invited_by, deleted_at, deleted_by"
      )
      .eq("company_id", user.companyId)
      .is("deleted_at", null)
      .in("status", ["pending", "expired"])
      .order("expires_at", { ascending: false });

    if (error) {
      toast.error(t("toasts.loadFailed"), { description: error.message });
    } else {
      setSentInvitations(data || []);
    }
    setLoadingSentInvitations(false);
  };

  // Load sent invitations when switching to sent view
  useEffect(() => {
    if (activeView === "sent" && canManageInvitations) {
      fetchSentInvitations();
    }
  }, [activeView, user]);

  // Delete/revoke a sent invitation
  const revokeSentInvitation = async (invitationId: number) => {
    if (!user) return;

    const { error } = await supabase
      .from("invitation")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", invitationId);

    if (error) {
      toast.error(t("toasts.revokeFailed"), {
        description: error.message,
      });
    } else {
      toast.success(t("toasts.invitationRevoked"));
      setSentInvitations((prev) =>
        prev.filter((inv) => inv.id !== invitationId)
      );
    }
  };

  // ============================================================
  // DRAFT MANAGEMENT FUNCTIONS
  // ============================================================

  const updateDraft = (
    id: string,
    field: "email" | "role" | "companyId",
    value: string | number
  ) => {
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
  // CONFLICT DETECTION LOGIC (Company Admin Only)
  // ============================================================

  const scanDraft = async (draft: Draft): Promise<Draft> => {
    if (!user || !draft.email.includes("@")) return draft;

    // Regular users don't need conflict detection
    if (isRegularUser) {
      return draft;
    }

    const targetCompanyId = isSuperAdmin
      ? draft.companyId || user.companyId
      : user.companyId;

    // Check if user exists and is a member of the target company
    const { data: existingUser } = await supabase
      .from("user")
      .select("id")
      .eq("email", draft.email.trim())
      .maybeSingle();

    if (existingUser) {
      const { data: companyMember } = await supabase
        .from("user_company_role")
        .select("role")
        .eq("user_id", existingUser.id)
        .eq("company_id", targetCompanyId)
        .is("revoked_at", null)
        .maybeSingle();

      if (companyMember) {
        return {
          ...draft,
          warning: t("warnings.alreadyMember", {
            role: t(`roles.${companyMember.role}`),
          }),
          conflictType: "member",
          userId: existingUser.id,
          existingRole: companyMember.role as Role,
        };
      }
    }

    // Check for existing invitations
    const { data: existingInvitations } = await supabase
      .from("invitation")
      .select("role, status, expires_at")
      .eq("company_id", targetCompanyId)
      .eq("email", draft.email.trim())
      .is("deleted_at", null)
      .in("status", ["pending", "expired"])
      .order("expires_at", { ascending: false })
      .limit(1);

    if (existingInvitations?.[0]) {
      const inv = existingInvitations[0];
      const isPending = inv.status === "pending";
      const dateStr = new Date(inv.expires_at).toLocaleDateString();
      const warningKey = isPending
        ? "warnings.pendingInvitation"
        : "warnings.expiredInvitation";

      return {
        ...draft,
        warning: t(warningKey, {
          role: t(`roles.${inv.role}`),
          date: dateStr,
        }),
        conflictType: isPending ? "pending" : "expired",
      };
    }

    return draft;
  };

  const scanAll = async () => {
    setSending(true);

    // First remove duplicates
    const uniqueDrafts = removeDuplicateDrafts(drafts);
    if (uniqueDrafts.length < drafts.length) {
      const removed = drafts.length - uniqueDrafts.length;
      const key =
        removed === 1
          ? "toasts.duplicatesRemoved"
          : "toasts.duplicatesRemoved_plural";
      toast.info(t(key, { count: removed }));
    }

    const scanned = await Promise.all(uniqueDrafts.map(scanDraft));
    setDrafts(scanned);

    const conflicts = scanned.filter((d) => d.conflictType);
    if (conflicts.length > 0) {
      toast.warning(t("toasts.conflictsDetected"), {
        description: t("toasts.conflictsDescription", {
          count: conflicts.length,
        }),
      });
    } else {
      toast.success(t("toasts.allClear"), {
        description: t("toasts.allClearDescription"),
      });
    }
    setSending(false);
  };

  // ============================================================
  // SEND OPERATIONS
  // ============================================================

  const sendSingle = async (draft: Draft, force: boolean = false) => {
    if (!user || !draft.email.includes("@")) return;

    const targetCompanyId = isSuperAdmin
      ? draft.companyId || user.companyId
      : user.companyId;

    // For company admins: scan for conflicts if not forcing
    if (!isRegularUser && !force) {
      const scanned = await scanDraft(draft);
      if (scanned.conflictType) {
        setDrafts((d) => d.map((dr) => (dr.id === draft.id ? scanned : dr)));
        toast.warning(t("toasts.conflictDetected"), {
          description: t("toasts.conflictDescription"),
        });
        return;
      }
    }

    // For regular users: check if already a member, provide feedback
    if (isRegularUser) {
      const { data: existingUser } = await supabase
        .from("user")
        .select("id")
        .eq("email", draft.email.trim())
        .maybeSingle();

      if (existingUser) {
        const { data: companyMember } = await supabase
          .from("user_company_role")
          .select("role")
          .eq("user_id", existingUser.id)
          .eq("company_id", targetCompanyId)
          .is("revoked_at", null)
          .maybeSingle();

        if (companyMember) {
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
          toast.info(t("toasts.alreadyMemberTitle"), {
            description: t("toasts.alreadyMemberDescription", {
              email: draft.email,
            }),
          });
          return;
        }
      }
    }

    setSending(true);

    // Handle role update for existing members (admin only)
    if (
      draft.conflictType === "member" &&
      !isRegularUser &&
      draft.existingRole !== "superadmin" &&
      force
    ) {
      const { error } = await supabase
        .from("user_company_role")
        .update({ role: draft.role })
        .eq("user_id", draft.userId!)
        .eq("company_id", targetCompanyId)
        .is("revoked_at", null);

      if (error) {
        toast.error(t("toasts.roleUpdateFailed"), {
          description: error.message,
        });
      } else {
        toast.success(t("toasts.roleUpdated"), {
          description: t("toasts.roleUpdatedDescription", {
            email: draft.email,
          }),
        });
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      }
    }
    // Handle new invitation creation
    else {
      const { data: invitation, error } = await supabase
        .from("invitation")
        .insert({
          email: draft.email.trim(),
          role: draft.role,
          company_id: targetCompanyId,
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        toast.error(t("toasts.invitationFailed"), {
          description: error.message,
        });
      } else if (invitation) {
        // Send email via API
        try {
          const response = await fetch("/api/invitations/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invitationId: invitation.id,
              language: language,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to send email");
          }

          toast.success(t("toasts.invitationSent"), {
            description: t("toasts.invitationSentDescription", {
              email: draft.email,
            }),
          });
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          toast.warning(t("toasts.invitationSent"), {
            description: t("toasts.invitationSentDescription", {
              email: draft.email,
            }),
          });
        }
      }
    }
    setSending(false);
  };

  const sendAll = async () => {
    if (!user) return;
    setSending(true);

    // Remove duplicates first
    const uniqueDrafts = removeDuplicateDrafts(drafts);
    if (uniqueDrafts.length < drafts.length) {
      const removed = drafts.length - uniqueDrafts.length;
      const key =
        removed === 1
          ? "toasts.duplicatesRemoved"
          : "toasts.duplicatesRemoved_plural";
      toast.info(t(key, { count: removed }));
      setDrafts(uniqueDrafts);
    }

    const validDrafts = uniqueDrafts.filter(
      (d) => d.email.includes("@") && allowedRoles.includes(d.role)
    );

    // Regular users: simple flow without conflict detection UI
    if (isRegularUser) {
      let sent = 0;
      let skipped = 0;

      for (const draft of validDrafts) {
        const targetCompanyId = user.companyId;

        // Check if already a member
        const { data: existingUser } = await supabase
          .from("user")
          .select("id")
          .eq("email", draft.email.trim())
          .maybeSingle();

        if (existingUser) {
          const { data: companyMember } = await supabase
            .from("user_company_role")
            .select("role")
            .eq("user_id", existingUser.id)
            .eq("company_id", targetCompanyId)
            .is("revoked_at", null)
            .maybeSingle();

          if (companyMember) {
            skipped++;
            continue;
          }
        }

        // Create invitation
        const { data: invitation, error } = await supabase
          .from("invitation")
          .insert({
            email: draft.email.trim(),
            role: draft.role,
            company_id: targetCompanyId,
            invited_by: user.id,
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            status: "pending",
          })
          .select()
          .single();

        if (!error && invitation) {
          // Send email via API
          try {
            await fetch("/api/invitations/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invitationId: invitation.id,
                language: language,
              }),
            });
            sent++;
          } catch (emailError) {
            console.error("Email sending error:", emailError);
            sent++;
          }
        }
      }

      setDrafts([]);
      setSending(false);

      const messages = [];
      if (sent > 0) {
        const key = sent === 1 ? "toasts.sent" : "toasts.sent_plural";
        messages.push(t(key, { count: sent }));
      }
      if (skipped > 0) {
        const key = skipped === 1 ? "toasts.skipped" : "toasts.skipped_plural";
        messages.push(t(key, { count: skipped }));
      }

      if (messages.length > 0) {
        toast.success(t("toasts.invitationsProcessed"), {
          description: messages.join(". "),
        });
      } else {
        toast.info(t("toasts.noInvitationsToSend"));
      }
      return;
    }

    // Company admins and superadmins: scan first, then separate
    const scannedDrafts = await Promise.all(validDrafts.map(scanDraft));
    const cleanDrafts = scannedDrafts.filter((d) => !d.conflictType);
    const problematicFound = scannedDrafts.filter((d) => d.conflictType);

    // Update state to show problematic invitations
    if (problematicFound.length > 0) {
      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          const scanned = scannedDrafts.find((s) => s.id === draft.id);
          return scanned || draft;
        })
      );
    }

    let sent = 0;

    // Send clean invitations
    for (const draft of cleanDrafts) {
      const targetCompanyId = isSuperAdmin
        ? draft.companyId || user.companyId
        : user.companyId;

      const { data: invitation, error } = await supabase
        .from("invitation")
        .insert({
          email: draft.email.trim(),
          role: draft.role,
          company_id: targetCompanyId,
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (!error && invitation) {
        // Send email via API
        try {
          await fetch("/api/invitations/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invitationId: invitation.id,
              language: language,
            }),
          });
          sent++;
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          sent++;
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
        }
      }
    }

    setSending(false);

    if (sent > 0 && problematicFound.length === 0) {
      const key =
        sent === 1
          ? "toasts.allInvitationsSentDescription"
          : "toasts.allInvitationsSentDescription_plural";
      toast.success(t("toasts.allInvitationsSent"), {
        description: t(key, { count: sent }),
      });
    } else if (sent > 0 && problematicFound.length > 0) {
      toast.success(t("toasts.partialSuccess"), {
        description: t("toasts.partialSuccessDescription", {
          sent: sent,
          problematic: problematicFound.length,
        }),
      });
    } else if (problematicFound.length > 0 && sent === 0) {
      toast.warning(t("toasts.conflictsWarning"), {
        description: t("toasts.conflictsWarningDescription", {
          count: problematicFound.length,
        }),
      });
    } else {
      toast.info(t("toasts.noInvitationsToSend"));
    }
  };

  // ============================================================
  // LOADING & AUTH STATES
  // ============================================================

  if (loading) return <p className="p-6">{t("messages.loading")}</p>;
  if (!user)
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>{t("messages.notAuthenticated")}</AlertDescription>
      </Alert>
    );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="max-w-4xl mx-auto p-6 mt-14">
      {/* Problematic invitations */}
      {!isRegularUser &&
        problematicDrafts.length > 0 &&
        activeView === "draft" && (
          <Card className="mb-4 border-destructive bg-destructive/10">
            <CardHeader>
              <h3 className="font-semibold text-destructive">
                {t("sections.problematicInvitations")} (
                {problematicDrafts.length})
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
                        draft.existingRole !== "superadmin" ? (
                          <Button
                            onClick={() => sendSingle(draft, true)}
                            disabled={sending}
                            size="sm"
                            variant="outline"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />{" "}
                            {t("buttons.updateRole")}
                          </Button>
                        ) : (
                          <p className="text-sm text-destructive">
                            {t("messages.cannotUpdateSuperadmin")}
                          </p>
                        )
                      ) : (
                        <Button
                          onClick={() => sendSingle(draft, true)}
                          disabled={sending}
                          size="sm"
                          variant="outline"
                        >
                          <Send className="w-3 h-3 mr-1" />{" "}
                          {t("buttons.sendAnyway")}
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

      <Card>
        <CardHeader>
          {canManageInvitations ? (
            <Tabs
              value={activeView}
              onValueChange={(v) => setActiveView(v as "draft" | "sent")}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="draft">{t("tabs.drafts")}</TabsTrigger>
                <TabsTrigger value="sent">{t("tabs.sent")}</TabsTrigger>
              </TabsList>

              <TabsContent value="draft" className="mt-0">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        setDrafts((d) => [
                          ...d,
                          {
                            id: crypto.randomUUID(),
                            email: "",
                            role: "talent",
                            companyId: isSuperAdmin
                              ? companies[0]?.id
                              : user.companyId,
                          },
                        ])
                      }
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" /> {t("buttons.addDraft")}
                    </Button>
                    {!isRegularUser && (
                      <Button
                        onClick={scanAll}
                        size="sm"
                        variant="outline"
                        disabled={sending || drafts.length === 0}
                      >
                        {t("buttons.scanAll")}
                      </Button>
                    )}
                    <Button
                      onClick={sendAll}
                      disabled={sending || drafts.length === 0}
                      size="sm"
                    >
                      <Send className="w-4 h-4 mr-1" /> {t("buttons.sendAll")}
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      const count = drafts.length;
                      setDrafts([]);
                      if (count > 0) {
                        const key =
                          count === 1
                            ? "toasts.draftsDeleted"
                            : "toasts.draftsDeleted_plural";
                        toast.success(t(key, { count }));
                      }
                    }}
                    disabled={drafts.length === 0}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> {t("buttons.deleteAll")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sent" className="mt-0">
                <div className="mb-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t("placeholders.searchEmail")}
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={filterRole}
                      onValueChange={(v) => setFilterRole(v as Role | "all")}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={t("placeholders.allRoles")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("placeholders.allRoles")}
                        </SelectItem>
                        {allowedRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filterStatus}
                      onValueChange={(v) =>
                        setFilterStatus(v as InvitationStatus)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue
                          placeholder={t("placeholders.allStatuses")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("statuses.all")}</SelectItem>
                        <SelectItem value="pending">
                          {t("statuses.pending")}
                        </SelectItem>
                        <SelectItem value="expired">
                          {t("statuses.expired")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button onClick={clearFilters} variant="ghost" size="sm">
                        <X className="w-4 h-4 mr-1" />
                        {t("buttons.clear")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("labels.showing")} {filteredSentInvitations.length}{" "}
                    {t("labels.of")} {sentInvitations.length}{" "}
                    {t("messages.invitations")}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    setDrafts((d) => [
                      ...d,
                      {
                        id: crypto.randomUUID(),
                        email: "",
                        role: "talent",
                        companyId: user.companyId,
                      },
                    ])
                  }
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("buttons.addDraft")}
                </Button>
                <Button
                  onClick={sendAll}
                  disabled={sending || drafts.length === 0}
                  size="sm"
                >
                  <Send className="w-4 h-4 mr-1" /> {t("buttons.sendAll")}
                </Button>
              </div>
              <Button
                onClick={() => {
                  const count = drafts.length;
                  setDrafts([]);
                  if (count > 0) {
                    const key =
                      count === 1
                        ? "toasts.draftsDeleted"
                        : "toasts.draftsDeleted_plural";
                    toast.success(t(key, { count }));
                  }
                }}
                disabled={drafts.length === 0}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="w-3 h-3 mr-1" /> {t("buttons.deleteAll")}
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {activeView === "draft" && (
            <>
              {drafts.filter((d) => !d.conflictType).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t("messages.noDrafts")}
                </p>
              ) : (
                <div className="space-y-3">
                  {drafts
                    .filter((d) => !d.conflictType)
                    .map((draft) => (
                      <div key={draft.id} className="border rounded p-3">
                        <div className="flex gap-2">
                          {isSuperAdmin && (
                            <Select
                              value={
                                draft.companyId?.toString() ||
                                companies[0]?.id.toString()
                              }
                              onValueChange={(v) =>
                                updateDraft(draft.id, "companyId", parseInt(v))
                              }
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue
                                  placeholder={t("placeholders.selectCompany")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map((company) => (
                                  <SelectItem
                                    key={company.id}
                                    value={company.id.toString()}
                                  >
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <Input
                            placeholder={t("placeholders.email")}
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
                                  {t(`roles.${r}`)}
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
                              setDrafts((d) =>
                                d.filter((dr) => dr.id !== draft.id)
                              )
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
            </>
          )}

          {activeView === "sent" && canManageInvitations && (
            <>
              {loadingSentInvitations ? (
                <p className="text-center text-muted-foreground py-8">
                  {t("messages.loadingInvitations")}
                </p>
              ) : filteredSentInvitations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters")
                    : t("messages.noInvitations")}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredSentInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-card-foreground">
                            {invitation.email}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span>
                              {t("labels.role")}:{" "}
                              {t(`roles.${invitation.role}`)}
                            </span>
                            <span>
                              {t("labels.status")}:{" "}
                              <span
                                className={
                                  invitation.status === "pending"
                                    ? "text-blue-600"
                                    : "text-orange-600"
                                }
                              >
                                {t(`statuses.${invitation.status}`)}
                              </span>
                            </span>
                            <span>
                              {t("labels.expires")}:{" "}
                              {new Date(
                                invitation.expires_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => revokeSentInvitation(invitation.id)}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t("buttons.revoke")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
