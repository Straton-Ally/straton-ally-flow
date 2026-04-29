import { Notifications } from '@/components/employee/Notifications';

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Attendance reminders, overtime requests, approvals, and work updates.</p>
      </div>
      <Notifications />
    </div>
  );
}
