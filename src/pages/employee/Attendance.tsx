import { AttendanceSystem } from '@/components/employee/AttendanceSystemNew';
import { AttendanceStats } from '@/components/employee/AttendanceStats';

export default function AttendancePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Attendance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Today and trends</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>
      <AttendanceSystem />
      <AttendanceStats />
    </div>
  );
}
