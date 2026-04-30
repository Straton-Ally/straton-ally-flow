-- Work Module Redesign: ClickUp-like structure
-- Teams → Projects → Tasks → Comments + Team Chat
-- Created: 2026-04-30

-- =============================================
-- TEAMS (Primary organizational unit)
-- =============================================
CREATE TABLE work_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_teams ENABLE ROW LEVEL SECURITY;

-- Team members with roles
CREATE TABLE work_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES work_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

ALTER TABLE work_team_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROJECTS (Group tasks within teams)
-- =============================================
CREATE TABLE work_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES work_teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366F1',
    status TEXT NOT NULL CHECK (status IN ('active', 'on_hold', 'archived')) DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_projects ENABLE ROW LEVEL SECURITY;

-- Project members (who has access to project)
CREATE TABLE work_project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

ALTER TABLE work_project_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TASKS (Redesigned with subtasks support)
-- =============================================
CREATE TABLE work_tasks_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES work_tasks_v2(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')) DEFAULT 'todo',
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date DATE,
    start_date DATE,
    estimated_hours DECIMAL(10,2),
    actual_hours DECIMAL(10,2) DEFAULT 0,
    position INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_tasks_v2 ENABLE ROW LEVEL SECURITY;

-- Task subtasks relationship view
CREATE VIEW work_task_subtasks AS
SELECT * FROM work_tasks_v2 WHERE parent_id IS NOT NULL;

-- =============================================
-- TASK COMMENTS (Threaded comments on tasks)
-- =============================================
CREATE TABLE work_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES work_tasks_v2(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES work_task_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions TEXT[] DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_task_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TEAM CHAT ROOMS (Dedicated chat per team)
-- =============================================
CREATE TABLE work_chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES work_teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('text', 'announcement')) DEFAULT 'text',
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_chat_rooms ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE work_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES work_chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions TEXT[] DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR work_teams
-- =============================================

-- Everyone can read teams they're members of
CREATE POLICY "work_teams_select" ON work_teams FOR SELECT
    USING (id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()));

-- Team owners/admins can insert
CREATE POLICY "work_teams_insert" ON work_teams FOR INSERT
    WITH CHECK (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM work_team_members 
        WHERE team_id = work_teams.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Team owners/admins can update
CREATE POLICY "work_teams_update" ON work_teams FOR UPDATE
    USING (id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================
-- RLS POLICIES FOR work_team_members
-- =============================================
CREATE POLICY "work_team_members_select" ON work_team_members FOR SELECT
    USING (team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()));

CREATE POLICY "work_team_members_insert" ON work_team_members FOR INSERT
    WITH CHECK (auth.uid() IN (
        SELECT user_id FROM work_team_members WHERE team_id = work_team_members.team_id AND role IN ('owner', 'admin')
    ) OR auth.uid() = work_team_members.user_id);

CREATE POLICY "work_team_members_delete" ON work_team_members FOR DELETE
    USING (auth.uid() IN (
        SELECT user_id FROM work_team_members WHERE team_id = work_team_members.team_id AND role IN ('owner', 'admin')
    ));

-- =============================================
-- RLS POLICIES FOR work_projects
-- =============================================
CREATE POLICY "work_projects_select" ON work_projects FOR SELECT
    USING (
        team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid())
        OR id IN (SELECT project_id FROM work_project_members WHERE user_id = auth.uid())
    );

CREATE POLICY "work_projects_insert" ON work_projects FOR INSERT
    WITH CHECK (team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "work_projects_update" ON work_projects FOR UPDATE
    USING (team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================
-- RLS POLICIES FOR work_project_members
-- =============================================
CREATE POLICY "work_project_members_select" ON work_project_members FOR SELECT
    USING (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()))
    );

CREATE POLICY "work_project_members_insert" ON work_project_members FOR INSERT
    WITH CHECK (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) OR auth.uid() = work_project_members.user_id)
    );

-- =============================================
-- RLS POLICIES FOR work_tasks_v2
-- =============================================
CREATE POLICY "work_tasks_v2_select" ON work_tasks_v2 FOR SELECT
    USING (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()))
        OR assignee_id = auth.uid()
        OR reporter_id = auth.uid()
    );

CREATE POLICY "work_tasks_v2_insert" ON work_tasks_v2 FOR INSERT
    WITH CHECK (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()))
        OR assignee_id = auth.uid()
    );

CREATE POLICY "work_tasks_v2_update" ON work_tasks_v2 FOR UPDATE
    USING (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
        OR assignee_id = auth.uid()
        OR reporter_id = auth.uid()
    );

