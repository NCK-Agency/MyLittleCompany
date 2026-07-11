import type { Metadata } from "next";
import { Barlow_Condensed, Instrument_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { optionalActor } from "@/server/auth-context";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "My Little Company",
  description:
    "Turn everyday owner conversations into trusted, reusable company knowledge.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await optionalActor();
  return (
    <html className={`${instrumentSans.variable} ${barlowCondensed.variable}`} data-scroll-behavior="smooth" lang="en">
      <body><AppShell viewer={viewer}>{children}</AppShell></body>
    </html>
  );
}
