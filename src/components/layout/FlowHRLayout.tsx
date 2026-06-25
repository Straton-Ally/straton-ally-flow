import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';

export function FlowHRLayout() {
  return (
    <div className="app-shell">
      {/* Desktop Top Nav */}
      <div className="hidden md:block">
        <TopNav />
      </div>
      
      <main className="overflow-x-hidden">
        <div className="px-4 md:px-6 py-5 max-w-[1400px] mx-auto pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
