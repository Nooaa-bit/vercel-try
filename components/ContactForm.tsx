"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ContactFormProps {
  onSuccess?: () => void;
  submitButtonText?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  translationNamespace?: string;
}

export function ContactForm({
  onSuccess,
  submitButtonText,
  showCancel = false,
  onCancel,
  translationNamespace = "contact-form",
}: ContactFormProps) {
  const { t, ready } = useTranslation(translationNamespace);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate full name
    if (!formData.fullName.trim()) {
      toast.error(t("fullNameRequired"));
      return;
    }

    // Validate email
    if (!formData.email.trim()) {
      toast.error(t("emailRequired"));
      return;
    }

    if (!validateEmail(formData.email)) {
      toast.error(t("emailInvalid"));
      return;
    }

    // Validate message
    if (!formData.message.trim()) {
      toast.error(t("messageRequired"));
      return;
    }

    if (formData.message.trim().length < 10) {
      toast.error(t("messageTooShort"));
      return;
    }

    if (formData.message.length > 1000) {
      toast.error(t("messageTooLong"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || t("errorGeneric"));
        return;
      }

      toast.success(t("success"));
      setFormData({ fullName: "", email: "", message: "" });
      onSuccess?.();
    } catch (error) {
      toast.error(t("errorGeneric"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while translations load
  if (!ready) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          placeholder={t("fullNamePlaceholder")}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="text"
          value={formData.email}
          onChange={handleChange}
          placeholder={t("emailPlaceholder")}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{t("message")}</Label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder={t("messagePlaceholder")}
          className="min-h-[120px]"
          disabled={isSubmitting}
        />
      </div>

      <div className={showCancel ? "flex gap-3 pt-2" : "pt-2"}>
        {showCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            {t("cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={`${
            showCancel ? "flex-1" : "w-full"
          } bg-pulse-500 hover:bg-pulse-600`}
        >
          {isSubmitting ? t("submitting") : submitButtonText || t("submit")}
        </Button>
      </div>
    </form>
  );
}
