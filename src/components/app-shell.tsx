import Link from "next/link";

import { logout } from "@/app/(protected)/actions";

const links = [
  { href: "/", label: "Hoje", mark: "H" },
  { href: "/faculdade", label: "Faculdade", mark: "F" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <span>
            <strong>Missões</strong>
            <small>Organizador pessoal</small>
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="side-nav">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              <span aria-hidden="true">{link.mark}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <form action={logout} className="sidebar-logout">
          <button className="button button-ghost" type="submit">Sair</button>
        </form>
      </aside>

      <main className="app-content">{children}</main>

      <nav aria-label="Navegação móvel" className="mobile-nav">
        {links.map((link) => (
          <Link href={link.href} key={link.href}>
            <span aria-hidden="true">{link.mark}</span>
            {link.label}
          </Link>
        ))}
        <form action={logout}>
          <button type="submit"><span aria-hidden="true">S</span>Sair</button>
        </form>
      </nav>
    </div>
  );
}
