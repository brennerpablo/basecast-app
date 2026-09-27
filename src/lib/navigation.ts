import {
  Activity,
  Building2,
  Database,
  History,
  House,
  Lightbulb,
  type LucideIcon,
  Map,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";

export type MainMenuSubItem = {
  id: string;
  label: string;
  href: string;
  /** Custom active match; defaults to an exact pathname match. */
  activeCheck?: (pathname: string) => boolean;
};

/** The menu's blocks, drawn apart by a divider: Home, the analytics screens, the data and ops tools. */
export type MainMenuSection = "home" | "analytics" | "system";

export type MainMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: MainMenuSection;
  /** Leaf items link somewhere; group items carry `subItems` instead. */
  href?: string;
  activeCheck?: (pathname: string) => boolean;
  subItems?: MainMenuSubItem[];
};

/** Cookie with the expanded menu groups, read on the server so both renders match. */
export const SIDEBAR_EXPANDED_COOKIE = "sidebar-menu-expanded";

/** Matches the route itself and anything below it (`/accounts/123`). */
const underPath = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * The sidebar menu, in display order. Home gathers one highlight per module; Insights opens the demo;
 * Accounts, commercial intelligence, is the core of the product.
 */
export const MAIN_MENU: MainMenuItem[] = [
  {
    id: "home",
    section: "home",
    label: "Home",
    icon: House,
    href: "/home",
  },
  {
    id: "insights",
    section: "analytics",
    label: "Insights",
    icon: Lightbulb,
    href: "/insights",
    activeCheck: underPath("/insights"),
  },
  {
    id: "accounts",
    section: "analytics",
    label: "Accounts",
    icon: Building2,
    href: "/accounts",
    activeCheck: underPath("/accounts"),
  },
  {
    id: "explorer",
    section: "analytics",
    label: "Explorer",
    icon: Map,
    href: "/explorer",
    activeCheck: underPath("/explorer"),
  },
  {
    id: "forecast",
    section: "analytics",
    label: "Forecast",
    icon: TrendingUp,
    href: "/forecast",
    activeCheck: underPath("/forecast"),
  },
  {
    id: "backtest",
    section: "analytics",
    label: "Backtest",
    icon: History,
    href: "/backtest",
    activeCheck: underPath("/backtest"),
  },
  {
    id: "data",
    section: "system",
    label: "Data",
    icon: Database,
    href: "/data",
    activeCheck: underPath("/data"),
  },
  {
    id: "ops",
    section: "system",
    label: "Ops",
    icon: Activity,
    href: "/ops",
    activeCheck: underPath("/ops"),
  },
];

/** Screens outside the sidebar menu, reached from the user menu: their tab name and icon. */
export const OTHER_ROUTES = [
  { id: "account", label: "Account", icon: UserRound, href: "/account" },
  // Superadmins only; hiding it is cosmetic, `/admin`'s layout is the check.
  { id: "admin-users", label: "Users", icon: UsersRound, href: "/admin/users" },
] satisfies (MainMenuItem & { href: string })[];

export const [ACCOUNT_ROUTE, ADMIN_USERS_ROUTE] = OTHER_ROUTES;
