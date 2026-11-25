-- Projects + Kanban (Trello replacement).
-- Access model:
--   * Admins see and manage every project.
--   * Everyone else sees only projects they are a member of.
--   * Project roles: lead (manage project + members + statuses), member (create / edit tasks),
--     viewer (read only).
--   * Only admins and managers can create projects (permission projects.create).

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  description text CHECK (length(description) <= 4000),
  color text NOT NULL DEFAULT 'indigo' CHECK (color ~ '^[a-z]{3,12}$'),
  lead_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task_seq integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_key_key ON public.projects (key);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON public.project_members (user_id);

CREATE TABLE IF NOT EXISTS public.project_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  category text NOT NULL CHECK (category IN ('todo', 'doing', 'done')),
  position double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_statuses_project_idx ON public.project_statuses (project_id, position);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  -- NO ACTION (checked at statement end) so deleting a whole project can cascade
  status_id uuid NOT NULL REFERENCES public.project_statuses(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
  priority text NOT NULL DEFAULT 'none' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  position double precision NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);
CREATE INDEX IF NOT EXISTS tasks_board_idx ON public.tasks (project_id, status_id, position);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON public.tasks (assignee_id) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON public.tasks (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status_id);

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 30),
  color text NOT NULL DEFAULT 'slate' CHECK (color ~ '^[a-z]{3,12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS labels_project_name_key ON public.labels (project_id, lower(name));

CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS task_labels_label_idx ON public.task_labels (label_id);
CREATE INDEX IF NOT EXISTS task_labels_project_idx ON public.task_labels (project_id);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 8000),
  mentions uuid[] NOT NULL DEFAULT '{}',
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments (task_id, created_at);
CREATE INDEX IF NOT EXISTS task_comments_project_idx ON public.task_comments (project_id);

CREATE TABLE IF NOT EXISTS public.task_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_activity_task_idx ON public.task_activity (task_id, created_at);
CREATE INDEX IF NOT EXISTS task_activity_project_idx ON public.task_activity (project_id);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  mime_type text,
  size_bytes bigint CHECK (size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS task_attachments_project_idx ON public.task_attachments (project_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.projects, public.project_members, public.project_statuses, public.tasks, public.labels,
  public.task_labels, public.task_comments, public.task_activity, public.task_attachments FROM anon;

-- ---------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_role(_project_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.project_members
                 WHERE project_id = _project_id AND user_id = auth.uid() AND role IN ('lead', 'member'));
$$;

CREATE OR REPLACE FUNCTION public.is_project_lead(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.project_members
                 WHERE project_id = _project_id AND user_id = auth.uid() AND role = 'lead');
$$;

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------
-- projects
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (public.can_view_project(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_lead(id)) WITH CHECK (public.is_project_lead(id));

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- project_members
DROP POLICY IF EXISTS project_members_select ON public.project_members;
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS project_members_insert ON public.project_members;
CREATE POLICY project_members_insert ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_project_lead(project_id));

DROP POLICY IF EXISTS project_members_update ON public.project_members;
CREATE POLICY project_members_update ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_lead(project_id)) WITH CHECK (public.is_project_lead(project_id));

DROP POLICY IF EXISTS project_members_delete ON public.project_members;
CREATE POLICY project_members_delete ON public.project_members FOR DELETE TO authenticated
  USING (public.is_project_lead(project_id) OR user_id = auth.uid());

-- statuses
DROP POLICY IF EXISTS project_statuses_select ON public.project_statuses;
CREATE POLICY project_statuses_select ON public.project_statuses FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS project_statuses_write ON public.project_statuses;
CREATE POLICY project_statuses_write ON public.project_statuses FOR ALL TO authenticated
  USING (public.is_project_lead(project_id)) WITH CHECK (public.is_project_lead(project_id));

-- tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id) AND reporter_id = auth.uid());
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id)) WITH CHECK (public.can_edit_project(project_id));
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (public.is_project_lead(project_id) OR (reporter_id = auth.uid() AND public.can_edit_project(project_id)));

-- labels
DROP POLICY IF EXISTS labels_select ON public.labels;
CREATE POLICY labels_select ON public.labels FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS labels_write ON public.labels;
CREATE POLICY labels_write ON public.labels FOR ALL TO authenticated
  USING (public.can_edit_project(project_id)) WITH CHECK (public.can_edit_project(project_id));

-- task_labels (label and task must belong to the row's project)
DROP POLICY IF EXISTS task_labels_select ON public.task_labels;
CREATE POLICY task_labels_select ON public.task_labels FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS task_labels_insert ON public.task_labels;
CREATE POLICY task_labels_insert ON public.task_labels FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_project(project_id)
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_labels.task_id AND t.project_id = task_labels.project_id)
    AND EXISTS (SELECT 1 FROM public.labels l WHERE l.id = task_labels.label_id AND l.project_id = task_labels.project_id)
  );
