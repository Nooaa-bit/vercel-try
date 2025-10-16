// hype-hire/vercel/components/DetailsSection.tsx
"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DetailsSection = () => {
  const { t } = useTranslation("details");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email) {
      toast.error(t("right.form.requiredError"));
      return;
    }

    toast.success(t("right.form.success"));

    setFormData({ fullName: "", email: "", company: "" });
  };

  return (
    // If you also want the whole section backdrop white, add bg-white here:
    // <section id="details" className="w-full py-0 bg-white">
    <section id="details" className="w-full py-0">
      <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
          {/* Left Card - The Details */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant bg-white border border-[#ECECEC]">
            {/* Card Header with background image */}
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

            {/* Card Content */}
            <div className="p-4 sm:p-8">
              <h3 className="text-lg sm:text-xl font-display mb-6 sm:mb-8">
                {t("left.subtitle")}
              </h3>

              <div className="space-y-4 sm:space-y-6">
                {/* Bullet 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-dark-900 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-gray-50/80 backdrop-blur-sm border border-gray-100">
                      <span className="font-semibold text-base">
                        {t("left.bullets.b1.label")}:{" "}
                      </span>
                      {t("left.bullets.b1.text")}
                    </div>
                  </div>
                </div>

                {/* Bullet 2 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-dark-900 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-gray-50/80 backdrop-blur-sm border border-gray-100">
                      <span className="font-semibold text-base">
                        {t("left.bullets.b2.label")}:
                      </span>{" "}
                      {t("left.bullets.b2.text")}
                    </div>
                  </div>
                </div>

                {/* Bullet 3 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-dark-900 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-gray-50/80 backdrop-blur-sm border border-gray-100">
                      <span className="font-semibold text-base">
                        {t("left.bullets.b3.label")}:
                      </span>{" "}
                      {t("left.bullets.b3.text")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card - Contact Form */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant bg-white border border-[#ECECEC]">
            {/* Card Header with background image */}
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

            {/* Card Content - Form */}
            <div className="p-4 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder={t("right.form.fullName")}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("right.form.email")}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder={t("right.form.company")}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-pulse-500 hover:bg-pulse-600 text-white font-medium rounded-full transition-colors duration-300"
                  >
                    {t("right.form.submit")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetailsSection;
