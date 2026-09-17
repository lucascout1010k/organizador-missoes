import Link from "next/link";

import { logout } from "@/app/(protected)/actions";
import { DesktopNavigation, MobileNavigation } from "@/components/navigation/primary-navigation";
import { AppIcon } from "@/components/ui/app-icon";

import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link aria-label="Painel de Missões — Início" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandLogo}>
            <svg fill="none" height="38" viewBox="0 0 40 40" width="38">
              <path d="M4 30 14.5 10l5.3 10L25 7l11 23H4Z" fill="currentColor" opacity=".96" />
              <path d="m14.5 10 5.3 10-5.5 10H4L14.5 10Z" fill="#45dcaf" opacity=".92" />
              <path d="m25 7 11 23H25.5l-5.7-10L25 7Z" fill="#3284ff" />
            </svg>
          </span>
          <span className={styles.brandText}>
            <strong>Painel de Missões</strong>
            <small>Organizador pessoal</small>
          </span>
        </Link>

        <DesktopNavigation />

        <div className={styles.sidebarFooter}>
          <strong>Disciplina cria liberdade.</strong>
          Pequenas ações, grandes resultados.
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span className={styles.topbarTitle}>Seu sistema pessoal</span>
          <label className={styles.searchVisual}>
            <AppIcon name="search" size={16} />
            <input aria-label="Busca — disponível em breve" disabled placeholder="Buscar algo..." type="search" />
          </label>
          <div className={styles.topbarActions}>
            <button aria-label="Notificações — disponíveis em breve" className={styles.iconButton} disabled type="button">
              <AppIcon name="bell" size={18} />
            </button>
            <form action={logout} className={styles.profileForm}>
              <button aria-label="Sair da conta" className={styles.profileButton} type="submit">
                <span className={styles.avatar}><AppIcon name="sparkles" size={16} /></span>
                <span className={styles.profileCopy}><strong>Modo foco</strong><small>Clique para sair</small></span>
                <span className={styles.profileChevron}><AppIcon name="logout" size={15} /></span>
              </button>
            </form>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>

      <MobileNavigation />
    </div>
  );
}
