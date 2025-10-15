import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { LanguageProvider } from "@/lib/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  const validLang = (lang === 'en' || lang === 'el') ? lang : 'en'; // Default to 'en' if invalid

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang={validLang}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider lang={validLang}>
          <Navbar user={user} />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
