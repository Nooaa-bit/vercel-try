//hype-hire/vercel/app/[lang]/page.tsx
"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/LanguageContext";
import React, { useEffect } from "react";
import Hero from "@/components/Hero";
import HypeSection from "@/components/HypeSection";
import DetailsSection from "@/components/DetailsSection";
import Footer from "@/components/Footer";

 

export default function Home() {
   const { t } = useTranslation("home");
   const { language } = useLanguage();
  // Initialize intersection observer to detect when elements enter viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".animate-on-scroll");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  useEffect(() => {
    // This helps ensure smooth scrolling for the anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();

        const targetId = (e.currentTarget as HTMLAnchorElement)
          .getAttribute("href")
          ?.substring(1);
        if (!targetId) return;

        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        // Increased offset to account for mobile nav
        const offset = window.innerWidth < 768 ? 100 : 80;

        window.scrollTo({
          top: targetElement.offsetTop - offset,
          behavior: "smooth",
        });
      });
    });
  }, []);


  return (
    <div className="min-h-screen">
      <main className="space-y-4 sm:space-y-8">
        <Hero />
        <HypeSection />
        <DetailsSection />
      </main>
      <Footer />
    </div>
  );
}
