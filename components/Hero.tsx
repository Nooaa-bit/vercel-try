"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Info } from "lucide-react";
import LottieAnimation from "./LottieAnimation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactForm } from "./ContactForm";

const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [lottieData, setLottieData] = useState<Record<string, unknown> | null>(
    null
  );
  const [isMobile, setIsMobile] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  // Get translation function from the 'hero' namespace
  const { t } = useTranslation("hero");

  useEffect(() => {
    // Check if mobile on mount and when window resizes
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetch("/loop-header.json")
      .then((response) => response.json())
      .then((data) => setLottieData(data))
      .catch((error) =>
        console.error("Error loading Lottie animation:", error)
      );
  }, []);

  useEffect(() => {
    // Skip effect on mobile
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !imageRef.current) return;

      const { left, top, width, height } =
        containerRef.current.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;

      imageRef.current.style.transform = `perspective(1000px) rotateY(${
        x * 2.5
      }deg) rotateX(${-y * 2.5}deg) scale3d(1.02, 1.02, 1.02)`;
    };

    const handleMouseLeave = () => {
      if (!imageRef.current) return;
      imageRef.current.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)`;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [isMobile]);

  useEffect(() => {
    // Skip parallax on mobile
    if (isMobile) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const elements = document.querySelectorAll(".parallax");
      elements.forEach((el) => {
        const element = el as HTMLElement;
        const speed = parseFloat(element.dataset.speed || "0.1");
        const yPos = -scrollY * speed;
        element.style.setProperty("--parallax-y", `${yPos}px`);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const handleGetAccessClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowDialog(true);
  };

  return (
    <>
      <section
        className="overflow-hidden relative bg-cover"
        id="hero"
        style={{
          backgroundImage: 'url("/Header-background.webp")',
          backgroundPosition: "center 30%",
          padding: isMobile ? "100px 12px 40px" : "120px 20px 60px",
        }}
      >
        <div className="absolute -top-[10%] -right-[5%] w-1/2 h-[70%] bg-pulse-gradient opacity-20 blur-3xl rounded-full"></div>

        <div className="container px-4 sm:px-6 lg:px-8" ref={containerRef}>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-center">
            <div className="w-full lg:w-1/2">
              <div
                className="pulse-chip mb-3 sm:mb-6 opacity-0 animate-fade-in"
                style={{ animationDelay: "0.1s" }}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-pulse-500 text-white mr-2">
                  01
                </span>
                <span>{t("chip")}</span>
              </div>

              <h1
                className="section-title text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight opacity-0 animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                {t("title")}
                <br className="hidden sm:inline" />
                {t("subtitle")}
              </h1>

              <p
                style={{ animationDelay: "0.5s" }}
                className="section-subtitle mt-3 sm:mt-6 mb-4 sm:mb-8 leading-relaxed opacity-0 animate-fade-in text-gray-950 font-normal text-base sm:text-lg text-left"
              >
                {t("description")}
              </p>

              <div
                className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-in"
                style={{ animationDelay: "0.7s" }}
              >
                <a
                  href="#get-access"
                  onClick={handleGetAccessClick}
                  className="flex items-center justify-center group w-full sm:w-auto text-center"
                  style={{
                    backgroundColor: "#d32626",
                    borderRadius: "1440px",
                    boxSizing: "border-box",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    fontSize: "14px",
                    lineHeight: "20px",
                    padding: "16px 24px",
                    border: "1px solid white",
                  }}
                >
                  {t("button")}
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            <div className="w-full lg:w-1/2 relative mt-6 lg:mt-0">
              {lottieData ? (
                <div
                  className="relative z-10 animate-fade-in"
                  style={{ animationDelay: "0.9s" }}
                >
                  <LottieAnimation
                    animationPath={lottieData}
                    className="w-full h-auto max-w-lg mx-auto"
                    loop={true}
                    autoplay={true}
                  />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-dark-900 rounded-2xl sm:rounded-3xl -z-10 shadow-xl"></div>
                  <div className="relative transition-all duration-500 ease-out overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl">
                    <img
                      ref={imageRef}
                      src="/lovable-uploads/5663820f-6c97-4492-9210-9eaa1a8dc415.jpg"
                      alt="Hype Hire"
                      className="w-full h-auto object-cover transition-transform duration-500 ease-out"
                      style={{ transformStyle: "preserve-3d" }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: 'url("/hero-image.jpg")',
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        mixBlendMode: "overlay",
                        opacity: 0.001,
                      }}
                    ></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          className="hidden lg:block absolute bottom-0 left-1/4 w-64 h-64 bg-pulse-100/30 rounded-full blur-3xl -z-10 parallax"
          data-speed="0.05"
        ></div>
      </section>

      {/* Access Request Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t("dialog.alert")}</AlertDescription>
          </Alert>

          <ContactForm
            onSuccess={() => setShowDialog(false)}
            showCancel
            onCancel={() => setShowDialog(false)}
            translationNamespace="contact-form"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Hero;
