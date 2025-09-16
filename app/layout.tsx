// app/layout.tsx
import type { Metadata } from "next";
import React from "react";
import "./globals.css";

import { Inter, Geist, Geist_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dialogue",
  description: "Conversational AI for research",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We apply Inter as the base font; Geist vars are available for your CSS
  return (
    <html lang="en">
      <body className={`${inter.className} ${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}