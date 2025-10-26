"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { ContactForm } from "@/components/ContactForm";

const DetailsSection = () => {
  const { t, ready } = useTranslation("details");

  // Loading skeleton while translations load
  if (!ready) {
    return (
      <section id="details" className="w-full py-0">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
            <div className="rounded-2xl sm:rounded-3xl h-96 bg-gray-200 animate-pulse" />
            <div className="rounded-2xl sm:rounded-3xl h-96 bg-gray-200 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  // Bullet points data
  const bullets = [
    { label: t("left.bullets.b1.label"), text: t("left.bullets.b1.text") },
    { label: t("left.bullets.b2.label"), text: t("left.bullets.b2.text") },
    { label: t("left.bullets.b3.label"), text: t("left.bullets.b3.text") },
  ];

  return (
    <section id="details" className="w-full py-0">
      <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
          {/* Left Card - The Details */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant bg-white border border-[#ECECEC]">
            <div
              className="relative h-48 sm:h-64 p-6 sm:p-8 flex items-end"
              style={{
                backgroundImage: "url('/background-section3.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <h2 className="text-2xl sm:text-3xl font-display text-white font-bold">
                {t("left.title")}
              </h2>
            </div>

            <div className="p-4 sm:p-8">
              <h3 className="text-lg sm:text-xl font-display mb-6 sm:mb-8">
                {t("left.subtitle")}
              </h3>

              <div className="space-y-4 sm:space-y-6">
                {bullets.map((bullet, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-dark-900 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="p-3 rounded-lg bg-gray-50/80 backdrop-blur-sm border border-gray-100">
                        <span className="font-semibold text-base">
                          {bullet.label}:{" "}
                        </span>
                        {bullet.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Card - Contact Form */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant bg-white border border-[#ECECEC]">
            <div
              className="relative h-48 sm:h-64 p-6 sm:p-8 flex flex-col items-start"
              style={{
                backgroundImage: "url('/background-section1.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="inline-block px-4 sm:px-6 py-2 border border-white text-white rounded-full text-xs mb-4">
                {t("right.badge")}
              </div>
              <h2 className="text-2xl sm:text-3xl font-display text-white font-bold mt-auto">
                {t("right.title")}
              </h2>
            </div>

            <div className="p-4 sm:p-8">
              {/* USING THE REUSABLE ContactForm COMPONENT */}
              <ContactForm 
                translationNamespace="details"
                submitButtonText={t("submit")}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetailsSection;
