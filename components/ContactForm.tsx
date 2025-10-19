//hype-hire/vercel/components/ContactForm.tsx
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
  const { t } = useTranslation(translationNamespace);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email) {
      toast.error(t("requiredError"));
      return;
    }

    if (!formData.message || formData.message.length < 10) {
      toast.error(t("messageError"));
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

  const handleInvalidFullName = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.validity.valueMissing) {
      input.setCustomValidity(t("fullNameRequired"));
    }
  };

  const handleInvalidEmail = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.validity.valueMissing) {
      input.setCustomValidity(t("emailRequired"));
    } else if (input.validity.typeMismatch) {
      input.setCustomValidity(t("emailInvalid"));
    }
  };

  const handleInvalidMessage = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const input = e.currentTarget;
    if (input.validity.valueMissing) {
      input.setCustomValidity(t("messageRequired"));
    } else if (input.validity.tooShort) {
      input.setCustomValidity(t("messageTooShort"));
    }
  };

  const clearValidity = (
    e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    e.currentTarget.setCustomValidity("");
  };

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
          onInvalid={handleInvalidFullName}
          onInput={clearValidity}
          placeholder={t("fullNamePlaceholder")}
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          onInvalid={handleInvalidEmail}
          onInput={clearValidity}
          placeholder={t("emailPlaceholder")}
          required
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
          onInvalid={handleInvalidMessage}
          onInput={clearValidity}
          placeholder={t("messagePlaceholder")}
          className="min-h-[120px]"
          minLength={10}
          maxLength={1000}
          required
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
