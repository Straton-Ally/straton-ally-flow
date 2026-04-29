import { useState, useEffect } from 'react';
import { Banknote, TrendingUp, Calendar, Download, Eye } from 'lucide-react';
import { formatCurrencyPKR } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface SalaryRecord {
  id: string;
  amount: number;
  salary_type: 'monthly' | 'hourly';
  effective_date: string;
  is_current: boolean;
  created_at: string;
}

interface Payslip {
  id: string;
  month: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_date: string;
  status: 'paid' | 'pending' | 'processing';
}

export function SalaryProgress() {
  const [currentSalary, setCurrentSalary] = useState<SalaryRecord | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalaryData();
  }, [selectedYear]);

  const fetchSalaryData = async () => {
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

      // Get current salary
      const { data: currentSalaryData } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_current', true)
        .single();

      if (currentSalaryData) {
        setCurrentSalary({
          id: currentSalaryData.id,
          amount: currentSalaryData.amount,
          salary_type: currentSalaryData.salary_type as 'monthly' | 'hourly',
          effective_date: currentSalaryData.effective_date,
          is_current: currentSalaryData.is_current,
          created_at: currentSalaryData.created_at
        });
      }

      // Get salary history
      const { data: historyData } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employee.id)
        .order('effective_date', { ascending: false });

      if (historyData) {
        setSalaryHistory(historyData.map(record => ({
          id: record.id,
          amount: record.amount,
          salary_type: record.salary_type as 'monthly' | 'hourly',
          effective_date: record.effective_date,
          is_current: record.is_current,
          created_at: record.created_at
        })));
      }

      setPayslips([]);

    } catch (error) {
      console.error('Error fetching salary data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = salaryHistory.map(record => ({
    date: format(new Date(record.effective_date), 'MMM yyyy'),
    amount: record.amount,
    type: record.salary_type
  }));

  const monthlyEarnings = payslips.map(payslip => ({
    month: format(new Date(payslip.month), 'MMM'),
    net_salary: payslip.net_salary,
    basic_salary: payslip.basic_salary
  }));

  const generateYearOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      options.push({
        value: year.toString(),
        label: year.toString()
      });
    }
    
    return options;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Salary Progress</h3>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {generateYearOptions().map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Current Salary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Current Salary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-blue-900">
                {currentSalary ? formatCurrencyPKR(currentSalary.amount) : formatCurrencyPKR(0)}
              </div>
              <div className="text-sm text-blue-700">
                {currentSalary?.salary_type === 'monthly' ? 'per month' : 'per hour'}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Effective from {currentSalary ? format(new Date(currentSalary.effective_date), 'MMMM d, yyyy') : 'N/A'}
              </div>
            </div>
            <div className="text-right">
              <Badge className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">YTD Earnings</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrencyPKR(payslips.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.net_salary, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Monthly Average</p>
                <p className="text-xl font-bold text-blue-600">
                  {currentSalary ? formatCurrencyPKR(currentSalary.amount) : formatCurrencyPKR(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Next Payment</p>
                <p className="text-xl font-bold text-purple-600">
                  {format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), 'MMM d')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary History Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Salary History</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrencyPKR(Number(value)), 'Salary']} />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No salary history available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Earnings ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyEarnings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrencyPKR(Number(value)), 'Amount']} />
                <Area type="monotone" dataKey="net_salary" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Area type="monotone" dataKey="basic_salary" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payslips.map((payslip) => (
              <div key={payslip.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{payslip.month}</div>
                  <div className="text-sm text-muted-foreground">
                    Basic: {formatCurrencyPKR(payslip.basic_salary)} | 
                    Net: {formatCurrencyPKR(payslip.net_salary)}
                  </div>
                  {payslip.payment_date && (
                    <div className="text-xs text-muted-foreground">
                      Paid on {format(new Date(payslip.payment_date), 'MMMM d, yyyy')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payslip.status)}
                  {payslip.status === 'paid' && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
