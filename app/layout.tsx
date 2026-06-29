import type { Metadata } from "next";
import { Inter, Public_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Body / UI — Inter (BRAND.md §4)
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Headings / display — Public Sans
const publicSans = Public_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

// Monospace — Stellar hashes / TX IDs only
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Krunchr — Compliance Engine",
  description:
    "Philippine tax compliance for self-employed freelancers, with Stellar-anchored filing receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${publicSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
