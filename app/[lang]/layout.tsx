import type { Metadata } from "next";
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

const supportedLangs = new Set(["en", "el"]); //if you add more languages, you only update one place (the Set).

//for localized SEO consider generateMetadata to produce per‑language titles and descriptions using the lang param.
export const metadata: Metadata = {
  title: "HypeHire",
  description: "Staffing on-demand platform",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>; // Changed from Language to string
}) {
 const { lang } = await params;
 const validLang = supportedLangs.has(lang) ? lang : "en";// Default to 'en' if invalid

  return (
    <html lang={validLang}>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <LanguageProvider lang={validLang}>
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
