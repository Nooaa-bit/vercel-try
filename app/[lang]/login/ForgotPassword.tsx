//hype-hire/vercel/app/[lang]/login/ForgotPassword.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  translations: {
    resetPasswordTitle: string;
    resetPasswordDescription: string;
    emailLabel: string;
    emailPlaceholder: string;
    cancel: string;
    sendResetLink: string;
    sending: string;
    resetEmailSent: string;
    errorEmailRequired: string;
    errorEmailInvalid: string;
    errorSendingReset: string;
  };
}

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  language,
  translations: t,
}: ForgotPasswordDialogProps) {
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const validateEmail = (email: string) => {
    return EMAIL_REGEX.test(email);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail.trim()) {
      toast.error(t.errorEmailRequired);
      return;
    }

    if (!validateEmail(resetEmail)) {
      toast.error(t.errorEmailInvalid);
      return;
    }

    setResetLoading(true);

    try {
      // Call your new API route instead of Supabase
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: resetEmail.toLowerCase().trim(),
          language: language,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || t.errorSendingReset);
        return;
      }

      setResetSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setResetSuccess(false);
        setResetEmail("");
      }, 3000);
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error(t.errorSendingReset);
    } finally {
      setResetLoading(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !resetSuccess) {
      setResetEmail("");
      setResetSuccess(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.resetPasswordTitle}</DialogTitle>
          <DialogDescription>{t.resetPasswordDescription}</DialogDescription>
        </DialogHeader>

        {resetSuccess ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{t.resetEmailSent}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handlePasswordReset} noValidate>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t.emailLabel}</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={resetLoading}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? t.sending : t.sendResetLink}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
