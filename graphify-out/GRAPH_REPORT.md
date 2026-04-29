# Graph Report - ./src  (2026-04-29)

## Corpus Check
- 150 files · ~99,009 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 424 nodes · 461 edges · 23 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Recruitment|Recruitment]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Layout Navigation|Layout Navigation]]
- [[_COMMUNITY_Attendance System|Attendance System]]
- [[_COMMUNITY_Employee Features|Employee Features]]
- [[_COMMUNITY_Duty Schedules|Duty Schedules]]
- [[_COMMUNITY_Chat Area|Chat Area]]
- [[_COMMUNITY_Work Management|Work Management]]
- [[_COMMUNITY_Settings & Auth|Settings & Auth]]
- [[_COMMUNITY_Animated Components|Animated Components]]
- [[_COMMUNITY_New Employee|New Employee]]
- [[_COMMUNITY_Access Control|Access Control]]
- [[_COMMUNITY_Edit Employee|Edit Employee]]
- [[_COMMUNITY_Departments|Departments]]
- [[_COMMUNITY_Task Management|Task Management]]
- [[_COMMUNITY_Edit Employee Form|Edit Employee Form]]
- [[_COMMUNITY_Team Collaboration|Team Collaboration]]
- [[_COMMUNITY_Work Page|Work Page]]
- [[_COMMUNITY_Offices|Offices]]
- [[_COMMUNITY_Timezones|Timezones]]
- [[_COMMUNITY_Employees|Employees]]
- [[_COMMUNITY_Employee Dashboard|Employee Dashboard]]
- [[_COMMUNITY_Create Task|Create Task]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 64 edges
2. `getErrorMessage()` - 21 edges
3. `fetchEmployees()` - 10 edges
4. `signOut()` - 8 edges
5. `fetchOffices()` - 6 edges
6. `useToast()` - 6 edges
7. `fetchScheduleTemplates()` - 5 edges
8. `fetchDepartmentsOps()` - 5 edges
9. `fetchAttendanceTimeZones()` - 5 edges
10. `deleteOffice()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `handleSignOut()` --calls--> `signOut()`  [INFERRED]
  src/pages/employee/Dashboard.tsx → lib/auth.ts
- `Settings()` --calls--> `useAuth()`  [INFERRED]
  src/pages/admin/Settings.tsx → hooks/useAuth.tsx
- `requestDesktopPermission()` --calls--> `toast()`  [INFERRED]
  components/employee/Notifications.tsx → src/hooks/use-toast.ts
- `handleMarkAllAsRead()` --calls--> `toast()`  [INFERRED]
  components/employee/Notifications.tsx → src/hooks/use-toast.ts
- `handleBulkDelete()` --calls--> `toast()`  [INFERRED]
  components/employee/Notifications.tsx → src/hooks/use-toast.ts

## Communities

### Community 0 - "Recruitment"
Cohesion: 0.12
Nodes (28): addCurrentIpToAllowedRanges(), deleteAttendanceTimeZone(), deleteDepartmentOps(), deleteOffice(), deleteScheduleTemplate(), fetchAttendanceTimeZones(), fetchDepartmentsOps(), fetchEmployees() (+20 more)

### Community 1 - "Notifications"
Cohesion: 0.16
Nodes (19): decodeBase64Url(), enablePushNotifications(), fetchNotifications(), getNotificationIcon(), getNotificationTarget(), getPushPublicKey(), handleBulkDelete(), handleDeleteNotification() (+11 more)

### Community 2 - "Layout Navigation"
Cohesion: 0.12
Nodes (13): handleLogout(), handleLogout(), handleSignOut(), handleLogout(), handleLogout(), getCurrentUser(), getRedirectPath(), getUserRole() (+5 more)

### Community 3 - "Attendance System"
Cohesion: 0.16
Nodes (13): calculateWorkMinutes(), dateTimeIso(), fetchAttendance(), fetchEarlyCheckoutRequests(), fetchOvertimeRequests(), handleAddAttendance(), handleDeleteAttendance(), handleUpdateAttendance() (+5 more)

### Community 4 - "Employee Features"
Cohesion: 0.1
Nodes (12): AttendanceSystem(), Chat(), NewEmployeeForm(), addToRemoveQueue(), dispatch(), genId(), reducer(), useToast() (+4 more)

### Community 5 - "Duty Schedules"
Cohesion: 0.13
Nodes (11): fetchSchedules(), getShiftTypeIcon(), handleDelete(), handleStatusToggle(), fetchSalaries(), formatCurrency(), handleSave(), fetchEmployeeData() (+3 more)

### Community 6 - "Chat Area"
Cohesion: 0.18
Nodes (5): applyMention(), broadcastTyping(), fetchChannelProfiles(), fetchMessages(), markLocalTyping()

### Community 7 - "Work Management"
Cohesion: 0.17
Nodes (2): fetchChannelMembers(), handleAddMember()

### Community 9 - "Settings & Auth"
Cohesion: 0.22
Nodes (5): Settings(), ProtectedRoute(), AuthProvider(), useAuth(), AdminSidebar()

### Community 10 - "Animated Components"
Cohesion: 0.32
Nodes (4): calculatePupilPosition(), getRandomBlinkInterval(), Pupil(), scheduleBlink()

### Community 11 - "New Employee"
Cohesion: 0.29
Nodes (2): onSubmit(), createUserAsAdmin()

### Community 12 - "Access Control"
Cohesion: 0.47
Nodes (3): fetchAccessControls(), handleDelete(), handleStatusToggle()

### Community 13 - "Edit Employee"
Cohesion: 0.33
Nodes (2): fetchEmployeeData(), onSubmit()

### Community 14 - "Departments"
Cohesion: 0.47
Nodes (3): fetchDepartments(), handleDelete(), handleSave()

### Community 16 - "Task Management"
Cohesion: 0.33
Nodes (3): handleCreateTask(), handleDeleteTask(), handleStatusChange()

### Community 17 - "Edit Employee Form"
Cohesion: 0.33
Nodes (2): fetchData(), onSubmit()

### Community 18 - "Team Collaboration"
Cohesion: 0.33
Nodes (1): handleSendMessage()

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

### Community 24 - "Employee Dashboard"
Cohesion: 0.67
Nodes (2): derive(), fetchTodayStatus()

### Community 25 - "Create Task"
Cohesion: 0.5
Nodes (1): onSubmit()

## Knowledge Gaps
- **Thin community `Work Management`** (13 nodes): `fetchChannelMembers()`, `fetchChannels()`, `fetchOfficeEmployees()`, `fetchOffices()`, `getSubChannels()`, `handleAddMember()`, `handleCreateChannel()`, `handleCreateOffice()`, `handleDeleteChannel()`, `handleRemoveMember()`, `handleUpdateRole()`, `searchUsers()`, `WorkManagement.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Employee`** (7 nodes): `fetchDepartments()`, `handleOnSiteChange()`, `handleRemoteChange()`, `onSubmit()`, `createUserAsAdmin()`, `auth-service.ts`, `NewEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Edit Employee`** (6 nodes): `fetchDepartments()`, `fetchEmployeeData()`, `fetchOffices()`, `formatTime12h()`, `onSubmit()`, `EditEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Edit Employee Form`** (6 nodes): `fetchData()`, `fetchDepts()`, `fetchTemplates()`, `formatTime12h()`, `onSubmit()`, `EditEmployeeForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Team Collaboration`** (6 nodes): `getPriorityColor()`, `getProjectStatusColor()`, `getStatusColor()`, `getStatusText()`, `handleSendMessage()`, `TeamCollaboration.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Work Page`** (5 nodes): `WorkPage.tsx`, `fetchChannelDetails()`, `fetchOfficeName()`, `getChannelIcon()`, `requestDesktopPermission()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Timezones`** (5 nodes): `formatInTimeZone()`, `formatTimeOnlyInTimeZone()`, `getSupportedTimeZones()`, `isValidTimeZone()`, `timezones.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Employee Dashboard`** (4 nodes): `derive()`, `fetchTodayStatus()`, `formatCurrency()`, `DashboardFinal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create Task`** (4 nodes): `CreateTaskDialog.tsx`, `fetchOptions()`, `onSubmit()`, `toggleTaggedUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Recruitment` to `Notifications`, `Attendance System`, `Employee Features`, `Duty Schedules`, `Chat Area`, `New Employee`, `Access Control`, `Edit Employee`, `Departments`, `Task Management`, `Edit Employee Form`, `Team Collaboration`, `Work Page`, `Offices`, `Employees`, `Create Task`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `toast()` (e.g. with `requestDesktopPermission()` and `handleStatusToggle()`) actually correct?**
  _`toast()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `signOut()` (e.g. with `handleSignOut()` and `handleLogout()`) actually correct?**
  _`signOut()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Recruitment` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Layout Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Employee Features` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Duty Schedules` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._