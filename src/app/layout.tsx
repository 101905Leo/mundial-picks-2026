import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mundialpicks.online"),
  title: "Mundial Picks | Salas privadas de picks",
  description: "Crea y administra salas privadas de picks con chat y ranking independiente.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Mundial Picks | Salas privadas de picks",
    description: "Crea y administra salas privadas de picks con chat y ranking independiente.",
    url: "https://www.mundialpicks.online",
    siteName: "Mundial Picks",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mundial Picks | Salas privadas de picks",
    description: "Crea y administra salas privadas de picks con chat y ranking independiente.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mundial 2026",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
