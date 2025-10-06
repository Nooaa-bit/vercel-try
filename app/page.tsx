"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation("home");

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-500 transition"
            >
              {t("cta.primary")}
            </Link>
            <Link
              href="#features"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition"
            >
              {t("cta.secondary")}
            </Link>
          </div>

          <div id="features" className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">
                {t("features.workers.title")}
              </h3>
              <p className="text-gray-600">
                {t("features.workers.description")}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">
                {t("features.companies.title")}
              </h3>
              <p className="text-gray-600">
                {t("features.companies.description")}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">
                {t("features.matching.title")}
              </h3>
              <p className="text-gray-600">
                {t("features.matching.description")}
              </p>
            </div>
          </div>

          <div className="mt-16 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-blue-600 underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
