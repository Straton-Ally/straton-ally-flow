import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { LogOut, SunMoon } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { getAllDestinations } from './nav';

export function useCommandPaletteShortcut(setOpen: (update: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const destinations = useMemo(() => (user ? getAllDestinations(user) : []), [user]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Search pages and actions</DialogTitle>
      <DialogDescription className="sr-only">Type to filter, then press Enter to open.</DialogDescription>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {destinations.map((item) => (
            <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => run(() => navigate(item.href))}>
              <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
          >
            <SunMoon className="mr-2 h-4 w-4 text-muted-foreground" />
            Toggle theme
          </CommandItem>
          <CommandItem
            value="sign out log out"
            onSelect={() =>
              run(() => {
                void signOut().then(() => navigate('/login', { replace: true }));
              })
            }
          >
            <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
