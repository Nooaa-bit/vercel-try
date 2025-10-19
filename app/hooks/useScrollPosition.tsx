"use client";

import { useState, useEffect } from "react";

export function useScrollPosition(threshold: number = 10) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // Check initial scroll position on mount
    const checkInitialScroll = () => {
      if (typeof window !== "undefined") {
        setIsScrolled(window.scrollY > threshold);
      }
    };

    // Run immediately on mount
    checkInitialScroll();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
}