CREATE POLICY "work_tasks_v2_delete" ON work_tasks_v2 FOR DELETE
    USING (
        project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
    );

-- =============================================
-- RLS POLICIES FOR work_task_comments
-- =============================================
CREATE POLICY "work_task_comments_select" ON work_task_comments FOR SELECT
    USING (
        task_id IN (SELECT id FROM work_tasks_v2 WHERE project_id IN (SELECT id FROM work_projects WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid())))
    );

CREATE POLICY "work_task_comments_insert" ON work_task_comments FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "work_task_comments_update" ON work_task_comments FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "work_task_comments_delete" ON work_task_comments FOR DELETE
    USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES FOR work_chat_rooms
-- =============================================
CREATE POLICY "work_chat_rooms_select" ON work_chat_rooms FOR SELECT
    USING (team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()));

CREATE POLICY "work_chat_rooms_insert" ON work_chat_rooms FOR INSERT
    WITH CHECK (team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- =============================================
-- RLS POLICIES FOR work_chat_messages
-- =============================================
CREATE POLICY "work_chat_messages_select" ON work_chat_messages FOR SELECT
    USING (
        room_id IN (SELECT id FROM work_chat_rooms WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()))
    );

CREATE POLICY "work_chat_messages_insert" ON work_chat_messages FOR INSERT
    WITH CHECK (
        room_id IN (SELECT id FROM work_chat_rooms WHERE team_id IN (SELECT team_id FROM work_team_members WHERE user_id = auth.uid()))
    );

CREATE POLICY "work_chat_messages_update" ON work_chat_messages FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "work_chat_messages_delete" ON work_chat_messages FOR DELETE
    USING (user_id = auth.uid());

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
-- Get user's teams with member info
CREATE OR REPLACE FUNCTION get_user_teams(user_uuid UUID)
RETURNS TABLE (
    team_id UUID,
    name TEXT,
    description TEXT,
    avatar_url TEXT,
    role TEXT,
    member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wt.id,
        wt.name,
        wt.description,
        wt.avatar_url,
        wtm.role,
        COUNT(wtm2.user_id)::BIGINT as member_count
    FROM work_teams wt
    JOIN work_team_members wtm ON wt.id = wtm.team_id
    LEFT JOIN work_team_members wtm2 ON wt.id = wtm2.team_id
    WHERE wtm.user_id = user_uuid
    GROUP BY wt.id, wt.name, wt.description, wt.avatar_url, wtm.role;
END;
$$;

-- Get project tasks with assignee info
CREATE OR REPLACE FUNCTION get_project_tasks(project_uuid UUID, status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    assignee_id UUID,
    assignee_name TEXT,
    due_date DATE,
    tags TEXT[],
    subtask_count BIGINT,
    comment_count BIGINT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wt.id,
        wt.title,
        wt.description,
        wt.status,
        wt.priority,
        wt.assignee_id,
        COALESCE(p.full_name, e.full_name)::TEXT as assignee_name,
        wt.due_date,
        wt.tags,
        (SELECT COUNT(*) FROM work_tasks_v2 WHERE parent_id = wt.id)::BIGINT as subtask_count,
        (SELECT COUNT(*) FROM work_task_comments WHERE task_id = wt.id)::BIGINT as comment_count,
        wt.created_at
    FROM work_tasks_v2 wt
    LEFT JOIN profiles p ON wt.assignee_id = p.user_id
    LEFT JOIN employees e ON p.user_id = e.user_id
    WHERE wt.project_id = project_uuid
        AND wt.parent_id IS NULL
        AND (status_filter IS NULL OR wt.status = status_filter)
    ORDER BY wt.position, wt.created_at;
END;
$$;

-- =============================================
-- MIGRATE EXISTING DATA (Optional - run manually if needed)
-- =============================================
-- This can be run separately to migrate existing work_tasks to work_tasks_v2
/*
-- Create default team from existing offices
INSERT INTO work_teams (name, description, created_by)
SELECT name, description, created_by FROM offices WHERE id IS NOT NULL;

-- Migrate existing work_tasks to work_tasks_v2
INSERT INTO work_tasks_v2 (project_id, title, description, status, priority, assignee_id, reporter_id, due_date, tags, created_by, created_at)
SELECT 
    (SELECT id FROM work_projects LIMIT 1),
    title,
    description,
    CASE status 
        WHEN 'todo' THEN 'todo'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'review' THEN 'review'
        WHEN 'complete' THEN 'done'
        ELSE 'backlog'
    END,
    priority,
    assignee_id,
    creator_id,
    due_date,
    tags,
    creator_id,
    created_at
FROM work_tasks;
*/