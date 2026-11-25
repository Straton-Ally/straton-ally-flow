import { useEffect, useState } from 'react';
import { Banknote, Search, Edit, History } from 'lucide-react';
import { formatCurrencyPKR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SalaryRecord {
  id: string;
  employee_id: string;
  salary_type: string;
  amount: number;
  effective_date: string;
  is_current: boolean;
  employee: {
    id: string;
    employee_id: string;
    full_name: string;
    designation: string | null;
  };
}

export default function Salaries() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<SalaryRecord | null>(null);
  const [formData, setFormData] = useState({
    salaryType: 'monthly',
    amount: '',
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const { toast } = useToast();

  const fetchSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select(`
          id,
          employee_id,
          salary_type,
          amount,
          effective_date,
          is_current,
          emp:employees!salaries_employee_id_fkey ( id, employee_id, user_id, designation )
        `)
        .eq('is_current', true)
        .order('amount', { ascending: false });

      if (error) throw error;

      if (data) {
        const userIds = [...new Set(data.map((s) => s.emp?.user_id).filter((id): id is string => Boolean(id)))];
        const names = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
          for (const p of profiles ?? []) names.set(p.id, p.full_name ?? 'Unknown');
        }
        const withEmployeeInfo = data.map(({ emp, ...salary }) => ({
          ...salary,
          employee: {
            id: emp?.id || '',
            employee_id: emp?.employee_id || '',
            full_name: (emp?.user_id && names.get(emp.user_id)) || 'Unknown',
            designation: emp?.designation || null,
          },
        }));
        setSalaries(withEmployeeInfo);
      }
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, []);

  const filteredSalaries = salaries.filter(
    (s) =>
      s.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (salary: SalaryRecord) => {
    setSelectedEmployee(salary);
    setFormData({
      salaryType: salary.salary_type,
      amount: salary.amount.toString(),
      effectiveDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee || !formData.amount) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Mark current salary as not current
      await supabase
        .from('salaries')
        .update({ is_current: false })
        .eq('employee_id', selectedEmployee.employee_id)
        .eq('is_current', true);

      // Insert new salary record
      const { error } = await supabase.from('salaries').insert({
        employee_id: selectedEmployee.employee_id,
        salary_type: formData.salaryType,
        amount: parseFloat(formData.amount),
        effective_date: formData.effectiveDate,
        is_current: true,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Salary updated successfully',
      });

      setIsDialogOpen(false);
      setSelectedEmployee(null);
      fetchSalaries();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update salary',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => formatCurrencyPKR(amount);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Salary & Wages</h1>
        <p className="text-muted-foreground mt-1">Manage employee compensation</p>
      </div>

      {/* Search */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredSalaries.length} records
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Salaries Table */}
      <Card className="card-elevated">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredSalaries.length === 0 ? (
            <div className="p-8 text-center">
              <Banknote className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No salary records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-medium">
                      {salary.employee.full_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-secondary px-2 py-1 rounded">
                        {salary.employee.employee_id}
                      </code>
                    </TableCell>
                    <TableCell>{salary.employee.designation || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {salary.salary_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-accent">
                      {formatCurrency(salary.amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(salary.effective_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(salary)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Salary</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="font-medium">{selectedEmployee.employee.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Current: {formatCurrency(selectedEmployee.amount)} / {selectedEmployee.salary_type}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Salary Type</Label>
                <Select
                  value={formData.salaryType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, salaryType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>New Amount</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) =>
                    setFormData({ ...formData, effectiveDate: e.target.value })
                  }
                />
              </div>

              <Button className="w-full" variant="accent" onClick={handleSave}>
                Update Salary
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
