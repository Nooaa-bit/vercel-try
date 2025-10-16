"use client";

import { useState } from "react";

export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    setIsOpen((prev) => {
      const newValue = !prev;
      document.body.style.overflow = newValue ? "hidden" : "";
      return newValue;
    });
  };

  const close = () => {
    setIsOpen(false);
    document.body.style.overflow = "";
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (isOpen) {
      close();
    }
  };

  return {
    isOpen,
    toggle,
    close,
    scrollToTop,
  };
}
