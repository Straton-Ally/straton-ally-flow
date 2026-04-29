# Graph Report - .  (2026-04-29)

## Corpus Check
- 150 files · ~99,009 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 420 edges · 23 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 64 edges
2. `getErrorMessage()` - 21 edges
3. `fetchEmployees()` - 10 edges
4. `signOut()` - 7 edges
5. `fetchOffices()` - 6 edges
6. `useToast()` - 6 edges
7. `fetchScheduleTemplates()` - 5 edges
8. `fetchDepartmentsOps()` - 5 edges
9. `fetchAttendanceTimeZones()` - 5 edges
10. `deleteOffice()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `requestDesktopPermission()` --calls--> `toast()`  [INFERRED]
  src/pages/work/WorkPage.tsx → src/hooks/use-toast.ts
- `saveAttendanceTimeZone()` --calls--> `isValidTimeZone()`  [INFERRED]
  src/pages/admin/Recruitment.tsx → src/lib/timezones.ts
- `fetchEmployeeData()` --calls--> `toast()`  [INFERRED]
  src/pages/admin/EditEmployee.tsx → src/hooks/use-toast.ts
- `onSubmit()` --calls--> `toast()`  [INFERRED]
  src/pages/admin/EditEmployee.tsx → src/hooks/use-toast.ts
- `handleSignOut()` --calls--> `signOut()`  [INFERRED]
  src/pages/employee/Dashboard.tsx → src/lib/auth.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (28): addCurrentIpToAllowedRanges(), deleteAttendanceTimeZone(), deleteDepartmentOps(), deleteOffice(), deleteScheduleTemplate(), fetchAttendanceTimeZones(), fetchDepartmentsOps(), fetchEmployees() (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (13): calculateWorkMinutes(), dateTimeIso(), fetchAttendance(), fetchEarlyCheckoutRequests(), fetchOvertimeRequests(), handleAddAttendance(), handleDeleteAttendance(), handleUpdateAttendance() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (9): handleLogout(), handleLogout(), handleSignOut(), handleLogout(), handleLogout(), isAllowedEmail(), requestPasswordReset(), signIn() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (12): AttendanceSystem(), Chat(), NewEmployeeForm(), addToRemoveQueue(), dispatch(), genId(), reducer(), useToast() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (11): fetchSchedules(), getShiftTypeIcon(), handleDelete(), handleStatusToggle(), fetchSalaries(), formatCurrency(), handleSave(), fetchEmployeeData() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (5): applyMention(), broadcastTyping(), fetchChannelProfiles(), fetchMessages(), markLocalTyping()

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (7): fetchNotifications(), handleBulkDelete(), handleMarkAllAsRead(), handleMarkAsRead(), hydrateRelated(), openNotification(), requestDesktopPermission()

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (2): fetchChannelMembers(), handleAddMember()

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (4): Settings(), ProtectedRoute(), useAuth(), AdminSidebar()

### Community 10 - "Community 10"
Cohesion: 0.32
Nodes (4): calculatePupilPosition(), getRandomBlinkInterval(), Pupil(), scheduleBlink()

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (2): onSubmit(), createUserAsAdmin()

### Community 12 - "Community 12"
Cohesion: 0.47
Nodes (3): fetchAccessControls(), handleDelete(), handleStatusToggle()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (2): fetchEmployeeData(), onSubmit()

### Community 14 - "Community 14"
Cohesion: 0.47
Nodes (3): fetchDepartments(), handleDelete(), handleSave()

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (3): handleCreateTask(), handleDeleteTask(), handleStatusChange()

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (2): fetchData(), onSubmit()

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (1): handleSendMessage()

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (1): requestDesktopPermission()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (3): fetchOffices(), handleDelete(), handleStatusToggle()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (1): isValidTimeZone()

### Community 23 - "Community 23"
Cohesion: 0.83
Nodes (3): fetchEmployees(), handleDelete(), handleStatusToggle()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (2): derive(), fetchTodayStatus()

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (1): onSubmit()

## Knowledge Gaps
- **Thin community `Community 7`** (13 nodes): `fetchChannelMembers()`, `fetchChannels()`, `fetchOfficeEmployees()`, `fetchOffices()`, `getSubChannels()`, `handleAddMember()`, `handleCreateChannel()`, `handleCreateOffice()`, `handleDeleteChannel()`, `handleRemoveMember()`, `handleUpdateRole()`, `searchUsers()`, `WorkManagement.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (7 nodes): `fetchDepartments()`, `handleOnSiteChange()`, `handleRemoteChange()`, `onSubmit()`, `createUserAsAdmin()`, `auth-service.ts`, `NewEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (6 nodes): `fetchDepartments()`, `fetchEmployeeData()`, `fetchOffices()`, `formatTime12h()`, `onSubmit()`, `EditEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (6 nodes): `fetchData()`, `fetchDepts()`, `fetchTemplates()`, `formatTime12h()`, `onSubmit()`, `EditEmployeeForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (6 nodes): `getPriorityColor()`, `getProjectStatusColor()`, `getStatusColor()`, `getStatusText()`, `handleSendMessage()`, `TeamCollaboration.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (5 nodes): `WorkPage.tsx`, `fetchChannelDetails()`, `fetchOfficeName()`, `getChannelIcon()`, `requestDesktopPermission()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (5 nodes): `formatInTimeZone()`, `formatTimeOnlyInTimeZone()`, `getSupportedTimeZones()`, `isValidTimeZone()`, `timezones.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (4 nodes): `derive()`, `fetchTodayStatus()`, `formatCurrency()`, `DashboardFinal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (4 nodes): `CreateTaskDialog.tsx`, `fetchOptions()`, `onSubmit()`, `toggleTaggedUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 23`, `Community 25`?**
  _High betweenness centrality (0.253) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `toast()` (e.g. with `requestDesktopPermission()` and `handleStatusToggle()`) actually correct?**
  _`toast()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `signOut()` (e.g. with `handleSignOut()` and `handleLogout()`) actually correct?**
  _`signOut()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._