'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type ServiceRow = {
  id: string;
  service_name: string;
  category: string;
  department: string;
  count: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
};

export default function ServiceWiseReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ServiceRow[]>([]);
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
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { label: 'Lab', value: 'lab' },
        { label: 'Radiology', value: 'radiology' },
        { label: 'OPD', value: 'opd' },
        { label: 'Procedure', value: 'procedure' },
        { label: 'Package', value: 'package' },
      ],
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let orderQ = supabase
      .from('lab_orders')
      .select('id, branch_id')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`);
    if (filters.branch) orderQ = orderQ.eq('branch_id', filters.branch);
    const { data: orders } = await orderQ;
    const orderIds = ((orders as any[]) || []).map((o) => o.id);
    if (orderIds.length === 0) { setData([]); setLoading(false); return; }

    let itemQ = supabase
      .from('lab_order_items')
      .select('id, service_id, service_name, price, discount, net_price, service:services(category, department_id, department:departments(name))')
      .in('lab_order_id', orderIds);
    const { data: items } = await itemQ;

    const grouped = new Map<string, ServiceRow>();
    for (const item of (items as any[]) || []) {
      const key = item.service_id || item.service_name || 'unknown';
      const existing = grouped.get(key);
      const cat = item.service?.category || 'lab';
      if (filters.category && cat !== filters.category) continue;
      const dept = item.service?.department?.name || 'General';
      if (existing) {
        existing.count += 1;
        existing.gross_amount += Number(item.price) || 0;
        existing.discount_amount += Number(item.discount) || 0;
        existing.net_amount += Number(item.net_price) || 0;
      } else {
        grouped.set(key, {
          id: key,
          service_name: item.service_name || 'Unknown',
          category: cat,
          department: dept,
          count: 1,
          gross_amount: Number(item.price) || 0,
          discount_amount: Number(item.discount) || 0,
          net_amount: Number(item.net_price) || 0,
        });
      }
    }

    setData(Array.from(grouped.values()).sort((a, b) => b.net_amount - a.net_amount));
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.service_name.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) || r.department.toLowerCase().includes(s);
  });

  const totals = {
    count: filtered.reduce((s, r) => s + r.count, 0),
    gross_amount: filtered.reduce((s, r) => s + r.gross_amount, 0),
    discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0),
    net_amount: filtered.reduce((s, r) => s + r.net_amount, 0),
  };

  const columns: ReportColumn<ServiceRow>[] = [
    { key: 'service_name', label: 'Service' },
    { key: 'category', label: 'Category' },
    { key: 'department', label: 'Department' },
    { key: 'count', label: 'Count', align: 'right', isNumeric: true, exportValue: (r) => r.count },
    { key: 'gross_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.gross_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Service-wise Sales Report</h1>
        <p className="text-sm text-muted-foreground">Revenue breakdown by individual service</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search services..." onSearchChange={setSearch} exportFilename="service-wise-sales" title="Service-wise Sales Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
