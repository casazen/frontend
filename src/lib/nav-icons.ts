import {
  Calendar,
  CalendarDays,
  ChartColumn,
  CreditCard,
  FileCheck,
  FileText,
  Home,
  LayoutDashboard,
  Repeat,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Home,
  Calendar,
  CalendarDays,
  CreditCard,
  ChartColumn,
  Repeat,
  ShieldCheck,
  User,
  Users,
  FileText,
  FileCheck,
  Settings,
  Wallet,
};

export function getNavIcon(iconName?: string): LucideIcon {
  return NAV_ICONS[iconName ?? 'LayoutDashboard'] ?? LayoutDashboard;
}
