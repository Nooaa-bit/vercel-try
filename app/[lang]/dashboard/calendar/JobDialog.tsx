"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Job {
  id: number;
  company_id: number;
  location_id: number | null;
  position: string;
  seniority: "junior" | "senior";
  description: string | null;
  workers_needed: number;
  start_date: string;
  end_date: string;
  created_by: number;
}

interface Location {
  id: number;
  name: string;
}

interface JobDialogProps {
  editingJob: Job | null;
  locations: Location[];
  onSave: () => void;
  onCancel: () => void;
  companyId: number;
}

export default function JobDialog({
  editingJob,
  locations,
  onSave,
  onCancel,
  companyId,
}: JobDialogProps) {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [position, setPosition] = useState("");
  const [seniority, setSeniority] = useState<"junior" | "senior">("junior");
  const [description, setDescription] = useState("");
  const [workersNeeded, setWorkersNeeded] = useState("1");
  const [locationId, setLocationId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Populate form if editing
  useEffect(() => {
    if (editingJob) {
      setPosition(editingJob.position);
      setSeniority(editingJob.seniority);
      setDescription(editingJob.description || "");
      setWorkersNeeded(editingJob.workers_needed.toString());
      setLocationId(editingJob.location_id?.toString() || "");
      setStartDate(editingJob.start_date.split("T")[0]);
      setEndDate(editingJob.end_date.split("T")[0]);
    }
  }, [editingJob]);

  const handleSave = async () => {
    if (!position || !startDate || !endDate) {
      toast.error(t("toast.provideName"));
      return;
    }

    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    try {
      if (editingJob) {
        const { error } = await supabase
          .from("job")
          .update({
            position,
            seniority,
            description: description || null,
            workers_needed: parseInt(workersNeeded),
            location_id: locationId ? parseInt(locationId) : null,
            start_date: startDate,
            end_date: endDate,
          })
          .eq("id", editingJob.id);

        if (error) throw error;
        toast.success(t("toast.updateSuccess"));
      } else {
        // Get the user's profile ID (not auth ID)
        const { data: profile, error: profileError } = await supabase
          .from("user")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (profileError || !profile) {
          toast.error("Failed to get user profile");
          setSaving(false);
          return;
        }

        const { error } = await supabase.from("job").insert({
          company_id: companyId,
          position,
          seniority,
          description: description || null,
          workers_needed: parseInt(workersNeeded),
          location_id: locationId ? parseInt(locationId) : null,
          start_date: startDate,
          end_date: endDate,
          created_by: profile.id,
          created_at: now,
        });

        if (error) throw error;
        toast.success(t("toast.createSuccess"));
      }

      onSave();
    } catch (error) {
      console.error("Error saving job:", error);
      toast.error(
        error instanceof Error ? error.message : t("toast.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editingJob ? t("dialog.editTitle") : t("dialog.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editingJob
            ? t("dialog.editDescription")
            : t("dialog.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Position */}
        <div>
          <Label>{t("fields.position")}</Label>
          <Input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder={t("fields.positionPlaceholder")}
          />
        </div>

        {/* Seniority */}
        <div>
          <Label>{t("fields.seniority")}</Label>
          <Select
            value={seniority}
            onValueChange={(value: "junior" | "senior") => setSeniority(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">{t("fields.junior")}</SelectItem>
              <SelectItem value="senior">{t("fields.senior")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div>
          <Label>{t("fields.location")}</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder={t("fields.selectLocation")} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id.toString()}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div>
          <Label>{t("fields.description")}</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("fields.descriptionPlaceholder")}
            className="min-h-[100px]"
          />
        </div>

        {/* Workers Needed */}
        <div>
          <Label>{t("fields.workersNeeded")}</Label>
          <Input
            type="number"
            min="1"
            value={workersNeeded}
            onChange={(e) => setWorkersNeeded(e.target.value)}
          />
        </div>

        {/* Start Date */}
        <div>
          <Label>{t("fields.startDate")}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* End Date */}
        <div>
          <Label>{t("fields.endDate")}</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t("dialog.cancelButton")}
        </Button>
        <Button
          className="bg-pulse-500 hover:bg-pulse-600"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("dialog.saving") : t("dialog.saveButton")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
