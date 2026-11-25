import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, FileText, Link2, MoreHorizontal, Paperclip, Plus, Tag, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Composer } from '@/features/chat/components/Composer';
import { PersonAvatar } from '@/features/chat/components/PersonAvatar';
import { RichText, formatBytes } from '@/features/chat/format';
import type { DirectoryPerson } from '@/features/chat/types';
import {
  useAttachmentMutations,
  useCommentMutations,
  useCreateTask,
  useDeleteTask,
  useLabelMutations,
  useSignedProjectFile,
  useTaskDetail,
  useUpdateTask,
  type ProjectBundle,
} from '../api';
import { PRIORITIES, PROJECT_COLORS } from '../lib';
import type { Task, TaskActivity, TaskAttachment, TaskComment } from '../types';
import { LabelChip, PriorityIcon, StatusIcon } from './bits';

interface TaskDrawerProps {
  task: Task | undefined;
  bundle: ProjectBundle;
  allTasks: Task[];
  peopleById: Map<string, DirectoryPerson>;
  canEdit: boolean;
  isLead: boolean;
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

export function TaskDrawer({ task, bundle, allTasks, peopleById, canEdit, isLead, onOpenTask, onClose }: TaskDrawerProps) {
  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[600px] [&>button]:hidden">
        {task ? (
          <TaskDrawerBody
            key={task.id}
            task={task}
            bundle={bundle}
            allTasks={allTasks}
            peopleById={peopleById}
            canEdit={canEdit}
            isLead={isLead}
            onOpenTask={onOpenTask}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskDrawerBody({ task, bundle, allTasks, peopleById, canEdit, isLead, onOpenTask, onClose }: TaskDrawerProps & { task: Task }) {
  const { user } = useAuth();
  const { project, statuses, members, labels } = bundle;
  const ref = `${project.key}-${task.number}`;
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const detail = useTaskDetail(task.id);
  const parent = task.parent_id ? allTasks.find((t) => t.id === task.parent_id) : undefined;
  const status = statuses.find((s) => s.id === task.status_id);

  const assignable = useMemo(
    () =>
      members
        .filter((m) => m.role !== 'viewer')
        .map((m) => peopleById.get(m.user_id))
        .filter((p): p is DirectoryPerson => Boolean(p))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members, peopleById],
  );
  const mentionable = useMemo(
    () => members.map((m) => peopleById.get(m.user_id)).filter((p): p is DirectoryPerson => Boolean(p)),
    [members, peopleById],
  );

  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ task, patch }, { onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save') });

  const canDelete = isLead || (task.reporter_id === user?.id && canEdit);

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        {parent ? (
          <button type="button" onClick={() => onOpenTask(parent.id)} className="text-[12px] text-muted-foreground hover:text-foreground">
            {project.key}-{parent.number} /
          </button>
        ) : null}
        <SheetTitle className="text-[13px] font-medium text-muted-foreground">{ref}</SheetTitle>
        <SheetDescription className="sr-only">Task details for {task.title}</SheetDescription>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            label="Copy link"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/projects/${project.id}?task=${task.id}`);
              toast.success('Link copied');
            }}
          >
            <Link2 className="h-4 w-4" />
          </IconButton>
          {canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    if (!window.confirm(`Delete ${ref}${task.parent_id ? '' : ' and its subtasks'}? This cannot be undone.`)) return;
                    remove.mutate(task, {
                      onSuccess: () => {
                        toast.success(`${ref} deleted`);
                        onClose();
                      },
                      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete'),
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          <TitleField value={task.title} disabled={!canEdit} onSave={(title) => save({ title })} />

          <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Select value={task.status_id} disabled={!canEdit} onValueChange={(status_id) => save({ status_id })}>
                <SelectTrigger className="h-8 w-48 border-transparent px-2 shadow-none hover:bg-muted" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <StatusIcon category={s.category} name={s.name} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Priority</dt>
            <dd>
              <Select value={task.priority} disabled={!canEdit} onValueChange={(v) => save({ priority: v as Task['priority'] })}>
                <SelectTrigger className="h-8 w-48 border-transparent px-2 shadow-none hover:bg-muted" aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <PriorityIcon priority={p.value} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Assignee</dt>
            <dd>
              <Select
                value={task.assignee_id ?? 'none'}
                disabled={!canEdit}
                onValueChange={(v) => save({ assignee_id: v === 'none' ? null : v })}
              >
                <SelectTrigger className="h-8 w-48 border-transparent px-2 shadow-none hover:bg-muted" aria-label="Assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  {assignable.map((person) => (
                    <SelectItem key={person.user_id} value={person.user_id}>
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={person} className="h-5 w-5 rounded-full" />
                        {person.full_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Due date</dt>
            <dd className="flex items-center gap-1">
              <input
                type="date"
                value={task.due_date ?? ''}
                disabled={!canEdit}
                aria-label="Due date"
                onChange={(e) => save({ due_date: e.target.value || null })}
                className="h-8 rounded-md bg-transparent px-2 text-[13px] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              {task.due_date && canEdit ? (
                <IconButton label="Clear due date" onClick={() => save({ due_date: null })}>
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
            </dd>

            <dt className="text-muted-foreground">Labels</dt>
            <dd>
              <LabelsField task={task} bundle={bundle} canEdit={canEdit} />
            </dd>
          </dl>

          <DescriptionField
            value={task.description}
            disabled={!canEdit}
            peopleById={peopleById}
            meId={user?.id}
            onSave={(description) => save({ description })}
          />

          {!task.parent_id ? (
            <Subtasks
              task={task}
              bundle={bundle}
              allTasks={allTasks}
              peopleById={peopleById}
              canEdit={canEdit}
              onOpenTask={onOpenTask}
            />
          ) : null}

          <Attachments task={task} attachments={detail.data?.attachments ?? []} canEdit={canEdit} isLead={isLead} />

          <section aria-label="Activity">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Activity</h3>
            <Timeline
              comments={detail.data?.comments ?? []}
              activity={detail.data?.activity ?? []}
              peopleById={peopleById}
              statusName={status?.name}
              task={task}
              isLead={isLead}
            />
          </section>
        </div>
      </div>

      {canEdit ? (
        <div className="shrink-0 border-t border-border p-3">
          <CommentComposer task={task} people={mentionable} />
        </div>
      ) : null}
    </>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function TitleField({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };
  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      disabled={disabled}
      aria-label="Title"
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="block w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-[20px] font-semibold leading-snug outline-none hover:bg-muted/50 focus:bg-muted/50 disabled:opacity-100"
    />
  );
}

function DescriptionField({
  value,
  disabled,
  peopleById,
  meId,
  onSave,
}: {
  value: string;
  disabled: boolean;
  peopleById: Map<string, DirectoryPerson>;
  meId?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <section aria-label="Description">
      <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === 'Escape') {
                setDraft(value);
                setEditing(false);
              }
            }}
            rows={8}
            placeholder="Add details, acceptance criteria, links…"
            className="block w-full resize-y rounded-md border border-border bg-card p-3 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-muted-foreground">**bold**, _italic_, `code`, ```blocks``` · Ctrl+Enter to save</span>
            <button type="button" onClick={() => (setDraft(value), setEditing(false))} className="h-7 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button type="button" onClick={commit} className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
              Save
            </button>
          </div>
        </div>
      ) : value ? (
        <div
          role={disabled ? undefined : 'button'}
          tabIndex={disabled ? undefined : 0}
          onClick={() => !disabled && setEditing(true)}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && setEditing(true)}
          className={cn('break-words rounded-md px-1 py-1 text-[13px] leading-relaxed', !disabled && 'cursor-text hover:bg-muted/50')}
        >
          <RichText body={value} byId={peopleById} meId={meId} />
        </div>
      ) : disabled ? (
        <p className="text-[13px] text-muted-foreground">No description.</p>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full rounded-md px-1 py-1 text-left text-[13px] text-muted-foreground hover:bg-muted/50">
          Add a description…
        </button>
      )}
    </section>
  );
}

function LabelsField({ task, bundle, canEdit }: { task: Task; bundle: ProjectBundle; canEdit: boolean }) {
  const { labels, project } = bundle;
  const { create, toggle } = useLabelMutations(project.id);
  const [name, setName] = useState('');
  const active = new Set(task.task_labels.map((l) => l.label_id));
  const current = labels.filter((l) => active.has(l.id));

  const content = (
    <div className="flex min-h-8 flex-wrap items-center gap-1 px-2">
      {current.length === 0 ? <span className="text-muted-foreground">{canEdit ? 'Add labels' : 'None'}</span> : null}
      {current.map((l) => (
        <LabelChip key={l.id} label={l} />
      ))}
    </div>
  );

  if (!canEdit) return content;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-md text-left hover:bg-muted" aria-label="Edit labels">
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="max-h-56 overflow-y-auto">
          {labels.length === 0 ? <p className="px-2 py-1.5 text-[12px] text-muted-foreground">No labels yet.</p> : null}
          {labels.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle.mutate({ task, labelId: l.id, on: !active.has(l.id) })}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            >
              <span className={cn('flex h-4 w-4 items-center justify-center rounded border border-border', active.has(l.id) && 'border-primary bg-primary text-primary-foreground')}>
                {active.has(l.id) ? <Check className="h-3 w-3" /> : null}
              </span>
              <LabelChip label={l} />
            </button>
          ))}
        </div>
        <form
          className="mt-1 flex items-center gap-1 border-t border-border pt-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = name.trim();
            if (!value) return;
            try {
              const color = PROJECT_COLORS[labels.length % PROJECT_COLORS.length];
              const label = await create.mutateAsync({ name: value, color });
              setName('');
              toggle.mutate({ task, labelId: label.id, on: true });
            } catch (error) {
              toast.error(/duplicate|unique/i.test(String(error)) ? 'That label already exists' : 'Could not create label');
            }
          }}
        >
          <Tag className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New label"
            aria-label="New label name"
            maxLength={30}
            className="h-7 min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Subtasks({
  task,
  bundle,
  allTasks,
  peopleById,
  canEdit,
  onOpenTask,
}: {
  task: Task;
  bundle: ProjectBundle;
  allTasks: Task[];
  peopleById: Map<string, DirectoryPerson>;
  canEdit: boolean;
  onOpenTask: (id: string) => void;
}) {
  const subtasks = allTasks.filter((t) => t.parent_id === task.id).sort((a, b) => a.number - b.number);
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState('');
  const doneStatus = bundle.statuses.find((s) => s.category === 'done');
  const todoStatus = bundle.statuses.find((s) => s.category === 'todo' && s.name.toLowerCase() !== 'backlog') ?? bundle.statuses[0];
  const done = subtasks.filter((s) => s.completed_at).length;

  return (
    <section aria-label="Subtasks">
      <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Subtasks
        {subtasks.length > 0 ? (
          <span className="font-medium normal-case tracking-normal">
            {done}/{subtasks.length}
          </span>
        ) : null}
      </h3>
      <ul className="space-y-0.5">
        {subtasks.map((s) => {
          const isDone = Boolean(s.completed_at);
          const assignee = s.assignee_id ? peopleById.get(s.assignee_id) : undefined;
          return (
            <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
              <button
                type="button"
                disabled={!canEdit || !doneStatus}
                aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                onClick={() => update.mutate({ task: s, patch: { status_id: isDone ? todoStatus.id : doneStatus!.id } })}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50 hover:border-foreground',
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : null}
              </button>
              <button type="button" onClick={() => onOpenTask(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {bundle.project.key}-{s.number}
                </span>
                <span className={cn('truncate text-[13px]', isDone && 'text-muted-foreground line-through')}>{s.title}</span>
              </button>
              {assignee ? <PersonAvatar person={assignee} className="h-5 w-5 rounded-full" /> : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <form
          className="mt-1 flex items-center gap-2 rounded-md px-1 py-1"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = title.trim();
            if (!value) return;
            setTitle('');
            try {
              await create.mutateAsync({ projectId: task.project_id, title: value, parentId: task.id, statusId: todoStatus?.id });
            } catch (error) {
              setTitle(value);
              toast.error(error instanceof Error ? error.message : 'Could not add subtask');
            }
          }}
        >
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a subtask"
            aria-label="Add a subtask"
            className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </form>
      ) : null}
    </section>
  );
}

function Attachments({ task, attachments, canEdit, isLead }: { task: Task; attachments: TaskAttachment[]; canEdit: boolean; isLead: boolean }) {
  const { user } = useAuth();
  const { upload, remove } = useAttachmentMutations(task);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!canEdit && attachments.length === 0) return null;
  return (
    <section aria-label="Attachments">
      <h3 className="mb-1.5 flex items-center text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Attachments
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                const tooBig = files.find((f) => f.size > 25 * 1024 * 1024);
                if (tooBig) {
                  toast.error(`${tooBig.name} is larger than 25 MB`);
                  return;
                }
                if (files.length) upload.mutate(files, { onError: (err) => toast.error(err instanceof Error ? err.message : 'Upload failed') });
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium normal-case tracking-normal text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5" /> {upload.isPending ? 'Uploading…' : 'Attach'}
            </button>
          </>
        ) : null}
      </h3>
      {attachments.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              canRemove={a.uploader_id === user?.id || isLead}
              onRemove={() => {
                if (window.confirm(`Remove ${a.file_name}?`)) remove.mutate(a);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No files.</p>
      )}
    </section>
  );
}

function AttachmentRow({ attachment, canRemove, onRemove }: { attachment: TaskAttachment; canRemove: boolean; onRemove: () => void }) {
  const { data: url } = useSignedProjectFile(attachment.storage_path);
  return (
    <li className="group flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
      <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <a href={url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium hover:underline">{attachment.file_name}</span>
        <span className="block text-[11px] text-muted-foreground">{formatBytes(attachment.size_bytes)}</span>
      </a>
      {canRemove ? (
        <button type="button" aria-label={`Remove ${attachment.file_name}`} onClick={onRemove} className="invisible rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:visible">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function describeActivity(a: TaskActivity, peopleById: Map<string, DirectoryPerson>) {
  const d = a.data as Record<string, string | null>;
  const person = (id: string | null) => (id ? peopleById.get(id)?.full_name ?? 'someone' : 'nobody');
  switch (a.kind) {
    case 'created':
      return 'created the task';
    case 'status':
      return `moved from ${d.from} to ${d.to}`;
    case 'assignee':
      return d.to ? `assigned ${person(d.to)}` : `unassigned ${person(d.from)}`;
    case 'priority':
      return `set priority to ${PRIORITIES.find((p) => p.value === d.to)?.label.toLowerCase() ?? d.to}`;
    case 'due_date':
      return d.to ? `set the due date to ${d.to}` : 'removed the due date';
    case 'title':
      return 'renamed the task';
    default:
      return 'updated the task';
  }
}

function Timeline({
  comments,
  activity,
  peopleById,
  task,
  isLead,
}: {
  comments: TaskComment[];
  activity: TaskActivity[];
  peopleById: Map<string, DirectoryPerson>;
  statusName?: string;
  task: Task;
  isLead: boolean;
}) {
  const { user } = useAuth();
  const { remove } = useCommentMutations(task);
  const items = useMemo(
    () =>
      [
        ...comments.map((c) => ({ type: 'comment' as const, at: c.created_at, comment: c })),
        ...activity.map((a) => ({ type: 'activity' as const, at: a.created_at, activity: a })),
      ].sort((a, b) => a.at.localeCompare(b.at)),
    [comments, activity],
  );

  return (
    <ol className="space-y-3">
      {items.map((item) =>
        item.type === 'activity' ? (
          <li key={`a-${item.activity.id}`} className="flex items-center gap-2 pl-1 text-[12px] text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
            <span className="font-medium text-foreground/80">{peopleById.get(item.activity.actor_id ?? '')?.full_name ?? 'Someone'}</span>
            <span className="truncate">{describeActivity(item.activity, peopleById)}</span>
            <span className="ml-auto shrink-0">{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</span>
          </li>
        ) : (
          <li key={`c-${item.comment.id}`} className="group flex gap-2.5">
            <PersonAvatar person={peopleById.get(item.comment.user_id ?? '')} className="h-7 w-7" />
            <div className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold">{peopleById.get(item.comment.user_id ?? '')?.full_name ?? 'Former member'}</span>
                <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</span>
                {item.comment.user_id === user?.id || isLead ? (
                  <button
                    type="button"
                    onClick={() => window.confirm('Delete this comment?') && remove.mutate(item.comment.id)}
                    className="invisible ml-auto text-[11px] text-muted-foreground hover:text-destructive group-hover:visible"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="mt-0.5 break-words text-[13px] leading-relaxed">
                <RichText body={item.comment.body} byId={peopleById} meId={user?.id} />
              </div>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

function CommentComposer({ task, people }: { task: Task; people: DirectoryPerson[] }) {
  const { add } = useCommentMutations(task);
  return (
    <Composer
      key={task.id}
      compact
      autoFocus={false}
      allowFiles={false}
      people={people}
      placeholder="Leave a comment… use @ to mention"
      onSubmit={({ body, mentions }) => add.mutateAsync({ body, mentions })}
    />
  );
}

