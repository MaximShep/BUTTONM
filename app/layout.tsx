import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UGC Scripts MVP",
  description: "MVP for generating UGC advertising script projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
