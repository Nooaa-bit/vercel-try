//hype-hire/vercel/app/[lang]/dashboard/invitations/page.tsx
"use client";

import { useState, useMemo } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvitations } from "@/app/hooks/useInvitations";
import type { InvitationStatus, Role } from "@/app/hooks/useInvitations";
import { useTranslation } from "react-i18next";

export default function InvitationsPage() {
  const { t, ready } = useTranslation("invitations");
  const {
    user,
    companies,
    loading,
    drafts,
    setDrafts,
    sending,
    activeView,
    setActiveView,
    sentInvitations,
    loadingSentInvitations,
    selectedCompanyId,
    setSelectedCompanyId,
    searchEmail,
    setSearchEmail,
    filterRole,
    setFilterRole,
    filterStatus,
    setFilterStatus,
    allowedRoles,
    isSuperAdmin,
    isRegularUser,
    canManageInvitations,
    problematicDrafts,
    selectedCompany,
    filteredSentInvitations,
    hasActiveFilters,
    updateDraft,
    clearFilters,
    scanAll,
    revokeSentInvitation,
    sendSingle,
    sendAll,
  } = useInvitations();

  const [companySearchOpen, setCompanySearchOpen] = useState(false);

  // ✅ Pagination state for sent invitations
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // ✅ Calculate paginated invitations
  const paginatedSentInvitations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredSentInvitations.slice(startIndex, endIndex);
  }, [filteredSentInvitations, currentPage, pageSize]);

  // ✅ Calculate pagination metadata
  const totalPages = Math.ceil(filteredSentInvitations.length / pageSize);

  // ✅ Reset to page 1 when filters change
  const handleFilterChange = (
    filterType: "email" | "role" | "status",
    value: string
  ) => {
    setCurrentPage(1);
    switch (filterType) {
      case "email":
        setSearchEmail(value);
        break;
      case "role":
        setFilterRole(value as Role | "all");
        break;
      case "status":
        setFilterStatus(value as InvitationStatus);
        break;
    }
  };

  // ✅ Reset to page 1 when clearing filters
  const handleClearFilters = () => {
    setCurrentPage(1);
    clearFilters();
  };

  if (loading || !ready)
    return <p className="p-6">{t("messages.loadingInvitations")}</p>;
  if (!user)
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>{t("messages.notAuthenticated")}</AlertDescription>
      </Alert>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 mt-14">
      {/* Problematic invitations */}
      {!isRegularUser &&
        problematicDrafts.length > 0 &&
        activeView === "draft" && (
          <Card className="mb-4 border-destructive bg-destructive/10">
            <CardHeader>
              <h3 className="font-semibold text-destructive">
                {t("problematic.title")} ({problematicDrafts.length})
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
                            {t("problematic.cannotUpdateSuperadmin")}
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Tabs
                  value={activeView}
                  onValueChange={(v) => setActiveView(v as "draft" | "sent")}
                  className="flex-1"
                >
                  <TabsList>
                    <TabsTrigger value="draft">{t("tabs.drafts")}</TabsTrigger>
                    <TabsTrigger value="sent">{t("tabs.sent")}</TabsTrigger>
                  </TabsList>
                </Tabs>

                {isSuperAdmin && (
                  <Popover
                    open={companySearchOpen}
                    onOpenChange={setCompanySearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={companySearchOpen}
                        className="w-64 justify-between"
                      >
                        {selectedCompany?.name || t("company.select")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0">
                      <Command>
                        <CommandInput
                          placeholder={t("company.searchPlaceholder")}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {t("company.noCompanyFound")}
                          </CommandEmpty>
                          <CommandGroup>
                            {companies.map((company) => (
                              <CommandItem
                                key={company.id}
                                value={company.name}
                                onSelect={() => {
                                  setSelectedCompanyId(company.id);
                                  setCompanySearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCompanyId === company.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {company.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {activeView === "draft" && (
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
                            companyId: isSuperAdmin
                              ? selectedCompanyId || companies[0]?.id
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
                    onClick={() => setDrafts([])}
                    disabled={drafts.length === 0}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> {t("buttons.deleteAll")}
                  </Button>
                </div>
              )}

              {activeView === "sent" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t("filters.searchPlaceholder")}
                        value={searchEmail}
                        onChange={(e) =>
                          handleFilterChange("email", e.target.value)
                        }
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={filterRole}
                      onValueChange={(v) => handleFilterChange("role", v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={t("filters.allRoles")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("filters.allRoles")}
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
                      onValueChange={(v) => handleFilterChange("status", v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t("filters.allStatuses")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("filters.allStatuses")}
                        </SelectItem>
                        <SelectItem value="pending">
                          {t("status.pending")}
                        </SelectItem>
                        <SelectItem value="expired">
                          {t("status.expired")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button
                        onClick={handleClearFilters}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t("buttons.clear")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("pagination.showing")} {paginatedSentInvitations.length}{" "}
                    {t("pagination.of")} {filteredSentInvitations.length}{" "}
                    {t("pagination.invitations")}
                    {filteredSentInvitations.length !==
                      sentInvitations.length &&
                      ` (${t("pagination.filteredFrom")} ${
                        sentInvitations.length
                      } ${t("pagination.total")})`}
                  </p>
                </div>
              )}
            </div>
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
                onClick={() => setDrafts([])}
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
                        <div className="flex gap-2 items-center">
                          {/* ✅ Email Input - Disabled when sending */}
                          <Input
                            placeholder={t("placeholders.email")}
                            value={draft.email}
                            onChange={(e) =>
                              updateDraft(draft.id, "email", e.target.value)
                            }
                            className="flex-1"
                            disabled={draft.status === "sending"}
                          />

                          {/* ✅ Role Select - Disabled when sending */}
                          <Select
                            value={draft.role}
                            onValueChange={(v: Role) =>
                              updateDraft(draft.id, "role", v)
                            }
                            disabled={draft.status === "sending"}
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

                          {/* ✅ Status Indicator - Sending */}
                          {draft.status === "sending" && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                              <span>{t("status.sending")}</span>
                            </div>
                          )}

                          {/* ✅ Status Indicator - Failed */}
                          {draft.status === "failed" && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-600 dark:text-red-400 whitespace-nowrap">
                              <X className="w-4 h-4" />
                              <span>{t("status.failed")}</span>
                            </div>
                          )}

                          {/* ✅ Send Button - Shows spinner when sending */}
                          <Button
                            onClick={() => sendSingle(draft)}
                            disabled={
                              sending ||
                              !draft.email.includes("@") ||
                              draft.status === "sending"
                            }
                            size="icon"
                            variant="outline"
                          >
                            {draft.status === "sending" ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>

                          {/* ✅ Delete Button - Disabled when sending */}
                          <Button
                            onClick={() =>
                              setDrafts((d) =>
                                d.filter((dr) => dr.id !== draft.id)
                              )
                            }
                            disabled={draft.status === "sending"}
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
                    : t("messages.noPendingOrExpired")}
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedSentInvitations.map((invitation) => (
                      <div key={invitation.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-card-foreground">
                              {invitation.email}
                            </p>
                            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                              <span className="capitalize">
                                {t(`roles.${invitation.role}`)}
                              </span>
                              <span className="capitalize">
                                {t("status.pending")}:{" "}
                                <span
                                  className={
                                    invitation.status === "pending"
                                      ? "text-blue-600"
                                      : "text-orange-600"
                                  }
                                >
                                  {t(`status.${invitation.status}`)}
                                </span>
                              </span>
                              <span>
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

                  {totalPages > 1 && (
                    <Card className="mt-4">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {t("pagination.page")} {currentPage}{" "}
                            {t("pagination.of")} {totalPages} •{" "}
                            {t("pagination.showing")}{" "}
                            {(currentPage - 1) * pageSize + 1}-
                            {Math.min(
                              currentPage * pageSize,
                              filteredSentInvitations.length
                            )}{" "}
                            {t("pagination.of")}{" "}
                            {filteredSentInvitations.length}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              {t("buttons.previous")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage((p) =>
                                  Math.min(totalPages, p + 1)
                                )
                              }
                              disabled={currentPage === totalPages}
                            >
                              {t("buttons.next")}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
