# Graph Report - .  (2026-04-29)

## Corpus Check
- 155 files · ~103,045 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 430 nodes · 457 edges · 22 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Recruitment Admin|Recruitment Admin]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Attendance|Attendance]]
- [[_COMMUNITY_Auth|Auth]]
- [[_COMMUNITY_Work Chat|Work Chat]]
- [[_COMMUNITY_Real Task Data|Real Task Data]]
- [[_COMMUNITY_Duty Schedules|Duty Schedules]]
- [[_COMMUNITY_Chat Area|Chat Area]]
- [[_COMMUNITY_Work Management|Work Management]]
- [[_COMMUNITY_Use Auth|Use Auth]]
- [[_COMMUNITY_Animated Characters|Animated Characters]]
- [[_COMMUNITY_New Employee|New Employee]]
- [[_COMMUNITY_Team Collaboration|Team Collaboration]]
- [[_COMMUNITY_Access Control|Access Control]]
- [[_COMMUNITY_Edit Employee|Edit Employee]]
- [[_COMMUNITY_Departments|Departments]]
- [[_COMMUNITY_Edit Employee Form|Edit Employee Form]]
- [[_COMMUNITY_Work Page|Work Page]]
- [[_COMMUNITY_Offices|Offices]]
- [[_COMMUNITY_Timezones|Timezones]]
- [[_COMMUNITY_Employees|Employees]]
- [[_COMMUNITY_Create Task Dialog|Create Task Dialog]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 68 edges
2. `getErrorMessage()` - 23 edges
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

### Community 0 - "Recruitment Admin"
Cohesion: 0.12
Nodes (29): addCurrentIpToAllowedRanges(), deleteAttendanceTimeZone(), deleteDepartmentOps(), deleteOffice(), deleteScheduleTemplate(), fetchAccessControls(), fetchAttendanceTimeZones(), fetchDepartmentsOps() (+21 more)

### Community 1 - "Notifications"
Cohesion: 0.12
Nodes (14): decodeBase64Url(), disablePushNotifications(), enablePushNotifications(), fetchNotifications(), getNotificationTarget(), getPushPublicKey(), handleBulkDelete(), handleMarkAllAsRead() (+6 more)

### Community 2 - "Attendance"
Cohesion: 0.16
Nodes (13): calculateWorkMinutes(), dateTimeIso(), fetchAttendance(), fetchEarlyCheckoutRequests(), fetchOvertimeRequests(), handleAddAttendance(), handleDeleteAttendance(), handleUpdateAttendance() (+5 more)

### Community 3 - "Auth"
Cohesion: 0.1
Nodes (9): handleLogout(), handleLogout(), handleSignOut(), handleLogout(), handleLogout(), isAllowedEmail(), requestPasswordReset(), signIn() (+1 more)

### Community 4 - "Work Chat"
Cohesion: 0.11
Nodes (12): AttendanceSystem(), Chat(), NewEmployeeForm(), addToRemoveQueue(), dispatch(), genId(), reducer(), useToast() (+4 more)

### Community 5 - "Real Task Data"
Cohesion: 0.13
Nodes (6): derive(), fetchTodayStatus(), handleCreateTask(), loadTasks(), fetchEmployeeOptions(), fetchWorkTasks()

### Community 6 - "Duty Schedules"
Cohesion: 0.13
Nodes (11): fetchSchedules(), getShiftTypeIcon(), handleDelete(), handleStatusToggle(), fetchSalaries(), formatCurrency(), handleSave(), fetchEmployeeData() (+3 more)

### Community 7 - "Chat Area"
Cohesion: 0.18
Nodes (5): applyMention(), broadcastTyping(), fetchChannelProfiles(), fetchMessages(), markLocalTyping()

### Community 8 - "Work Management"
Cohesion: 0.17
Nodes (2): fetchChannelMembers(), handleAddMember()

### Community 10 - "Use Auth"
Cohesion: 0.22
Nodes (4): Settings(), ProtectedRoute(), useAuth(), AdminSidebar()

### Community 11 - "Animated Characters"
Cohesion: 0.32
Nodes (4): calculatePupilPosition(), getRandomBlinkInterval(), Pupil(), scheduleBlink()

### Community 12 - "New Employee"
Cohesion: 0.29
Nodes (2): onSubmit(), createUserAsAdmin()

### Community 13 - "Team Collaboration"
Cohesion: 0.29
Nodes (2): fetchTeamData(), handleSendMessage()

### Community 14 - "Access Control"
Cohesion: 0.47
Nodes (3): fetchAccessControls(), handleDelete(), handleStatusToggle()

### Community 15 - "Edit Employee"
Cohesion: 0.33
Nodes (2): fetchEmployeeData(), onSubmit()

### Community 16 - "Departments"
Cohesion: 0.47
Nodes (3): fetchDepartments(), handleDelete(), handleSave()

### Community 18 - "Edit Employee Form"
Cohesion: 0.33
Nodes (2): fetchData(), onSubmit()

### Community 19 - "Work Page"
Cohesion: 0.4
Nodes (1): requestDesktopPermission()

### Community 20 - "Offices"
Cohesion: 0.6
Nodes (3): fetchOffices(), handleDelete(), handleStatusToggle()

### Community 22 - "Timezones"
Cohesion: 0.4
Nodes (1): isValidTimeZone()

### Community 23 - "Employees"
Cohesion: 0.83
Nodes (3): fetchEmployees(), handleDelete(), handleStatusToggle()

### Community 24 - "Create Task Dialog"
Cohesion: 0.5
Nodes (1): onSubmit()

## Knowledge Gaps
- **Thin community `Work Management`** (13 nodes): `fetchChannelMembers()`, `fetchChannels()`, `fetchOfficeEmployees()`, `fetchOffices()`, `getSubChannels()`, `handleAddMember()`, `handleCreateChannel()`, `handleCreateOffice()`, `handleDeleteChannel()`, `handleRemoveMember()`, `handleUpdateRole()`, `searchUsers()`, `WorkManagement.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Employee`** (7 nodes): `fetchDepartments()`, `handleOnSiteChange()`, `handleRemoteChange()`, `onSubmit()`, `createUserAsAdmin()`, `auth-service.ts`, `NewEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Team Collaboration`** (7 nodes): `fetchTeamData()`, `getPriorityColor()`, `getProjectStatusColor()`, `getStatusColor()`, `getStatusText()`, `handleSendMessage()`, `TeamCollaboration.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Edit Employee`** (6 nodes): `fetchDepartments()`, `fetchEmployeeData()`, `fetchOffices()`, `formatTime12h()`, `onSubmit()`, `EditEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Edit Employee Form`** (6 nodes): `fetchData()`, `fetchDepts()`, `fetchTemplates()`, `formatTime12h()`, `onSubmit()`, `EditEmployeeForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Work Page`** (5 nodes): `WorkPage.tsx`, `fetchChannelDetails()`, `fetchOfficeName()`, `getChannelIcon()`, `requestDesktopPermission()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Timezones`** (5 nodes): `formatInTimeZone()`, `formatTimeOnlyInTimeZone()`, `getSupportedTimeZones()`, `isValidTimeZone()`, `timezones.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create Task Dialog`** (4 nodes): `CreateTaskDialog.tsx`, `fetchOptions()`, `onSubmit()`, `toggleTaggedUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Recruitment Admin` to `Notifications`, `Attendance`, `Work Chat`, `Real Task Data`, `Duty Schedules`, `Chat Area`, `New Employee`, `Team Collaboration`, `Access Control`, `Edit Employee`, `Departments`, `Edit Employee Form`, `Work Page`, `Offices`, `Employees`, `Create Task Dialog`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `toast()` (e.g. with `requestDesktopPermission()` and `handleAccessStatusToggle()`) actually correct?**
  _`toast()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `signOut()` (e.g. with `handleSignOut()` and `handleLogout()`) actually correct?**
  _`signOut()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Recruitment Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Notifications` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Work Chat` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._