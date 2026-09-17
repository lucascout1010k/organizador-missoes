import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel de Missões",
  description: "Organizador pessoal com foco em produtividade e vida acadêmica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
