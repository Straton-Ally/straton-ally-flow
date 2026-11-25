-- Projects access smoke checks. Run against a COPY of the database, never production.
-- Everything is rolled back at the end. Prints PASS/FAIL per check.
\set ON_ERROR_ROLLBACK on
\set QUIET on
\pset tuples_only on
BEGIN;

SELECT array_agg(user_id ORDER BY created_at) AS members
FROM (
  SELECT e.user_id, e.created_at FROM public.employees e
  JOIN public.profiles p ON p.id = e.user_id AND p.status = 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin','manager'))
  ORDER BY e.created_at LIMIT 3
) s \gset
SELECT (:'members'::uuid[])[1] AS a, (:'members'::uuid[])[2] AS b, (:'members'::uuid[])[3] AS c \gset
SELECT user_id AS mgr FROM public.user_roles WHERE role = 'manager'
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
  AND user_id IN (SELECT id FROM public.profiles WHERE status = 'active') LIMIT 1 \gset
SELECT user_id AS adm FROM public.user_roles WHERE role = 'admin' LIMIT 1 \gset

CREATE TEMP TABLE r (check_name text, passed boolean);
CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON r, ids TO authenticated, anon;
SELECT set_config('my.a', :'a', false), set_config('my.b', :'b', false), set_config('my.c', :'c', false);

-- ---------------------------------------------------------------- member a cannot create projects
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a')::text, true);
DO $$ BEGIN
  INSERT INTO public.projects (key, name, created_by) VALUES ('NOPE', 'Nope', auth.uid());
  INSERT INTO r VALUES ('member cannot create a project', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('member cannot create a project', true);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- manager creates a project
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'mgr')::text, true);
DO $$ DECLARE pid uuid; tid uuid; BEGIN
  INSERT INTO public.projects (key, name, created_by) VALUES ('ops', 'Operations', auth.uid()) RETURNING id INTO pid;
  INSERT INTO ids VALUES ('p', pid);
  INSERT INTO r SELECT 'key is uppercased', key = 'OPS' FROM public.projects WHERE id = pid;
  INSERT INTO r SELECT 'creator becomes lead', public.project_role(pid) = 'lead';
  INSERT INTO r SELECT 'five default columns', count(*) = 5 FROM public.project_statuses WHERE project_id = pid;
  INSERT INTO public.project_members (project_id, user_id, role) VALUES
    (pid, current_setting('my.a')::uuid, 'member'),
    (pid, current_setting('my.b')::uuid, 'viewer');
  INSERT INTO public.tasks (project_id, title, reporter_id, assignee_id)
  VALUES (pid, 'First task', auth.uid(), current_setting('my.a')::uuid) RETURNING id INTO tid;
  INSERT INTO ids VALUES ('t1', tid);
  INSERT INTO public.tasks (project_id, title, reporter_id) VALUES (pid, 'Second task', auth.uid());
  INSERT INTO r SELECT 'tasks numbered per project', array_agg(number ORDER BY number) = ARRAY[1,2]
    FROM public.tasks WHERE project_id = pid;
  INSERT INTO r SELECT 'new task lands in first todo column', s.name = 'Backlog'
    FROM public.tasks t JOIN public.project_statuses s ON s.id = t.status_id WHERE t.id = tid;
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('manager project setup: ' || SQLERRM, false);
END $$;

DO $$ BEGIN
  INSERT INTO public.tasks (project_id, title, reporter_id, assignee_id)
  VALUES ((SELECT v FROM ids WHERE k = 'p'), 'x', auth.uid(), current_setting('my.c')::uuid);
  INSERT INTO r VALUES ('cannot assign a non-member', false);
EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('cannot assign a non-member', true);
END $$;

DO $$ BEGIN
  DELETE FROM public.project_members WHERE project_id = (SELECT v FROM ids WHERE k = 'p') AND user_id = auth.uid();
  INSERT INTO r VALUES ('last lead cannot leave', false);
EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('last lead cannot leave', true);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- member a (project member)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a')::text, true);
INSERT INTO r SELECT 'assignee was notified',
  EXISTS (SELECT 1 FROM public.work_notifications WHERE user_id = auth.uid() AND type = 'task_assigned'
          AND metadata ->> 'task_id' = (SELECT v FROM ids WHERE k = 't1')::text);
INSERT INTO r SELECT 'member sees the project in get_my_projects',
  EXISTS (SELECT 1 FROM public.get_my_projects() WHERE id = (SELECT v FROM ids WHERE k = 'p') AND my_role = 'member');
INSERT INTO r SELECT 'task shows in my tasks',
  EXISTS (SELECT 1 FROM public.get_my_tasks() WHERE id = (SELECT v FROM ids WHERE k = 't1'));