DROP POLICY IF EXISTS task_labels_delete ON public.task_labels;
CREATE POLICY task_labels_delete ON public.task_labels FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id));

-- comments
DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
CREATE POLICY task_comments_select ON public.task_comments FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
CREATE POLICY task_comments_insert ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_project(project_id)
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND t.project_id = task_comments.project_id)
  );
DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
CREATE POLICY task_comments_update ON public.task_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_delete ON public.task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_project_lead(project_id));

-- activity is written by triggers only
DROP POLICY IF EXISTS task_activity_select ON public.task_activity;
CREATE POLICY task_activity_select ON public.task_activity FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

-- attachments
DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
CREATE POLICY task_attachments_select ON public.task_attachments FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
CREATE POLICY task_attachments_insert ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.can_edit_project(project_id)
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND t.project_id = task_attachments.project_id)
    AND split_part(storage_path, '/', 1) = project_id::text
  );
DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
CREATE POLICY task_attachments_delete ON public.task_attachments FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_project_lead(project_id));

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Projects: immutable bookkeeping, key uppercase.
CREATE OR REPLACE FUNCTION public.guard_project_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.key := upper(btrim(NEW.key));
  IF TG_OP = 'INSERT' THEN
    NEW.task_seq := 0;
    NEW.archived_at := NULL;
  ELSIF pg_trigger_depth() = 1 AND auth.uid() IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
    NEW.task_seq := OLD.task_seq;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_project_write ON public.projects;
CREATE TRIGGER aa_guard_project_write BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_write();

-- New project: creator (and chosen lead) become leads; seed default columns.
CREATE OR REPLACE FUNCTION public.setup_new_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'lead') ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.lead_id, 'lead')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
  END IF;
  INSERT INTO public.project_statuses (project_id, name, category, position) VALUES
    (NEW.id, 'Backlog', 'todo', 1024),
    (NEW.id, 'To do', 'todo', 2048),
    (NEW.id, 'In progress', 'doing', 3072),
    (NEW.id, 'In review', 'doing', 4096),
    (NEW.id, 'Done', 'done', 5120);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS setup_new_project ON public.projects;
CREATE TRIGGER setup_new_project AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.setup_new_project();

