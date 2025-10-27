"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, Lock, Sparkles, CheckCircle } from "lucide-react";

// Email validation regex as a constant (fix for overengineering)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { t, i18n, ready } = useTranslation("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Initialize activeTab from sessionStorage, default to "password"
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("loginTab") || "password";
    }
    return "password";
  });

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Persist activeTab to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("loginTab", activeTab);
    }
  }, [activeTab]);

  const validateEmail = (email: string) => {
    return EMAIL_REGEX.test(email);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Manual validation
    if (!email.trim()) {
      toast.error(t("errorEmailRequired"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("errorEmailInvalid"));
      return;
    }

    if (!password.trim()) {
      toast.error(t("errorPasswordRequired"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        router.push(`/${i18n.language}/dashboard`);
      }
    } catch (err) {
      toast.error(t("errorLoginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    // Manual validation
    if (!email.trim()) {
      toast.error(t("errorEmailRequired"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("errorEmailInvalid"));
      return;
    }

    setLoading(true);

    try {
      const currentLanguage = i18n.language;
      console.log("🚀 Submitting with current language:", currentLanguage);

      const response = await fetch("/api/magic_link_to_existing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          language: currentLanguage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "USER_NOT_FOUND") {
          toast.error(t("errorUserNotInvited"));
        } else {
          toast.error(result.error || t("errorMagicLinkFailed"));
        }
        return;
      }

      console.log("✅ Magic link sent via your API:", result);
      setMagicLinkSent(true);
    } catch (err) {
      console.error("Magic link error:", err);
      toast.error(t("errorMagicLinkFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      toast.error(t("errorSocialLoginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Manual validation
    if (!resetEmail.trim()) {
      toast.error(t("errorEmailRequired"));
      return;
    }

    if (!validateEmail(resetEmail)) {
      toast.error(t("errorEmailInvalid"));
      return;
    }

    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/${i18n.language}/reset-password`,
        }
      );

      if (error) throw error;

      setResetSuccess(true);
      setTimeout(() => {
        setShowResetDialog(false);
        setResetSuccess(false);
        setResetEmail("");
      }, 3000);
    } catch (err) {
      toast.error(t("errorSendingReset"));
    } finally {
      setResetLoading(false);
    }
  };

  // Loading skeleton while translations load
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg shadow-elegant">
          <CardHeader className="text-center space-y-2">
            <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-pulse-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-pulse-500" />
            </div>
            <CardTitle className="text-2xl">{t("checkEmail")}</CardTitle>
            <CardDescription>
              {t("sentMagicLink")} <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>{t("clickLink")}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
            >
              {t("tryDifferentEmail")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-display">
            {t("welcomeBack")}
          </CardTitle>
          <CardDescription>{t("chooseSignIn")}</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={activeTab}
            className="space-y-6"
            onValueChange={setActiveTab}
          >
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger
                value="password"
                className="flex items-center gap-2 whitespace-normal h-auto py-2"
              >
                <Lock className="h-4 w-4 flex-shrink-0" />
                <span className="text-center">{t("password")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="magic"
                className="flex items-center gap-2 whitespace-normal h-auto py-2"
              >
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span className="text-center">{t("magicLink")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="social"
                className="flex items-center gap-2 whitespace-normal h-auto py-2"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="text-center">{t("social")}</span>
              </TabsTrigger>
            </TabsList>

            {/* Password Login */}
            <TabsContent value="password" className="space-y-4">
              <form
                onSubmit={handlePasswordLogin}
                noValidate
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="focus-visible:ring-pulse-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("passwordLabel")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                    className="focus-visible:ring-pulse-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-pulse-500 hover:bg-pulse-600"
                  disabled={loading}
                >
                  {loading ? t("signingIn") : t("signInPassword")}
                </Button>
              </form>
            </TabsContent>

            {/* Magic Link Login */}
            <TabsContent value="magic" className="space-y-4">
              <form onSubmit={handleMagicLink} noValidate className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">{t("email")}</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="focus-visible:ring-pulse-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-pulse-500 hover:from-purple-600 hover:to-pulse-600"
                  disabled={loading}
                >
                  {loading ? t("checkingAccess") : t("sendMagicLink")}
                </Button>
              </form>
            </TabsContent>

            {/* Social Login */}
            <TabsContent value="social" className="space-y-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSocialLogin("google")}
                  disabled={loading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t("continueGoogle")}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSocialLogin("facebook")}
                  disabled={loading}
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="#1877F2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {t("continueFacebook")}
                </Button>
              </div>

              <Alert className="border-pulse-200 bg-pulse-50 dark:border-pulse-700 dark:bg-pulse-900">
                <Badge variant="outline" className="mb-2">
                  {t("socialNote")}
                </Badge>
                <AlertDescription className="text-pulse-700 dark:text-pulse-200">
                  {t("socialOnlyInvited")}
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("needInvitation")}
            </p>
            {activeTab === "password" && (
              <button
                onClick={() => setShowResetDialog(true)}
                className="block w-full text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t("forgotPassword")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetPasswordTitle")}</DialogTitle>
            <DialogDescription>
              {t("resetPasswordDescription")}
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{t("resetEmailSent")}</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handlePasswordReset} noValidate>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t("emailLabel")}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                  disabled={resetLoading}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? t("sending") : t("sendResetLink")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
