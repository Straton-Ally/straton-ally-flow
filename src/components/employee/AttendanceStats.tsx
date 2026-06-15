import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';

interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  averageHours: string;
  punctuality: number;
}

interface DailyAttendance {
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  in_time: string | null;
  check_in_at: string | null;
  out_time: string | null;
  total_hours: string | null;
}

const COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  half_day: '#f59e0b',
  leave: '#6b7280'
};

export function AttendanceStats() {
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    leaveDays: 0,
    averageHours: '0:00',
    punctuality: 0
  });
  const [monthlyData, setMonthlyData] = useState<DailyAttendance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceStats();
  }, [selectedMonth]);

  const fetchAttendanceStats = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return;

      // Get employee ID
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) return;

      // Get attendance for selected month
      const startDate = startOfMonth(new Date(selectedMonth));
      const endDate = endOfMonth(new Date(selectedMonth));

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date');

      if (attendanceData) {
        const processedData: DailyAttendance[] = attendanceData.map(record => ({
          date: record.date,
          status: ((record.in_time || record.check_in_at) && record.status === 'absent' ? 'present' : record.status) as 'present' | 'absent' | 'half_day' | 'leave',
          in_time: record.in_time,
          check_in_at: record.check_in_at,
          out_time: record.out_time,
          total_hours: record.notes?.includes('Total hours') ? 
            record.notes.split('Total hours: ')[1] : null
        }));

        setMonthlyData(processedData);

        // Calculate statistics
        const totalDays = processedData.length;
        const presentDays = processedData.filter(r => r.status === 'present').length;
        const absentDays = processedData.filter(r => r.status === 'absent').length;
        const halfDays = processedData.filter(r => r.status === 'half_day').length;
        const leaveDays = processedData.filter(r => r.status === 'leave').length;

        // Calculate average hours
        const validHours = processedData
          .filter(d => d.total_hours)
          .map(d => {
            const [hours, minutes] = d.total_hours!.split(':').map(Number);
            return hours * 60 + minutes;
          });
        
        const avgMinutes = validHours.length > 0 ? 
          Math.round(validHours.reduce((a, b) => a + b, 0) / validHours.length) : 0;
        const avgHours = Math.floor(avgMinutes / 60);
        const avgMins = avgMinutes % 60;
        const averageHours = `${avgHours}:${avgMins.toString().padStart(2, '0')}`;

        // Calculate punctuality (percentage of days where check-in was before 9:00 AM)
        const onTimeDays = processedData.filter(d => {
          if (!d.in_time || d.status !== 'present') return false;
          const [hours] = d.in_time.split(':').map(Number);
          return hours < 9;
        }).length;
        
        const punctuality = presentDays > 0 ? Math.round((onTimeDays / presentDays) * 100) : 0;

        setStats({
          totalDays,
          presentDays,
          absentDays,
          halfDays,
          leaveDays,
          averageHours,
          punctuality
        });
      }
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pieData = [
    { name: 'Present', value: stats.presentDays, color: COLORS.present },
    { name: 'Absent', value: stats.absentDays, color: COLORS.absent },
    { name: 'Half Day', value: stats.halfDays, color: COLORS.half_day },
    { name: 'Leave', value: stats.leaveDays, color: COLORS.leave }
  ].filter(item => item.value > 0);

  const barData = monthlyData.map(day => ({
    date: format(new Date(day.date), 'dd'),
    status: day.status,
    hours: day.total_hours || '0:00',
    fill: COLORS[day.status]
  }));

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    
    return options;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Attendance Statistics</h3>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {generateMonthOptions().map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold">{stats.totalDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600">{stats.presentDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Hours</p>
                <p className="text-2xl font-bold text-blue-600">{stats.averageHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Punctuality</p>
                <p className="text-2xl font-bold text-orange-600">{stats.punctuality}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data for this month
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'hours' ? value : '',
                      name === 'hours' ? 'Hours' : 'Status'
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Bar dataKey="hours" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data for this month
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Present: {stats.presentDays}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">Absent: {stats.absentDays}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">Half Day: {stats.halfDays}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-sm">Leave: {stats.leaveDays}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
