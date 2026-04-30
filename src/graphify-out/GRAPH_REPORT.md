# Graph Report - src  (2026-04-30)

## Corpus Check
- 136 files · ~78,941 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 428 nodes · 474 edges · 22 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 68 edges
2. `getErrorMessage()` - 23 edges
3. `fetchEmployees()` - 10 edges
4. `signOut()` - 7 edges
5. `useToast()` - 6 edges
6. `handleAddAttendance()` - 6 edges
7. `handleUpdateAttendance()` - 6 edges
8. `fetchOffices()` - 6 edges
9. `enablePushNotifications()` - 5 edges
10. `timeInZoneFromPakistan()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `fetchData()` --calls--> `toast()`  [INFERRED]
  components\employee\EditEmployeeForm.tsx → hooks\use-toast.ts
- `onSubmit()` --calls--> `toast()`  [INFERRED]
  components\employee\EditEmployeeForm.tsx → hooks\use-toast.ts
- `disablePushNotifications()` --calls--> `toast()`  [INFERRED]
  components\employee\Notifications.tsx → hooks\use-toast.ts
- `requestDesktopPermission()` --calls--> `toast()`  [INFERRED]
  components\employee\Notifications.tsx → hooks\use-toast.ts
- `handleMarkAllAsRead()` --calls--> `toast()`  [INFERRED]
  components\employee\Notifications.tsx → hooks\use-toast.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (30): addCurrentIpToAllowedRanges(), deleteAttendanceTimeZone(), deleteDepartmentOps(), deleteOffice(), deleteScheduleTemplate(), fetchAccessControls(), fetchAttendanceTimeZones(), fetchDepartmentsOps() (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (18): calculateWorkMinutes(), dateTimeIso(), fetchAttendance(), fetchEarlyCheckoutRequests(), fetchOvertimeRequests(), handleAddAttendance(), handleDeleteAttendance(), handleUpdateAttendance() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (14): decodeBase64Url(), disablePushNotifications(), enablePushNotifications(), fetchNotifications(), getNotificationTarget(), getPushPublicKey(), handleBulkDelete(), handleMarkAllAsRead() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (9): handleLogout(), handleLogout(), handleSignOut(), handleLogout(), handleLogout(), isAllowedEmail(), requestPasswordReset(), signIn() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (12): AttendanceSystem(), Chat(), NewEmployeeForm(), addToRemoveQueue(), dispatch(), genId(), reducer(), useToast() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (6): derive(), fetchTodayStatus(), handleCreateTask(), loadTasks(), fetchEmployeeOptions(), fetchWorkTasks()

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (5): applyMention(), broadcastTyping(), fetchChannelProfiles(), fetchMessages(), markLocalTyping()

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (5): fetchSalaries(), formatCurrency(), handleSave(), formatSalaryAmount(), formatCurrencyPKR()

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (2): fetchChannelMembers(), handleAddMember()

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (7): fetchSchedules(), getShiftTypeIcon(), handleDelete(), handleStatusToggle(), formatTime12h(), fetchEmployeeData(), handleSignOut()

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (4): Settings(), ProtectedRoute(), useAuth(), AdminSidebar()

### Community 12 - "Community 12"
Cohesion: 0.32
Nodes (4): calculatePupilPosition(), getRandomBlinkInterval(), Pupil(), scheduleBlink()

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (2): fetchTeamData(), handleSendMessage()

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (2): onSubmit(), createUserAsAdmin()

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (2): fetchData(), onSubmit()

### Community 17 - "Community 17"
Cohesion: 0.47
Nodes (3): fetchAccessControls(), handleDelete(), handleStatusToggle()

### Community 18 - "Community 18"
Cohesion: 0.47
Nodes (3): fetchDepartments(), handleDelete(), handleSave()

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (2): fetchEmployeeData(), onSubmit()

### Community 21 - "Community 21"
Cohesion: 0.6
Nodes (3): fetchOffices(), handleDelete(), handleStatusToggle()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (1): requestDesktopPermission()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (1): onSubmit()

### Community 27 - "Community 27"
Cohesion: 0.83
Nodes (3): fetchEmployees(), handleDelete(), handleStatusToggle()

## Knowledge Gaps
- **Thin community `Community 8`** (13 nodes): `fetchChannelMembers()`, `fetchChannels()`, `fetchOfficeEmployees()`, `fetchOffices()`, `getSubChannels()`, `handleAddMember()`, `handleCreateChannel()`, `handleCreateOffice()`, `handleDeleteChannel()`, `handleRemoveMember()`, `handleUpdateRole()`, `searchUsers()`, `WorkManagement.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (7 nodes): `TeamCollaboration.tsx`, `fetchTeamData()`, `getPriorityColor()`, `getProjectStatusColor()`, `getStatusColor()`, `getStatusText()`, `handleSendMessage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (7 nodes): `fetchDepartments()`, `handleOnSiteChange()`, `handleRemoteChange()`, `onSubmit()`, `createUserAsAdmin()`, `auth-service.ts`, `NewEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (6 nodes): `EditEmployeeForm.tsx`, `fetchData()`, `fetchDepts()`, `fetchTemplates()`, `formatTime12h()`, `onSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (6 nodes): `fetchDepartments()`, `fetchEmployeeData()`, `fetchOffices()`, `formatTime12h()`, `onSubmit()`, `EditEmployee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (5 nodes): `WorkPage.tsx`, `fetchChannelDetails()`, `fetchOfficeName()`, `getChannelIcon()`, `requestDesktopPermission()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (4 nodes): `CreateTaskDialog.tsx`, `fetchOptions()`, `onSubmit()`, `toggleTaggedUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 21`, `Community 22`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `formatTime12h()` connect `Community 9` to `Community 0`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `toast()` (e.g. with `fetchData()` and `onSubmit()`) actually correct?**
  _`toast()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `signOut()` (e.g. with `handleLogout()` and `handleLogout()`) actually correct?**
  _`signOut()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useToast()` (e.g. with `AttendanceSystem()` and `Chat()`) actually correct?**
  _`useToast()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._