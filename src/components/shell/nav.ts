import {
  Bell,
  Building2,
  Calculator,
  CalendarOff,
  Clock,
  FileClock,
  Home,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { AuthUser } from '@/lib/auth';
import { can, type Permission } from '@/lib/permissions';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Paths that make this item active (prefix match). Defaults to [href]. */
  matchPrefixes: string[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  /** Shown instead of items when a module is not built yet. */
  placeholder?: string;
}

const isManagerOrAdmin = (user: AuthUser) => user.accessRole !== 'member';

export function getHomeHref(user: AuthUser): string {
  return isManagerOrAdmin(user) ? '/admin/dashboard' : '/employee/dashboard';
}

export function getNotificationsHref(user: AuthUser): string {
  return isManagerOrAdmin(user) ? '/admin/notifications' : '/employee/notifications';
}

export function getSettingsHref(user: AuthUser): string {
  return can(user, 'settings.manage') ? '/admin/settings' : '/employee/settings';
}

function allowed(user: AuthUser, item: NavItem): boolean {
  return !item.permission || can(user, item.permission);
}

export function getRailItems(user: AuthUser): NavItem[] {
  const items: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      href: getHomeHref(user),
      icon: Home,
      matchPrefixes: [
        '/admin/dashboard',
        '/employee/dashboard',
        '/admin/departments',
        '/admin/salaries',
        '/admin/leave',
        '/admin/permissions',
        '/admin/logs',
        '/admin/settings',
        '/admin/notifications',
        '/admin/work',
        '/employee/salary',
        '/employee/settings',
        '/employee/notifications',
        '/employee/tasks',
        '/employee/team',
        '/employee/work',
      ],
    },
    { id: 'chat', label: 'Chat', href: '/chat', icon: MessagesSquare, permission: 'chat.use', matchPrefixes: ['/chat'] },
    {
      id: 'projects',
      label: 'Projects',
      href: '/projects',
      icon: KanbanSquare,
      permission: 'projects.use',
      matchPrefixes: ['/projects'],
    },
    {
      id: 'attendance',
      label: 'Attendance',
      href: can(user, 'attendance.team') ? '/admin/attendance' : '/employee/attendance',
      icon: Clock,
      permission: 'attendance.self',
      matchPrefixes: ['/admin/attendance', '/employee/attendance'],
    },
    {
      id: 'people',
      label: 'People',
      href: '/admin/recruitment',
      icon: Users,
      permission: 'people.view',
      matchPrefixes: ['/admin/recruitment', '/admin/employees'],
    },
    {
      id: 'flowmath',
      label: 'FlowMath',
      href: '/flowmath/dashboard',
      icon: Calculator,
      permission: 'flowmath.use',
      matchPrefixes: ['/flowmath'],
    },
    {
      id: 'flowpay',
      label: 'FlowPay',
      href: '/flowpay/dashboard',
      icon: Wallet,
      permission: 'flowpay.use',
      matchPrefixes: ['/flowpay'],
    },
  ];
  return items.filter((item) => allowed(user, item));
}

export function matchesPath(item: NavItem, pathname: string): boolean {
  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getActiveRailItem(user: AuthUser, pathname: string): NavItem | undefined {
  const items = getRailItems(user);
  return items.find((item) => matchesPath(item, pathname)) ?? items[0];
}

function organizationSections(user: AuthUser): NavSection[] {
  const workspace: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', href: getHomeHref(user), icon: LayoutDashboard, matchPrefixes: [getHomeHref(user)] },
    {
      id: 'my-attendance',
      label: 'My attendance',
      href: '/employee/attendance',
      icon: Clock,
      permission: 'attendance.self',
      matchPrefixes: ['/employee/attendance'],
    },
    {
      id: 'team-attendance',
      label: 'Team attendance',
      href: '/admin/attendance',
      icon: Users,
      permission: 'attendance.team',
      matchPrefixes: ['/admin/attendance'],
    },
  ];

  const organization: NavItem[] = [
    {
      id: 'people',
      label: 'People',
      href: '/admin/recruitment',
      icon: Users,
      permission: 'people.view',
      matchPrefixes: ['/admin/recruitment', '/admin/employees'],
    },
    {
      id: 'departments',
      label: 'Departments',
      href: '/admin/departments',
      icon: Building2,
      permission: 'departments.manage',
      matchPrefixes: ['/admin/departments'],
    },
    {
      id: 'payroll',
      label: 'Payroll',
      href: '/admin/salaries',
      icon: WalletCards,
      permission: 'salaries.view',
      matchPrefixes: ['/admin/salaries'],
    },
    {
      id: 'leave',
      label: 'Leave',
      href: '/admin/leave',
      icon: CalendarOff,
      permission: 'people.view',
      matchPrefixes: ['/admin/leave'],
    },
    {
      id: 'permissions',
      label: 'Permissions',
      href: '/admin/permissions',
      icon: ShieldCheck,
      permission: 'permissions.manage',
      matchPrefixes: ['/admin/permissions'],
    },
    {
      id: 'logs',
      label: 'Audit logs',
      href: '/admin/logs',
      icon: FileClock,
      permission: 'logs.view',
      matchPrefixes: ['/admin/logs'],
    },
  ];

  const me: NavItem[] = [
    {
      id: 'notifications',
      label: 'Notifications',
      href: getNotificationsHref(user),
      icon: Bell,
      permission: 'notifications.view',
      matchPrefixes: ['/admin/notifications', '/employee/notifications'],
    },
    {
      id: 'salary',
      label: 'My salary',
      href: '/employee/salary',
      icon: WalletCards,
      matchPrefixes: ['/employee/salary'],
    },
    {
      id: 'settings',
      label: 'Settings',
      href: getSettingsHref(user),
      icon: Settings,
      matchPrefixes: ['/admin/settings', '/employee/settings'],
    },
  ];

  return [
    { id: 'workspace', label: 'Workspace', items: workspace },
    { id: 'organization', label: 'Organization', items: organization },
    { id: 'me', label: 'Me', items: me },
  ];
}

export function getSidebarSections(user: AuthUser, pathname: string): NavSection[] {
  const active = getActiveRailItem(user, pathname);

  let sections: NavSection[];
  switch (active?.id) {
    case 'chat':
      sections = [{ id: 'channels', label: 'Channels', items: [], placeholder: 'Loading channels…' }];
      break;
    case 'projects':
      sections = [{ id: 'projects', label: 'Projects', items: [], placeholder: 'Loading projects…' }];
      break;
    case 'flowmath':
    case 'flowpay':
      sections = [];
      break;
    default:
      sections = organizationSections(user);
  }

  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => allowed(user, item)) }))
    .filter((section) => section.items.length > 0 || section.placeholder);
}

/** Every destination the user can reach, deduped by href (for the command palette). */
export function getAllDestinations(user: AuthUser): NavItem[] {
  const seen = new Set<string>();
  const all = [...getRailItems(user), ...organizationSections(user).flatMap((s) => s.items)];
  return all.filter((item) => {
    if (!allowed(user, item) || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
