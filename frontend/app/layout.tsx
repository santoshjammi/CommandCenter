import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devkeys.countrysnews.com";
const SITE_NAME = "DevKeys";
const SITE_DESCRIPTION =
  "Free developer cheat sheets for 900+ CLI tools, languages, frameworks, databases, DevOps platforms, and cloud providers — copy-ready commands with real-world scenarios.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Developer Cheat Sheets`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "developer cheat sheets",
    "CLI command reference",
    "programming quick reference",
    "devkeys",
    "shell commands",
    "keyboard shortcuts",
    "devops commands",
    "git cheat sheet",
    "docker commands",
    "developer tools reference",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Developer Cheat Sheets`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Developer Cheat Sheets`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Developer Cheat Sheets`,
    description: SITE_DESCRIPTION,
    images: ["/og-default.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <head>
        {/* Prefetch the search index so ⌘K opens instantly */}
        <link rel="prefetch" href="/search-index.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen font-(--font-inter)">
        <Header />
        <main>{children}</main>
        <footer className="mt-24 py-8 text-center text-sm" style={{ borderTop: "1px solid var(--ring)", color: "var(--muted-gray)" }}>
          {SITE_NAME} — built with Next.js
        </footer>
      </body>
    </html>
  );
}

