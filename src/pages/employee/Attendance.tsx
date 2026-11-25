import { AttendanceSystem } from '@/components/employee/AttendanceSystemNew';
import { AttendanceStats } from '@/components/employee/AttendanceStats';

export default function AttendancePage() {
  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      <AttendanceSystem />
      <AttendanceStats />
    </div>
  );
}
