import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "dMessage — Decentralized Messaging on Stellar",
  description: "Censorship-resistant, E2EE messaging built on Stellar Soroban",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <WalletProvider>{children}</WalletProvider>
        </Providers>
      </body>
    </html>
  );
}
