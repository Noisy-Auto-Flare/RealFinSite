import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { initializeApp } from "@/lib/init";

initializeApp();

const inter = Inter({ subsets: ["cyrillic", "latin"] });

export const metadata: Metadata = {
  title: "FinTracker — учёт финансов",
  description: "Личный финансовый учёт с поддержкой криптовалют, мультивалютных счетов и авто-сканирования кошельков",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
