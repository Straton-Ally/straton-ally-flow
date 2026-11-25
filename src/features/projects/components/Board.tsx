import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { DirectoryPerson } from '@/features/chat/types';
import { useCreateTask, useRebalanceColumn, useUpdateTask } from '../api';
import { needsRebalance, positionBetween } from '../lib';
import type { Label, ProjectStatus, Task } from '../types';
import { StatusIcon } from './bits';
import { TaskCard } from './TaskCard';

interface BoardProps {
  projectId: string;
  projectKey: string;
  statuses: ProjectStatus[];
  tasks: Task[]; // already filtered, top-level only
  allTasks: Task[];
  labelsById: Map<string, Label>;
  peopleById: Map<string, DirectoryPerson>;
  canEdit: boolean;
  onOpenTask: (task: Task) => void;
}

type Columns = Record<string, string[]>;

/**
 * Whatever is under the pointer wins (a card, else its column). closestCorners
 * would favour cards in the source column over a tall, mostly empty column.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export function Board({ projectId, projectKey, statuses, tasks, allTasks, labelsById, peopleById, canEdit, onOpenTask }: BoardProps) {
  const updateTask = useUpdateTask();
  const rebalance = useRebalanceColumn(projectId);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const doneStatusIds = useMemo(() => new Set(statuses.filter((s) => s.category === 'done').map((s) => s.id)), [statuses]);

  const subtaskStats = useMemo(() => {
    const stats = new Map<string, { total: number; done: number }>();
    for (const t of allTasks) {
      if (!t.parent_id) continue;
      const s = stats.get(t.parent_id) ?? { total: 0, done: 0 };
      s.total += 1;
      if (t.completed_at) s.done += 1;
      stats.set(t.parent_id, s);
    }
    return stats;
  }, [allTasks]);

  const derived = useMemo(() => {
    const cols: Columns = Object.fromEntries(statuses.map((s) => [s.id, [] as string[]]));
    for (const t of [...tasks].sort((a, b) => a.position - b.position)) cols[t.status_id]?.push(t.id);
    return cols;
  }, [statuses, tasks]);

  const [columns, setColumns] = useState<Columns>(derived);
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId) setColumns(derived);
  }, [derived, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string) => (id in columns ? id : Object.keys(columns).find((key) => columns[key].includes(id)));

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const fromItems = prev[from].filter((id) => id !== active.id);
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(String(over.id));
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, String(active.id));
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    if (!over) {
      setColumns(derived);
      return;
    }
    const column = findColumn(id);
    const overColumn = findColumn(String(over.id));
    if (!column || !overColumn) return;

    let list = columns[column];
    if (column === overColumn && over.id !== active.id && list.includes(String(over.id))) {
      list = arrayMove(list, list.indexOf(id), list.indexOf(String(over.id)));
      setColumns((prev) => ({ ...prev, [column]: list }));
    }
    const index = list.indexOf(id);
    const before = tasksById.get(list[index - 1])?.position;
    const after = tasksById.get(list[index + 1])?.position;
    const task = tasksById.get(id);
    if (!task) return;
    const position = positionBetween(before, after);
    if (task.status_id === column && task.position === position) return;
    if (task.status_id === column && before !== undefined && after !== undefined && task.position > before && task.position < after) return;

    updateTask.mutate(
      { task, patch: { status_id: column, position } },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not move the task'),
        onSuccess: () => {
          if (needsRebalance(before, after)) rebalance.mutate(column);
        },
      },
    );
  };

  const activeTask = activeId ? tasksById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setColumns(derived);
      }}
    >
      <div className="flex h-full min-h-0 gap-3 overflow-x-auto px-4 pb-4 pt-3">
        {statuses.map((status) => (
          <Column
            key={status.id}
            status={status}
            projectId={projectId}
            count={columns[status.id]?.length ?? 0}
            canEdit={canEdit}
            lastPosition={tasksById.get(columns[status.id]?.at(-1) ?? '')?.position}
          >
            <SortableContext items={columns[status.id] ?? []} strategy={verticalListSortingStrategy}>
              {(columns[status.id] ?? []).map((taskId) => {
                const task = tasksById.get(taskId);
                if (!task) return null;
                return (
                  <SortableCard key={taskId} id={taskId} disabled={!canEdit}>
                    <TaskCard
                      task={task}
                      projectKey={projectKey}
                      labelsById={labelsById}
                      assignee={task.assignee_id ? peopleById.get(task.assignee_id) : undefined}
                      subtasks={subtaskStats.get(task.id)}
                      done={doneStatusIds.has(task.status_id)}
                      dragging={activeId === taskId}
                      onOpen={() => onOpenTask(task)}
                    />
                  </SortableCard>
                );
              })}
            </SortableContext>
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTask ? (
          <div className="w-[272px]">
            <TaskCard
              task={activeTask}
              projectKey={projectKey}
              labelsById={labelsById}
              assignee={activeTask.assignee_id ? peopleById.get(activeTask.assignee_id) : undefined}
              subtasks={subtaskStats.get(activeTask.id)}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function Column({
  status,
  projectId,
  count,
  canEdit,
  lastPosition,
  children,
}: {
  status: ProjectStatus;
  projectId: string;
  count: number;
  canEdit: boolean;
  lastPosition?: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const createTask = useCreateTask();

  const submit = async () => {
    const value = title.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    setTitle('');
    try {
      await createTask.mutateAsync({ projectId, title: value, statusId: status.id, position: positionBetween(lastPosition, undefined) });
    } catch (e) {
      setTitle(value);
      toast.error(e instanceof Error ? e.message : 'Could not create the task');
    }
  };

  return (
    <section className="flex w-[272px] shrink-0 flex-col rounded-lg bg-muted/40" aria-label={status.name}>
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        <StatusIcon category={status.category} name={status.name} />
        <h3 className="text-[13px] font-semibold">{status.name}</h3>
        <span className="text-[12px] tabular-nums text-muted-foreground">{count}</span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add task to ${status.name}`}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </header>
      <div ref={setNodeRef} className={`flex min-h-[60px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 ${isOver ? 'bg-primary/5' : ''}`}>
        {children}
        {adding ? (
          <div className="rounded-md border border-ring/50 bg-card p-2">
            <textarea
              autoFocus
              value={title}
              rows={2}
              placeholder="Task title"
              aria-label="New task title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
                if (e.key === 'Escape') {
                  setAdding(false);
                  setTitle('');
                }
              }}
              onBlur={() => {
                if (!title.trim()) setAdding(false);
              }}
              className="block w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Enter to add · Esc to cancel</p>
          </div>
        ) : canEdit && count === 0 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-border py-3 text-[12px] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          >
            Add a task
          </button>
        ) : null}
      </div>
    </section>
  );
}
