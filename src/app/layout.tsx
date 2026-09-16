import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Missões — Organizador pessoal",
  description: "Organizador pessoal com foco em produtividade e vida acadêmica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