-- A project must always keep at least one lead.
CREATE OR REPLACE FUNCTION public.guard_last_project_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'lead'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'lead')
     AND EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id)
     AND NOT EXISTS (SELECT 1 FROM public.project_members
                     WHERE project_id = OLD.project_id AND role = 'lead' AND user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'A project needs at least one lead' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.project_id := OLD.project_id;
    NEW.user_id := OLD.user_id;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_last_project_lead ON public.project_members;
CREATE TRIGGER aa_guard_last_project_lead BEFORE UPDATE OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_project_lead();

-- Members must be active people.
CREATE OR REPLACE FUNCTION public.guard_project_member_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Only active people can be added to a project' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_project_member_insert ON public.project_members;
CREATE TRIGGER aa_guard_project_member_insert BEFORE INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_member_insert();

-- Statuses: stay in their project.
CREATE OR REPLACE FUNCTION public.guard_status_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.project_id := OLD.project_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_status_update ON public.project_statuses;
CREATE TRIGGER aa_guard_status_update BEFORE UPDATE ON public.project_statuses
  FOR EACH ROW EXECUTE FUNCTION public.guard_status_update();

-- Tasks: numbering, defaults, cross-project integrity, completion time.
CREATE OR REPLACE FUNCTION public.guard_task_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cat text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET task_seq = task_seq + 1 WHERE id = NEW.project_id
      RETURNING task_seq INTO NEW.number;
    IF NEW.number IS NULL THEN
      RAISE EXCEPTION 'Project not found' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF NEW.status_id IS NULL THEN
      SELECT id INTO NEW.status_id FROM public.project_statuses
       WHERE project_id = NEW.project_id ORDER BY (category <> 'todo'), position LIMIT 1;
    END IF;
    IF NEW.position IS NULL OR NEW.position = 0 THEN
      SELECT coalesce(max(position), 0) + 1024 INTO NEW.position
        FROM public.tasks WHERE project_id = NEW.project_id AND status_id = NEW.status_id;
    END IF;
    NEW.created_at := now();
    NEW.completed_at := NULL;
  ELSE
    NEW.id := OLD.id;
    NEW.project_id := OLD.project_id;
    NEW.number := OLD.number;
    NEW.reporter_id := OLD.reporter_id;
    NEW.created_at := OLD.created_at;
  END IF;

  SELECT category INTO cat FROM public.project_statuses WHERE id = NEW.status_id AND project_id = NEW.project_id;
  IF cat IS NULL THEN
    RAISE EXCEPTION 'Status does not belong to this project' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS (SELECT 1 FROM public.project_members
                     WHERE project_id = NEW.project_id AND user_id = NEW.assignee_id AND role IN ('lead', 'member')) THEN
    RAISE EXCEPTION 'Assignee must be a project member' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.parent_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    IF NEW.parent_id = NEW.id OR NOT EXISTS (
      SELECT 1 FROM public.tasks WHERE id = NEW.parent_id AND project_id = NEW.project_id AND parent_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Subtasks must belong to a top-level task in the same project' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF cat = 'done' THEN
    NEW.completed_at := coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.completed_at END, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_task_write ON public.tasks;
CREATE TRIGGER aa_guard_task_write BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_write();

-- Activity log + assignment notifications.
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  proj public.projects%ROWTYPE;
  actor_name text;
BEGIN
  SELECT * INTO proj FROM public.projects WHERE id = NEW.project_id;
  SELECT full_name INTO actor_name FROM public.profiles WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
    VALUES (NEW.id, NEW.project_id, actor, 'created', jsonb_build_object('title', NEW.title));
  ELSE
    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
      INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
      VALUES (NEW.id, NEW.project_id, actor, 'status',
        jsonb_build_object('from', (SELECT name FROM public.project_statuses WHERE id = OLD.status_id),
                           'to', (SELECT name FROM public.project_statuses WHERE id = NEW.status_id)));
    END IF;
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
      VALUES (NEW.id, NEW.project_id, actor, 'assignee', jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id));
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
      VALUES (NEW.id, NEW.project_id, actor, 'priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
      VALUES (NEW.id, NEW.project_id, actor, 'due_date', jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
      VALUES (NEW.id, NEW.project_id, actor, 'title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
    END IF;
  END IF;

  IF NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id IS DISTINCT FROM actor
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
    VALUES (
      NEW.assignee_id, actor, 'task_assigned',
      coalesce(actor_name, 'Someone') || ' assigned you ' || proj.key || '-' || NEW.number,
      left(NEW.title, 140),
      '/projects/' || NEW.project_id || '?task=' || NEW.id,
      jsonb_build_object('project_id', NEW.project_id, 'task_id', NEW.id)
    );
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS log_task_activity ON public.tasks;
CREATE TRIGGER log_task_activity AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();

-- Comments: immutable bookkeeping on edit, notify mentions + assignee.
CREATE OR REPLACE FUNCTION public.guard_task_comment_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.task_id := OLD.task_id;
  NEW.project_id := OLD.project_id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  IF NEW.body IS DISTINCT FROM OLD.body THEN NEW.edited_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_guard_task_comment_update ON public.task_comments;
CREATE TRIGGER aa_guard_task_comment_update BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_comment_update();

CREATE OR REPLACE FUNCTION public.handle_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.tasks%ROWTYPE;
  proj_key text;
  author_name text;
  preview text;
  target uuid;
  ref text;
  link text;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = NEW.task_id;
  SELECT key INTO proj_key FROM public.projects WHERE id = NEW.project_id;
  SELECT full_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
  ref := proj_key || '-' || t.number;
  link := '/projects/' || NEW.project_id || '?task=' || NEW.task_id;

  preview := NEW.body;
  FOREACH target IN ARRAY NEW.mentions LOOP
    preview := replace(preview, '<@' || target || '>',
      '@' || coalesce((SELECT full_name FROM public.profiles WHERE id = target), 'someone'));
  END LOOP;
  preview := left(regexp_replace(preview, '\s+', ' ', 'g'), 140);

  INSERT INTO public.task_activity (task_id, project_id, actor_id, kind, data)
  VALUES (NEW.task_id, NEW.project_id, NEW.user_id, 'comment', jsonb_build_object('comment_id', NEW.id));

  -- mentioned people who can see the project
  FOREACH target IN ARRAY NEW.mentions LOOP
    IF target IS DISTINCT FROM NEW.user_id
       AND EXISTS (SELECT 1 FROM public.project_members WHERE project_id = NEW.project_id AND user_id = target) THEN
      INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
      VALUES (target, NEW.user_id, 'mention', coalesce(author_name, 'Someone') || ' mentioned you on ' || ref,
              preview, link, jsonb_build_object('project_id', NEW.project_id, 'task_id', NEW.task_id));
    END IF;
  END LOOP;

  -- the assignee hears about comments on their task (unless mentioned or the author)
  IF t.assignee_id IS NOT NULL AND t.assignee_id IS DISTINCT FROM NEW.user_id
     AND NOT (t.assignee_id = ANY (NEW.mentions)) THEN
    INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
    VALUES (t.assignee_id, NEW.user_id, 'task_comment', coalesce(author_name, 'Someone') || ' commented on ' || ref,
            preview, link, jsonb_build_object('project_id', NEW.project_id, 'task_id', NEW.task_id));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS handle_task_comment ON public.task_comments;
CREATE TRIGGER handle_task_comment AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_comment();

-- Notification types for tasks.
ALTER TABLE public.work_notifications DROP CONSTRAINT IF EXISTS work_notifications_type_check;
ALTER TABLE public.work_notifications ADD CONSTRAINT work_notifications_type_check CHECK (type = ANY (ARRAY[
  'mention', 'message', 'attendance_checkout_reminder', 'attendance_auto_checkout', 'overtime_request',
  'overtime_approved', 'overtime_declined', 'early_checkout_request', 'early_checkout_response',
  'task_assigned', 'task_comment'
]));

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_projects()
RETURNS TABLE (
  id uuid, key text, name text, description text, color text, lead_id uuid, archived_at timestamptz,
  my_role text, member_count integer, open_count integer, done_count integer, my_open_count integer,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.key, p.name, p.description, p.color, p.lead_id, p.archived_at,
         coalesce(pm.role, CASE WHEN public.has_role(auth.uid(), 'admin') THEN 'admin' END),
         (SELECT count(*)::int FROM public.project_members m WHERE m.project_id = p.id),
         (SELECT count(*)::int FROM public.tasks t WHERE t.project_id = p.id AND t.completed_at IS NULL AND t.parent_id IS NULL),
         (SELECT count(*)::int FROM public.tasks t WHERE t.project_id = p.id AND t.completed_at IS NOT NULL AND t.parent_id IS NULL),
         (SELECT count(*)::int FROM public.tasks t WHERE t.project_id = p.id AND t.completed_at IS NULL AND t.assignee_id = auth.uid()),
         p.updated_at
  FROM public.projects p
  LEFT JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = auth.uid()
  WHERE pm.user_id IS NOT NULL OR public.has_role(auth.uid(), 'admin')
  ORDER BY p.archived_at NULLS FIRST, p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_my_tasks()
RETURNS TABLE (
  id uuid, project_id uuid, project_key text, project_name text, project_color text, number integer,
  title text, priority text, due_date date, status_id uuid, status_name text, status_category text,
  parent_id uuid, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.project_id, p.key, p.name, p.color, t.number, t.title, t.priority, t.due_date,
         s.id, s.name, s.category, t.parent_id, t.updated_at
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id AND p.archived_at IS NULL
  JOIN public.project_statuses s ON s.id = t.status_id
  WHERE t.assignee_id = auth.uid()
    AND t.completed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = t.project_id AND m.user_id = auth.uid())
  ORDER BY t.due_date NULLS LAST,
           array_position(ARRAY['urgent','high','medium','low','none'], t.priority),
           t.updated_at DESC
  LIMIT 500;
$$;

-- Evenly re-space a column when fractional positions get too close.
CREATE OR REPLACE FUNCTION public.rebalance_status_column(_status_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  SELECT project_id INTO pid FROM public.project_statuses WHERE id = _status_id;
  IF pid IS NULL OR NOT public.can_edit_project(pid) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.tasks t SET position = s.rn * 1024
  FROM (SELECT id, row_number() OVER (ORDER BY position, created_at) AS rn
        FROM public.tasks WHERE status_id = _status_id) s
  WHERE t.id = s.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.project_role(uuid, uuid), public.can_view_project(uuid), public.can_edit_project(uuid),
  public.is_project_lead(uuid), public.get_my_projects(), public.get_my_tasks(), public.rebalance_status_column(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_role(uuid, uuid), public.can_view_project(uuid), public.can_edit_project(uuid),
  public.is_project_lead(uuid), public.get_my_projects(), public.get_my_tasks(), public.rebalance_status_column(uuid)
  TO authenticated, service_role;
-- trigger functions are never called directly
REVOKE EXECUTE ON FUNCTION public.guard_project_write(), public.setup_new_project(), public.guard_last_project_lead(),
  public.guard_project_member_insert(), public.guard_status_update(), public.guard_task_write(), public.log_task_activity(),
  public.guard_task_comment_update(), public.handle_task_comment(), public.touch_updated_at()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: project-files/<project_id>/<task_id>/<random>/<file>
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.project_path_project(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS project_files_read ON storage.objects;
CREATE POLICY project_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND public.can_view_project(public.project_path_project(name)));

DROP POLICY IF EXISTS project_files_upload ON storage.objects;
CREATE POLICY project_files_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.can_edit_project(public.project_path_project(name)));

DROP POLICY IF EXISTS project_files_delete ON storage.objects;
CREATE POLICY project_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (owner = auth.uid() OR public.is_project_lead(public.project_path_project(name))));

-- ---------------------------------------------------------------------
-- Realtime: tasks and comments (RLS-checked INSERT/UPDATE).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'task_comments') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
    END IF;
  END IF;
END $$;
