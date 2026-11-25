import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { PeoplePicker } from '@/features/chat/components/dialogs';
import { PersonAvatar } from '@/features/chat/components/PersonAvatar';
import { useDirectory } from '@/features/chat/api';
import {
  useCreateProject,
  useProjectMembersMutations,
  useStatusMutations,
  useUpdateProject,
  type ProjectBundle,
} from '../api';
import { COLOR_DOT, PROJECT_COLORS, ROLE_LABEL, positionBetween, suggestKey } from '../lib';
import type { ProjectRole, StatusCategory } from '../types';

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/projects_key_key|duplicate/i.test(message)) return 'That key is already used by another project.';
  if (/key_check|projects_key/i.test(message)) return 'Keys are 2–6 letters or digits and start with a letter.';
  return message;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn('h-6 w-6 rounded-md ring-offset-2 ring-offset-background', COLOR_DOT[c], value === c && 'ring-2 ring-ring')}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- new project

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>('indigo');
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!keyTouched) setKey(suggestKey(name));
  }, [name, keyTouched]);

  const reset = () => {
    setName('');
    setKey('');
    setKeyTouched(false);
    setDescription('');
    setColor('indigo');
    setMembers([]);
  };

  const keyValid = /^[A-Z][A-Z0-9]{1,5}$/.test(key);

  const submit = async () => {
    if (!name.trim() || !keyValid) return;
    try {
      const id = await create.mutateAsync({ name: name.trim(), key, description: description.trim(), color, memberIds: members });
      onOpenChange(false);
      reset();
      navigate(`/projects/${id}`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects hold a board of tasks. You'll be the project lead.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input id="project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="project-key">Key</FieldLabel>
              <Input
                id="project-key"
                value={key}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                }}
                placeholder="WEB"
                aria-invalid={key.length > 0 && !keyValid}
                className="font-mono uppercase"
              />
            </div>
          </div>
          <p className="-mt-2 text-[12px] text-muted-foreground">Tasks will be numbered {key || 'KEY'}-1, {key || 'KEY'}-2…</p>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="project-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={4000} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Color</FieldLabel>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Members</FieldLabel>
            <PeoplePicker selected={members} onChange={setMembers} exclude={user ? [user.id] : []} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !keyValid || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- settings (leads)

export function ProjectSettingsDialog({
  bundle,
  open,
  onOpenChange,
}: {
  bundle: ProjectBundle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            {bundle.project.name} · {bundle.project.key}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-3">
            <MembersTab bundle={bundle} />
          </TabsContent>
          <TabsContent value="columns" className="mt-3">
            <ColumnsTab bundle={bundle} />
          </TabsContent>
          <TabsContent value="general" className="mt-3">
            <GeneralTab bundle={bundle} onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({ bundle }: { bundle: ProjectBundle }) {
  const { byId } = useDirectory();
  const { user } = useAuth();
  const { add, setRole, remove } = useProjectMembersMutations(bundle.project.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setNewRole] = useState<ProjectRole>('member');
  const memberIds = bundle.members.map((m) => m.user_id);
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update members');

  return (
    <div className="space-y-4">
      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {[...bundle.members]
          .sort((a, b) => (byId.get(a.user_id)?.full_name ?? '').localeCompare(byId.get(b.user_id)?.full_name ?? ''))
          .map((m) => {
            const person = byId.get(m.user_id);
            return (
              <li key={m.user_id} className="flex items-center gap-2.5 px-3 py-2">
                <PersonAvatar person={person} className="h-7 w-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {person?.full_name ?? 'Former member'}
                    {m.user_id === user?.id ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{person?.designation ?? person?.email}</span>
                </span>
                <Select value={m.role} onValueChange={(v) => setRole.mutate({ userId: m.user_id, role: v as ProjectRole }, { onError })}>
                  <SelectTrigger className="h-8 w-28" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as ProjectRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  aria-label={`Remove ${person?.full_name ?? 'member'}`}
                  onClick={() => remove.mutate(m.user_id, { onError })}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
      </ul>
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-[13px] font-medium">Add people</p>
        <PeoplePicker selected={selected} onChange={setSelected} exclude={memberIds} />
        <div className="flex items-center justify-end gap-2">
          <Select value={role} onValueChange={(v) => setNewRole(v as ProjectRole)}>
            <SelectTrigger className="h-8 w-28" aria-label="Role for new members">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as ProjectRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={selected.length === 0 || add.isPending}
            onClick={() => add.mutate({ userIds: selected, role }, { onSuccess: () => setSelected([]), onError })}
          >
            Add {selected.length > 0 ? selected.length : ''}
          </Button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Leads manage the project and its members. Members create and edit tasks. Viewers can only read.
      </p>
    </div>
  );
}

function ColumnsTab({ bundle }: { bundle: ProjectBundle }) {
  const { create, update, remove } = useStatusMutations(bundle.project.id);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('doing');
  const statuses = bundle.statuses;
  const onError = (e: unknown) =>
    toast.error(/foreign key|violates/i.test(String(e)) ? 'Move the tasks out of this column before deleting it.' : 'Could not update columns');

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= statuses.length) return;
    const neighbourA = statuses[target]?.position;
    const neighbourB = statuses[target + dir]?.position;
    const position = dir === -1 ? positionBetween(neighbourB, neighbourA) : positionBetween(neighbourA, neighbourB);
    update.mutate({ id: statuses[index].id, patch: { position } }, { onError });
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-md border border-border">
        {statuses.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
            <Input
              defaultValue={s.name}
              aria-label="Column name"
              className="h-8 flex-1"
              maxLength={40}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.name) update.mutate({ id: s.id, patch: { name: v } }, { onError });
              }}
            />
            <Select value={s.category} onValueChange={(v) => update.mutate({ id: s.id, patch: { category: v as StatusCategory } }, { onError })}>
              <SelectTrigger className="h-8 w-28" aria-label="Column type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="doing">In progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Move down" disabled={i === statuses.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${s.name}`}
              disabled={statuses.length <= 1}
              onClick={() => window.confirm(`Delete the "${s.name}" column?`) && remove.mutate(s.id, { onError })}
              className="flex h-8 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = name.trim();
          if (!v) return;
          create.mutate(
            { name: v, category, position: positionBetween(statuses.at(-1)?.position, undefined) },
            { onSuccess: () => setName(''), onError },
          );
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New column" aria-label="New column name" className="h-8 flex-1" maxLength={40} />
        <Select value={category} onValueChange={(v) => setCategory(v as StatusCategory)}>
          <SelectTrigger className="h-8 w-28" aria-label="New column type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="doing">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          Add
        </Button>
      </form>
      <p className="text-[12px] text-muted-foreground">Tasks in a "Done" column count as completed.</p>
    </div>
  );
}

function GeneralTab({ bundle, onDone }: { bundle: ProjectBundle; onDone: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateProject(bundle.project.id);
  const [name, setName] = useState(bundle.project.name);
  const [description, setDescription] = useState(bundle.project.description ?? '');
  const [color, setColor] = useState(bundle.project.color);
  const archived = Boolean(bundle.project.archived_at);
  const onError = (e: unknown) => toast.error(errorText(e));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(
          { name: name.trim(), description: description.trim() || null, color },
          { onSuccess: () => (toast.success('Saved'), onDone()), onError },
        );
      }}
    >
      <div className="space-y-1.5">
        <FieldLabel htmlFor="settings-name">Name</FieldLabel>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="settings-description">Description</FieldLabel>
        <Textarea id="settings-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Color</FieldLabel>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <DialogFooter className="items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() =>
            update.mutate(
              { archived_at: archived ? null : new Date().toISOString() },
              {
                onSuccess: () => {
                  toast.success(archived ? 'Project restored' : 'Project archived');
                  onDone();
                  if (!archived) navigate('/projects');
                },
                onError,
              },
            )
          }
        >
          {archived ? 'Restore project' : 'Archive project'}
        </Button>
        <Button type="submit" disabled={!name.trim() || update.isPending}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
