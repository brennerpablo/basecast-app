import {
  Building2,
  Database,
  History,
  type LucideIcon,
  Map,
  TrendingUp,
  UserRound,
} from "lucide-react";

export type MainMenuSubItem = {
  id: string;
  label: string;
  href: string;
  /** Custom active match; defaults to an exact pathname match. */
  activeCheck?: (pathname: string) => boolean;
};

export type MainMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
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

/** The sidebar menu, in display order. */
export const MAIN_MENU: MainMenuItem[] = [
  {
    id: "explorer",
    label: "Explorer",
    icon: Map,
    href: "/explorer",
    activeCheck: underPath("/explorer"),
  },
  {
    id: "forecast",
    label: "Forecast",
    icon: TrendingUp,
    href: "/forecast",
    activeCheck: underPath("/forecast"),
  },
  {
    id: "backtest",
    label: "Backtest",
    icon: History,
    href: "/backtest",
    activeCheck: underPath("/backtest"),
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Building2,
    href: "/accounts",
    activeCheck: underPath("/accounts"),
  },
  {
    id: "data",
    label: "Data",
    icon: Database,
    href: "/data",
    activeCheck: underPath("/data"),
  },
];

/** Screens outside the sidebar menu, reached from the user menu: their tab name and icon. */
export const OTHER_ROUTES = [
  { id: "account", label: "Account", icon: UserRound, href: "/account" },
] satisfies (MainMenuItem & { href: string })[];

export const ACCOUNT_ROUTE = OTHER_ROUTES[0];
