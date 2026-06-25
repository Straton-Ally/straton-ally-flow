import { Outlet } from 'react-router-dom';
import { EmployeeTopNav } from './EmployeeTopNav';
import { EmployeeBottomNav } from './EmployeeBottomNav';

export function EmployeeLayoutNew() {
  return (
    <div className="app-shell">
      {/* Desktop Top Nav */}
      <div className="hidden md:block">
        <EmployeeTopNav />
      </div>
      
      <main className="overflow-x-hidden">
        <div className="px-4 md:px-6 py-5 max-w-[1400px] mx-auto pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <EmployeeBottomNav />
    </div>
  );
}
