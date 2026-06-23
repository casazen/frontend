import {
  Calendar,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  FileText,
  Globe,
  Home,
  Inbox,
  LayoutDashboard,
  Repeat,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Home,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  ChartColumn,
  Globe,
  Inbox,
  Repeat,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  FileText,
  FileCheck,
  Settings,
  Wallet,
  Wrench,
};

export function getNavIcon(iconName?: string): LucideIcon {
  return NAV_ICONS[iconName ?? 'LayoutDashboard'] ?? LayoutDashboard;
}
