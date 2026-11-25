import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Menu, Moon, PanelLeft, Search, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { roleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth';
import { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { PageSkeleton } from './PageSkeleton';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { UserMenu } from './UserMenu';
import {
  getActiveRailItem,
  getHomeHref,
  getRailItems,
  getSidebarSections,
  matchesPath,
  type NavItem,
  type NavSection,
} from './nav';

const ChatSidebar = lazy(() => import('@/features/chat/components/ChatSidebar'));
const ProjectsSidebar = lazy(() => import('@/features/projects/components/ProjectsSidebar'));

const SIDEBAR_KEY = 'flow.sidebar.collapsed';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function RailButton({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
            focusRing,
            active ? 'bg-white/10 text-rail-active' : 'text-rail-foreground hover:bg-white/5 hover:text-rail-active',
          )}
        >
          {active ? <span className="absolute -left-2 top-2 h-6 w-0.5 rounded-r bg-rail-active" aria-hidden /> : null}
          <item.icon className="h-[18px] w-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function RailThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md text-rail-foreground transition-colors hover:bg-white/5 hover:text-rail-active',
            focusRing,
          )}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{isDark ? 'Light theme' : 'Dark theme'}</TooltipContent>
    </Tooltip>
  );
}

function Rail({ user, pathname }: { user: AuthUser; pathname: string }) {
  const items = getRailItems(user);
  const active = getActiveRailItem(user, pathname);
  return (
    <nav aria-label="Main" className="flex w-14 shrink-0 flex-col items-center gap-1 bg-rail py-3">
      <Link to={getHomeHref(user)} aria-label="FLOW home" className={cn('mb-3 rounded-md', focusRing)}>
        <img src="/favicon.png" alt="" className="h-7 w-7 rounded-md" />
      </Link>
      {items.map((item) => (
        <RailButton key={item.id} item={item} active={item.id === active?.id} />
      ))}
      <div className="mt-auto flex flex-col items-center gap-1">
        <NotificationBell />
        <RailThemeToggle />
        <div className="mt-2">
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}

function SidebarLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className="px-2 pb-4">
      {sections.map((section) => (
        <div key={section.id}>
          <p className="mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          {section.items.length === 0 && section.placeholder ? (
            <p className="px-2 py-1.5 text-[13px] text-muted-foreground">{section.placeholder}</p>
          ) : null}
          {section.items.map((item) => {
            const active = matchesPath(item, pathname);
            return (
              <NavLink
                key={item.id}
                to={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors',
                  focusRing,
                  active ? 'sidebar-item-active' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SearchButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Search"
        className={cn('flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted', focusRing)}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-56 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60',
        focusRing,
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');

  const togglePalette = useCallback((update: (open: boolean) => boolean) => setPaletteOpen(update), []);
  useCommandPaletteShortcut(togglePalette);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const railItems = useMemo(() => (user ? getRailItems(user) : []), [user]);
  const activeRail = useMemo(() => (user ? getActiveRailItem(user, pathname) : undefined), [user, pathname]);
  const sections = useMemo(() => (user ? getSidebarSections(user, pathname) : []), [user, pathname]);
  const pageTitle = useMemo(() => {
    const item = sections.flatMap((s) => s.items).find((i) => matchesPath(i, pathname));
    return item?.label ?? activeRail?.label ?? 'FLOW';
  }, [sections, pathname, activeRail]);

  if (!user) return null;

  const showSidebar = sections.length > 0 && !collapsed;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden md:flex">
        <Rail user={user} pathname={pathname} />
      </div>

      {showSidebar ? (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex" aria-label="Section">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
            <span className="text-[13px] font-semibold">{activeRail?.label ?? 'FLOW'}</span>
            {activeRail?.id === 'home' ? (
              <Badge variant="secondary" className="text-[10px] font-medium">
                {roleLabel(user.accessRole)}
              </Badge>
            ) : null}
          </div>
          <ScrollArea className="flex-1">
            {activeRail?.id === 'chat' ? (
              <Suspense fallback={null}>
                <ChatSidebar />
              </Suspense>
            ) : activeRail?.id === 'projects' ? (
              <Suspense fallback={null}>
                <ProjectsSidebar />
              </Suspense>
            ) : (
              <SidebarLinks sections={sections} />
            )}
          </ScrollArea>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur md:px-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className={cn('flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted md:hidden', focusRing)}
          >
            <Menu className="h-4 w-4" />
          </button>
          {sections.length > 0 ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-pressed={!collapsed}
              className={cn(
                'hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:flex',
                focusRing,
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : null}
          <h1 className="truncate text-[13px] font-medium">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <SearchButton onClick={() => setPaletteOpen(true)} />
            </div>
            <div className="md:hidden">
              <SearchButton compact onClick={() => setPaletteOpen(true)} />
            </div>
            <div className="md:hidden">
              <UserMenu side="bottom" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Suspense fallback={<PageSkeleton />}>
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </Suspense>
        </main>
      </div>

      {/* Mobile navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="flex h-12 items-center border-b border-sidebar-border px-4 text-[13px] font-semibold">
            {activeRail?.label ?? 'FLOW'}
          </SheetTitle>
          <ScrollArea className="h-[calc(100vh-3rem)]">
            {activeRail?.id === 'chat' ? (
              <Suspense fallback={null}>
                <ChatSidebar onNavigate={() => setMobileNavOpen(false)} />
              </Suspense>
            ) : activeRail?.id === 'projects' ? (
              <Suspense fallback={null}>
                <ProjectsSidebar onNavigate={() => setMobileNavOpen(false)} />
              </Suspense>
            ) : (
              <SidebarLinks sections={sections} onNavigate={() => setMobileNavOpen(false)} />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-background md:hidden"
      >
        {railItems.slice(0, 5).map((item) => {
          const active = item.id === activeRail?.id;
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                focusRing,
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
