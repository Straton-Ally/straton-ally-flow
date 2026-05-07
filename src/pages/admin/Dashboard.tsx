import { useEffect, useState } from 'react';
import { CalendarCheck, Banknote, Clock, Smile } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PayrollGrid } from '@/components/dashboard/PayrollGrid';
import { ScheduleCard } from '@/components/dashboard/ScheduleCard';
import { AttendanceHeatmap } from '@/components/dashboard/AttendanceHeatmap';
import { ProjectStatusTable } from '@/components/dashboard/ProjectStatusTable';

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingLeaves: number;
  departments: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingLeaves: 0,
    departments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { count: employeeCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        const { count: deptCount } = await supabase
          .from('departments')
          .select('*', { count: 'exact', head: true });

        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status')
          .eq('date', today);

        const presentToday = attendanceData?.filter(a => a.status === 'present').length || 0;
        const onLeave = attendanceData?.filter(a => a.status === 'leave').length || 0;

        setStats({
          totalEmployees: employeeCount || 0,
          presentToday,
          onLeave,
          pendingLeaves: 34,
          departments: deptCount || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const attendanceRate = stats.totalEmployees > 0 
    ? Math.round((stats.presentToday / stats.totalEmployees) * 100) 
    : 92;

  // Mock schedule events
  const scheduleEvents = [
    {
      id: '1',
      title: 'Interview Candidate - Customer Service',
      date: '26 September, 2025',
      time: '09:00 - 09:30',
      type: 'meeting' as const,
      platform: 'Google Meet',
      attendees: ['JD', 'MK', 'RS'],
    },
    {
      id: '2',
      title: 'Town-hall Office - September 2025',
      date: '30 September, 2025',
      time: '09:30 - 11:30',
      type: 'event' as const,
      platform: 'Zoom Meeting',
      attendees: ['AB', 'CD', 'EF'],
    },
  ];

  // Mock projects
  const projects = [
    { id: '1', name: 'Portal Update', department: 'Engineering', progress: 85, deadline: 'Jun 28, 2025', status: 'on-track' as const },
    { id: '2', name: 'Hiring Drive', department: 'HR', progress: 60, deadline: 'Jun 20, 2025', status: 'in-progress' as const },
    { id: '3', name: 'Finance Report', department: 'Finance', progress: 95, deadline: 'Jun 14, 2025', status: 'on-track' as const },
    { id: '4', name: 'UX Revamp', department: 'Product', progress: 75, deadline: 'Jun 24, 2025', status: 'on-track' as const },
    { id: '5', name: 'Chatbot Setup', department: 'Support', progress: 40, deadline: 'July 8, 2025', status: 'delayed' as const },
  ];

  return (
    <div className="space-y-5">
      <DashboardHeader 
        userName={user?.fullName || 'Martin Butler'} 
        userRole="HR Executive" 
      />

      {/* Row 1: 4 Metrics + Payroll + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: 2x2 Metrics Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="Attendance Rate"
            value={`${attendanceRate}%`}
            subtitle="Calendar Check"
            icon={CalendarCheck}
            trend={{ value: 2.5, isPositive: true }}
          />
          <MetricCard
            title="Payroll Processed"
            value="1,240"
            subtitle="Salary Transactions"
            icon={Banknote}
            trend={{ value: 1.8, isPositive: true }}
          />
          <MetricCard
            title="Average Working Hours"
            value="7.9"
            subtitle="Per Employee Daily"
            icon={Clock}
            trend={{ value: 0.4, isPositive: false }}
            valueUnit="hrs"
          />
          <MetricCard
            title="Employee Satisfaction"
            value="8.7"
            subtitle="Avg. Survey Score"
            icon={Smile}
            trend={{ value: 0.6, isPositive: true }}
            valueUnit="/10"
          />
        </div>

        {/* Payroll Grid */}
        <PayrollGrid
          takeHomePay="Rs. 235,000"
          paymentPercentage={100}
        />

        {/* Schedule */}
        <ScheduleCard 
          events={scheduleEvents} 
          totalCount={16} 
        />
      </div>

      {/* Row 2: Attendance Heatmap + Project Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceHeatmap rate={98} trend={2.5} />
        <ProjectStatusTable projects={projects} />
      </div>
    </div>
  );
}
