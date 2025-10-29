//hype-hire/vercel/app/[lang]/layout.tsx
import type { Metadata } from "next";
import { type ReactNode } from "react";
import { Inter } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/navbar";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/app/hooks/useTheme";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin", "greek"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

//for localized SEO consider generateMetadata to produce per‑language titles and descriptions using the lang param.
export const metadata: Metadata = {
  title: "HypeHire",
  description: "Staffing on-demand platform",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>; // ✅ Changed to Promise
}) {
  const { lang } = await params; // ✅ Await the params

  return (
    <html lang={lang}>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <LanguageProvider lang={lang}>
            <Navbar />
            {children}
            <Toaster richColors closeButton position="bottom-right" />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

//Ensure tailwind.config.js has darkMode: 'class' so toggling the root class controls dark styles across routes under the shared layout.​
//Use className="dark:bg-neutral-950" patterns in components; the provider adds or removes the dark class on <html>, which propagates styling consistently
