import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { ThemeProvider } from "@/lib/theme";
import { ClientWalletProvider } from "@/components/wallet/ClientWalletProvider";
import { UsernamePrompt } from "@/components/wallet/UsernamePrompt";
import { UnreadTitle } from "@/components/UnreadTitle";
import { RegisterSW } from "@/components/RegisterSW";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dMessage — Decentralized Messaging on Stellar",
  description:
    "Censorship-resistant, end-to-end encrypted messaging built on Stellar Soroban. Own your conversations.",
  keywords: ["decentralized", "messaging", "stellar", "soroban", "e2ee", "web3", "crypto"],
  openGraph: {
    title: "dMessage — Decentralized Messaging on Stellar",
    description: "Censorship-resistant, end-to-end encrypted messaging built on Stellar Soroban.",
    type: "website",
  },
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${geistMono.variable}`} suppressHydrationWarning>
      <body className="relative min-h-full flex flex-col font-sans bg-bg text-foreground">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-black focus:outline-none">
          Skip to content
        </a>
        {/* Ambient background layers (fixed, behind everything) */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-dots opacity-[0.35]" />
          <div
            className="absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-[140px]"
            style={{ background: "radial-gradient(circle, rgb(var(--accent-rgb) / 0.04), transparent 70%)" }}
          />
          <div
            className="absolute bottom-[-12rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full blur-[150px]"
            style={{ background: "radial-gradient(circle, rgb(var(--violet-rgb) / 0.03), transparent 70%)" }}
          />
        </div>

        <ThemeProvider>
          <Providers>
            <ClientWalletProvider>
              <UnreadTitle />
              <RegisterSW />
              {children}
              <UsernamePrompt />
            </ClientWalletProvider>
          </Providers>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
