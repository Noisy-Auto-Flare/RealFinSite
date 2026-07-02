import type { Metadata } from "next";
import "./globals.css";
import { initializeApp } from "@/lib/init";
import ClientSessionProvider from "@/components/ClientSessionProvider";
import ToastProvider from "@/components/Toast";

initializeApp();

export const metadata: Metadata = {
  title: "FinTracker — учёт финансов",
  description: "Личный финансовый учёт с поддержкой криптовалют, мультивалютных счетов и авто-сканирования кошельков",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <ClientSessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ClientSessionProvider>
      </body>
    </html>
  );
}
