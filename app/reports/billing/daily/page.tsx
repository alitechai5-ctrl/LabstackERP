'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDate } from '@/lib/utils/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type BillingRow = {
  id: string;
  date: string;
  order_code: string;
  patient_name: string;
  patient_code: string;
  doctor_name: string | null;
  panel_name: string | null;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  balance: number;
  payment_status: string;
};

export default function DailyBillingReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillingRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true);
      setBranches((branchData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    {
      key: 'branch',
      label: 'Branch',
      type: 'select',
      options: branches.map((b) => ({ label: b.name, value: b.id })),
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      type: 'select',
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Partial', value: 'partial' },
        { label: 'Unpaid', value: 'unpaid' },
      ],
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('lab_orders')
      .select(
        'id, order_code, total_amount, discount_amount, net_amount, paid_amount, payment_status, created_at, branch_id, patient:patients(full_name, patient_code), doctor:doctors(full_name), corporate_client:corporate_clients(name)',
      )
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    if (filters.branch) q = q.eq('branch_id', filters.branch);
    if (filters.paymentStatus) q = q.eq('payment_status', filters.paymentStatus);

    const { data: orders } = await q;

    const rows: BillingRow[] = ((orders as any[]) || []).map((o) => ({
      id: o.id,
      date: o.created_at,
      order_code: o.order_code,
      patient_name: o.patient?.full_name || '-',
      patient_code: o.patient?.patient_code || '-',
      doctor_name: o.doctor?.full_name || null,
      panel_name: o.corporate_client?.name || null,
      total_amount: Number(o.total_amount) || 0,
      discount_amount: Number(o.discount_amount) || 0,
      net_amount: Number(o.net_amount) || 0,
      paid_amount: Number(o.paid_amount) || 0,
      balance: (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0),
      payment_status: o.payment_status,
    }));

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.patient_name.toLowerCase().includes(s) ||
      r.patient_code.toLowerCase().includes(s) ||
      r.order_code.toLowerCase().includes(s)
    );
  });

  const totals = {
    total_amount: filtered.reduce((s, r) => s + r.total_amount, 0),
    discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0),
    net_amount: filtered.reduce((s, r) => s + r.net_amount, 0),
    paid_amount: filtered.reduce((s, r) => s + r.paid_amount, 0),
    balance: filtered.reduce((s, r) => s + r.balance, 0),
  };

  const columns: ReportColumn<BillingRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_code', label: 'PIN' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'doctor_name', label: 'Doctor', render: (r) => r.doctor_name || '-' },
    { key: 'panel_name', label: 'Panel', render: (r) => r.panel_name || 'Private' },
    { key: 'total_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.total_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'paid_amount', label: 'Paid', align: 'right', isNumeric: true, exportValue: (r) => r.paid_amount },
    { key: 'balance', label: 'Balance', align: 'right', isNumeric: true, exportValue: (r) => r.balance },
    {
      key: 'payment_status',
      label: 'Status',
      render: (r) => {
        const variant = r.payment_status === 'paid' ? 'default' : r.payment_status === 'partial' ? 'secondary' : 'destructive';
        return <Badge variant={variant as any} className="text-xs capitalize">{r.payment_status}</Badge>;
      },
      exportValue: (r) => r.payment_status,
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Daily Billing Report</h1>
        <p className="text-sm text-muted-foreground">All invoices grouped by date with payment breakdown</p>
      </div>

      <ReportFilterBar
        fields={filterFields}
        values={filters}
        onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        onApply={load}
        onReset={() => { setFilters({}); }}
        loading={loading}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <ReportTable
          columns={columns}
          data={filtered}
          search={search}
          searchPlaceholder="Search by patient, PIN, or invoice..."
          onSearchChange={setSearch}
          exportFilename="daily-billing"
          title="Daily Billing Report"
          subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`}
          totalsRow={totals}
          pageSize={50}
        />
      )}
    </div>
  );
}