DO $$ DECLARE done_id uuid; BEGIN
  SELECT id INTO done_id FROM public.project_statuses WHERE project_id = (SELECT v FROM ids WHERE k = 'p') AND category = 'done';
  UPDATE public.tasks SET status_id = done_id, number = 99 WHERE id = (SELECT v FROM ids WHERE k = 't1');
  INSERT INTO r SELECT 'moving to Done sets completed_at, number is locked', completed_at IS NOT NULL AND number = 1
    FROM public.tasks WHERE id = (SELECT v FROM ids WHERE k = 't1');
  INSERT INTO r SELECT 'status change is logged',
    EXISTS (SELECT 1 FROM public.task_activity WHERE task_id = (SELECT v FROM ids WHERE k = 't1') AND kind = 'status');
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('member moves task: ' || SQLERRM, false);
END $$;

DO $$ BEGIN
  INSERT INTO public.task_comments (task_id, project_id, user_id, body, mentions)
  VALUES ((SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'p'), auth.uid(), 'Done, see notes', '{}');
  INSERT INTO r VALUES ('member can comment', true);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('member can comment: ' || SQLERRM, false);
END $$;

DO $$ BEGIN
  UPDATE public.projects SET name = 'Hijacked' WHERE id = (SELECT v FROM ids WHERE k = 'p');
  INSERT INTO r SELECT 'member cannot rename the project', name = 'Operations' FROM public.projects WHERE id = (SELECT v FROM ids WHERE k = 'p');
END $$;

DO $$ BEGIN
  INSERT INTO public.project_members (project_id, user_id) VALUES ((SELECT v FROM ids WHERE k = 'p'), current_setting('my.c')::uuid);
  INSERT INTO r VALUES ('member cannot add people', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('member cannot add people', true);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- viewer b
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'b')::text, true);
INSERT INTO r SELECT 'viewer can read tasks', (SELECT count(*) FROM public.tasks WHERE project_id = (SELECT v FROM ids WHERE k = 'p')) = 2;
DO $$ BEGIN
  INSERT INTO public.tasks (project_id, title, reporter_id) VALUES ((SELECT v FROM ids WHERE k = 'p'), 'viewer task', auth.uid());
  INSERT INTO r VALUES ('viewer cannot create tasks', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('viewer cannot create tasks', true);
END $$;
DO $$ BEGIN
  UPDATE public.tasks SET title = 'changed by viewer' WHERE project_id = (SELECT v FROM ids WHERE k = 'p');
  INSERT INTO r SELECT 'viewer cannot edit tasks', NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'changed by viewer');
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- outsider c
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'c')::text, true);
INSERT INTO r SELECT 'outsider cannot see the project', NOT EXISTS (SELECT 1 FROM public.projects WHERE id = (SELECT v FROM ids WHERE k = 'p'));
INSERT INTO r SELECT 'outsider cannot see tasks', NOT EXISTS (SELECT 1 FROM public.tasks WHERE project_id = (SELECT v FROM ids WHERE k = 'p'));
INSERT INTO r SELECT 'outsider cannot see comments', NOT EXISTS (SELECT 1 FROM public.task_comments WHERE project_id = (SELECT v FROM ids WHERE k = 'p'));
DO $$ BEGIN
  INSERT INTO public.project_members (project_id, user_id, role) VALUES ((SELECT v FROM ids WHERE k = 'p'), auth.uid(), 'lead');
  INSERT INTO r VALUES ('outsider cannot add themselves', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('outsider cannot add themselves', true);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- admin
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'adm')::text, true);
INSERT INTO r SELECT 'admin sees every project', EXISTS (SELECT 1 FROM public.get_my_projects() WHERE id = (SELECT v FROM ids WHERE k = 'p'));
DO $$ BEGIN
  DELETE FROM public.projects WHERE id = (SELECT v FROM ids WHERE k = 'p');
  INSERT INTO r SELECT 'admin can delete a whole project', NOT EXISTS (SELECT 1 FROM public.projects WHERE id = (SELECT v FROM ids WHERE k = 'p'));
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('admin delete project: ' || SQLERRM, false);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- signed out
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.tasks LIMIT 1;
  INSERT INTO r VALUES ('anon cannot read tasks', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('anon cannot read tasks', true);
END $$;
RESET ROLE;

SELECT CASE WHEN passed THEN 'PASS  ' ELSE 'FAIL  ' END || check_name FROM r;
SELECT count(*) FILTER (WHERE NOT passed) || ' failed of ' || count(*) FROM r;
ROLLBACK;
