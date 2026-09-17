"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

import styles from "../app-shell.module.css";

type NavigationItem = {
  href?: string;
  icon: AppIconName;
  label: string;
};

const desktopItems: NavigationItem[] = [
  { href: "/", icon: "home", label: "Início" },
  { icon: "missions", label: "Missões" },
  { icon: "agenda", label: "Agenda" },
  { icon: "academy", label: "Academia" },
  { href: "/faculdade", icon: "college", label: "Faculdade" },
  { icon: "projects", label: "Projetos" },
  { icon: "reports", label: "Relatórios" },
  { icon: "trophy", label: "Conquistas" },
  { icon: "settings", label: "Configurações" },
];

const mobileItems = desktopItems.slice(0, 5);

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavigationEntry({
  item,
  pathname,
  variant,
}: {
  item: NavigationItem;
  pathname: string;
  variant: "desktop" | "mobile";
}) {
  const className = [
    styles.navItem,
    variant === "mobile" ? styles.mobileNavItem : "",
    item.href && isCurrentRoute(pathname, item.href) ? styles.navItemActive : "",
    item.href ? "" : styles.navItemPlanned,
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <span className={styles.navIcon}><AppIcon name={item.icon} size={variant === "mobile" ? 19 : 18} /></span>
      <span>{item.label}</span>
      {!item.href && variant === "desktop" ? <small>Em breve</small> : null}
    </>
  );

  return item.href ? (
    <Link aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined} className={className} href={item.href}>
      {content}
    </Link>
  ) : (
    <span aria-disabled="true" className={className} title={`${item.label}: em breve`}>
      {content}
    </span>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className={styles.sideNav}>
      {desktopItems.map((item) => (
        <NavigationEntry item={item} key={item.label} pathname={pathname} variant="desktop" />
      ))}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação móvel" className={styles.mobileNav}>
      {mobileItems.map((item) => (
        <NavigationEntry item={item} key={item.label} pathname={pathname} variant="mobile" />
      ))}
    </nav>
  );
}
