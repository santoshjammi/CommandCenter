import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Dev Cheat Sheets",
  description: "The developer command center — keyboard-first cheat sheets for every tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Prefetch the search index so ⌘K opens instantly */}
        <link rel="prefetch" href="/search-index.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen font-(--font-inter)">
        <Header />
        <main>{children}</main>
        <footer className="mt-24 py-8 text-center text-sm" style={{ borderTop: "1px solid var(--ring)", color: "var(--muted-gray)" }}>
          Dev Cheat Sheets — built with Next.js
        </footer>
      </body>
    </html>
  );
}

