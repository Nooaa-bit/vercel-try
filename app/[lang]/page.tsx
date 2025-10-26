// hype-hire/vercel/app/[lang]/page.tsx
"use client";

import React, { useEffect } from "react";
import Hero from "@/components/Hero";
import HypeSection from "@/components/HypeSection";
import DetailsSection from "@/components/DetailsSection";
import Footer from "@/components/Footer";

export default function Home() {

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
      observer.disconnect();
    };
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
