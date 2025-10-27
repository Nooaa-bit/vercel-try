"use client";

import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const { t, i18n, ready } = useTranslation("error");
  const message = searchParams.get("message") || t("defaultMessage");

  // Loading skeleton while translations load
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="text-center">
            <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-20 bg-gray-200 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <CardTitle className="text-3xl font-display">{t("title")}</CardTitle>
          <CardDescription className="text-base">
            {t("subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 text-center font-medium">
              {message}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => (window.location.href = `/${i18n.language}`)}
              className="w-full bg-pulse-500 hover:bg-pulse-600"
            >
              <Home className="w-4 h-4 mr-2" />
              {t("goHome")}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full"
            >
              {t("goBack")}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("helpText")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
