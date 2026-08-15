'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, Check, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Payroll, Employee } from '@/lib/types';

type PayrollWithEmp = Payroll & { employee?: Employee };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayrollPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [records, setRecords] = useState<PayrollWithEmp[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, eRes] = await Promise.all([
      supabase.from('payroll').select('*, employee:employees(*)').eq('pay_period_month', selectedMonth).eq('pay_period_year', selectedYear).order('created_at'),
      supabase.from('employees').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    setRecords((pRes.data as any) || []);
    setEmployees((eRes.data as Employee[]) || []);
    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const existingEmpIds = new Set(records.map((r) => r.employee_id));
    const toCreate = employees.filter((e) => !existingEmpIds.has(e.id));
    if (toCreate.length === 0) { toast.info('Payroll already generated for all employees this period'); setGenerating(false); return; }

    const inserts = toCreate.map((emp) => ({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      employee_id: emp.id,
      pay_period_month: selectedMonth,
      pay_period_year: selectedYear,
      basic_salary: emp.salary,
      allowances: 0,
      deductions: 0,
      net_salary: emp.salary,
      status: 'pending' as const,
      created_by: appUser?.id ?? null,
    }));

    const { error } = await supabase.from('payroll').insert(inserts);
    if (error) { toast.error(error.message); setGenerating(false); return; }
    toast.success(`Payroll generated for ${toCreate.length} employees`);
    setGenerating(false);
    load();
  };

  const handlePay = async (id: string) => {
    setPaying(id);
    const { error } = await supabase.from('payroll').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); setPaying(null); return; }
    toast.success('Salary paid');
    setPaying(null);
    load();
  };

  const handlePayAll = async () => {
    const pending = records.filter((r) => r.status === 'pending');
    if (pending.length === 0) { toast.info('No pending salaries'); return; }
    setPaying('all');
    let paid = 0;
    for (const r of pending) {
      const { error } = await supabase.from('payroll').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', r.id);
      if (!error) paid++;
    }
    toast.success(`Paid ${paid} salaries`);
    setPaying(null);
    load();
  };

  const totalNet = records.reduce((s, r) => s + Number(r.net_salary), 0);
  const totalPaid = records.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.net_salary), 0);
  const totalPending = records.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.net_salary), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Generate and manage monthly payroll</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())} className="w-24" />
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Generate
          </Button>
          <Button variant="outline" onClick={handlePayAll} disabled={paying === 'all'}>
            {paying === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
            Pay All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-[hsl(var(--chart-4))]/10 p-2.5"><Wallet className="h-5 w-5 text-[hsl(var(--chart-4))]" /></div>
          <div><p className="text-sm text-muted-foreground">Total Net</p><p className="text-xl font-bold">Rs {totalNet.toLocaleString()}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-2.5"><Check className="h-5 w-5 text-[hsl(var(--chart-1))]" /></div>
          <div><p className="text-sm text-muted-foreground">Paid</p><p className="text-xl font-bold">Rs {totalPaid.toLocaleString()}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-2.5"><DollarSign className="h-5 w-5 text-[hsl(var(--chart-2))]" /></div>
          <div><p className="text-sm text-muted-foreground">Pending</p><p className="text-xl font-bold">Rs {totalPending.toLocaleString()}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll for {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
          <CardDescription>{records.length} employee records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No payroll generated for this period. Click Generate to create.</TableCell></TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee?.full_name ?? 'Unknown'}</TableCell>
                    <TableCell>Rs {Number(r.basic_salary).toLocaleString()}</TableCell>
                    <TableCell>Rs {Number(r.allowances).toLocaleString()}</TableCell>
                    <TableCell>Rs {Number(r.deductions).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">Rs {Number(r.net_salary).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>{r.status}</Badge></TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => handlePay(r.id)} disabled={paying === r.id}>
                          {paying === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Pay'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
