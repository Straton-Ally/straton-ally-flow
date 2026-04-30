import { useState } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { AttendanceSystem } from '@/components/employee/AttendanceSystemNew';
import { AttendanceStats } from '@/components/employee/AttendanceStats';
import { SalaryProgress } from '@/components/employee/SalaryProgress';
import { Notifications } from '@/components/employee/Notifications';
import { WorkspaceModule } from '@/components/work/WorkspaceModule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, Banknote, CheckSquare, Users, Bell, Briefcase, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export default function EmployeeDashboard() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user } = useAuth();

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const renderPageContent = () => {
    switch (currentPage) {
      case 'attendance':
        return <AttendanceSystem />;
      case 'salary':
        return <SalaryProgress />;
      case 'tasks':
      case 'team':
      case 'chat':
        return <WorkspaceModule mode="employee" />;
      case 'notifications':
        return <Notifications />;
      default:
        return <DashboardHome />;
    }
  };

  const DashboardHome = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">
          {greeting}, {user?.fullName?.split(' ')[0]}
        </h2>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Status</p>
                <p className="text-2xl font-bold">Not Marked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">22 Days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Banknote className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Salary</p>
                <p className="text-2xl font-bold">Rs. 140,000</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <CheckSquare className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('attendance')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Mark Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Check in/out and manage your daily attendance
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Next: Check In</span>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('tasks')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              View Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Manage your tasks and track progress
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">3 pending tasks</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('team')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Collaboration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Connect with your team members
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">12 members online</span>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('salary')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Salary & Payslips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              View salary history and download payslips
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">January paid</span>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('notifications')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Stay updated with latest announcements
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">5 unread</span>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('chat')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Chat with team members in real-time
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">2 active chats</span>
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div className="flex-1">
                <p className="font-medium">Task assigned: "Design new landing page"</p>
                <p className="text-sm text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <div className="flex-1">
                <p className="font-medium">Salary processed for January 2024</p>
                <p className="text-sm text-muted-foreground">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <div className="flex-1">
                <p className="font-medium">Team meeting scheduled for tomorrow</p>
                <p className="text-sm text-muted-foreground">2 days ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <div className="flex-1">
                <p className="font-medium">Leave request approved for Feb 5-7</p>
                <p className="text-sm text-muted-foreground">3 days ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <EmployeeLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPageContent()}
    </EmployeeLayout>
  );
}
