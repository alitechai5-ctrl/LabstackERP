'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency } from '@/lib/utils/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

type DeptRow = {
  id: string;
  department: string;
  count: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
};

const chartConfig: ChartConfig = { net_amount: { label: 'Net Revenue', color: 'hsl(var(--chart-1))' } };

export default function DepartmentWiseReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeptRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: branchData } = await supabase.from('branches').select('id, name').eq('is_active', true);
      setBranches((branchData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'branch', label: 'Branch', type: 'select', options: branches.map((b) => ({ label: b.name, value: b.id })) },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let orderQ = supabase.from('lab_orders').select('id, branch_id').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`);
    if (filters.branch) orderQ = orderQ.eq('branch_id', filters.branch);
    const { data: orders } = await orderQ;
    const orderIds = ((orders as any[]) || []).map((o) => o.id);
    if (orderIds.length === 0) { setData([]); setLoading(false); return; }

    const { data: items } = await supabase
      .from('lab_order_items')
      .select('service:services(department_id, department:departments(name)), price, discount, net_price')
      .in('lab_order_id', orderIds);

    const grouped = new Map<string, DeptRow>();
    for (const item of (items as any[]) || []) {
      const deptName = item.service?.department?.name || 'General';
      const existing = grouped.get(deptName);
      if (existing) {
        existing.count += 1;
        existing.gross_amount += Number(item.price) || 0;
        existing.discount_amount += Number(item.discount) || 0;
        existing.net_amount += Number(item.net_price) || 0;
      } else {
        grouped.set(deptName, { id: deptName, department: deptName, count: 1, gross_amount: Number(item.price) || 0, discount_amount: Number(item.discount) || 0, net_amount: Number(item.net_price) || 0 });
      }
    }

    setData(Array.from(grouped.values()).sort((a, b) => b.net_amount - a.net_amount));
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => !search || r.department.toLowerCase().includes(search.toLowerCase()));
  const totals = { count: filtered.reduce((s, r) => s + r.count, 0), gross_amount: filtered.reduce((s, r) => s + r.gross_amount, 0), discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0), net_amount: filtered.reduce((s, r) => s + r.net_amount, 0) };

  const columns: ReportColumn<DeptRow>[] = [
    { key: 'department', label: 'Department' },
    { key: 'count', label: 'Test Count', align: 'right', isNumeric: true, exportValue: (r) => r.count },
    { key: 'gross_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.gross_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net Revenue', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Department-wise Revenue Report</h1>
        <p className="text-sm text-muted-foreground">Revenue grouped by department</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {data.length > 0 && !loading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Department</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={filtered} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="department" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="net_amount" fill="var(--color-net_amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search departments..." onSearchChange={setSearch} exportFilename="department-wise-revenue" title="Department-wise Revenue Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={25} />
      )}
    </div>
  );
}
