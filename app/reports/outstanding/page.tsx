'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDate } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type OutstandingRow = {
  id: string;
  date: string;
  order_code: string;
  patient_name: string;
  patient_code: string;
  panel_name: string;
  net_amount: number;
  paid_amount: number;
  balance: number;
  age_days: number;
  ageing_bucket: string;
};

function getAgeingBucket(ageDays: number): string {
  if (ageDays <= 7) return '0-7 Days';
  if (ageDays <= 30) return '8-30 Days';
  if (ageDays <= 60) return '31-60 Days';
  if (ageDays <= 90) return '61-90 Days';
  return '90+ Days';
}

export default function OutstandingReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OutstandingRow[]>([]);
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
      key: 'ageing',
      label: 'Ageing Bucket',
      type: 'select',
      options: [
        { label: '0-7 Days', value: '0-7 Days' },
        { label: '8-30 Days', value: '8-30 Days' },
        { label: '31-60 Days', value: '31-60 Days' },
        { label: '61-90 Days', value: '61-90 Days' },
        { label: '90+ Days', value: '90+ Days' },
      ],
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);

    let q = supabase
      .from('lab_orders')
      .select(
        'id, order_code, total_amount, discount_amount, net_amount, paid_amount, payment_status, created_at, branch_id, patient:patients(full_name, patient_code), corporate_client:corporate_clients(name)',
      )
      .in('payment_status', ['unpaid', 'partial'])
      .order('created_at', { ascending: false });

    if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59`);
    if (filters.branch) q = q.eq('branch_id', filters.branch);

    const { data: orders } = await q;
    const now = new Date();

    const rows: OutstandingRow[] = ((orders as any[]) || [])
      .map((o) => {
        const balance = (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0);
        const ageMs = now.getTime() - new Date(o.created_at).getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        return {
          id: o.id,
          date: o.created_at,
          order_code: o.order_code,
          patient_name: o.patient?.full_name || '-',
          patient_code: o.patient?.patient_code || '-',
          panel_name: o.corporate_client?.name || 'Private',
          net_amount: Number(o.net_amount) || 0,
          paid_amount: Number(o.paid_amount) || 0,
          balance,
          age_days: ageDays,
          ageing_bucket: getAgeingBucket(ageDays),
        };
      })
      .filter((r) => r.balance > 0);

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
  }).filter((r) => {
    if (!filters.ageing) return true;
    return r.ageing_bucket === filters.ageing;
  });

  const totals = {
    net_amount: filtered.reduce((s, r) => s + r.net_amount, 0),
    paid_amount: filtered.reduce((s, r) => s + r.paid_amount, 0),
    balance: filtered.reduce((s, r) => s + r.balance, 0),
  };

  const ageingSummary = {
    '0-7 Days': filtered.filter((r) => r.ageing_bucket === '0-7 Days').reduce((s, r) => s + r.balance, 0),
    '8-30 Days': filtered.filter((r) => r.ageing_bucket === '8-30 Days').reduce((s, r) => s + r.balance, 0),
    '31-60 Days': filtered.filter((r) => r.ageing_bucket === '31-60 Days').reduce((s, r) => s + r.balance, 0),
    '61-90 Days': filtered.filter((r) => r.ageing_bucket === '61-90 Days').reduce((s, r) => s + r.balance, 0),
    '90+ Days': filtered.filter((r) => r.ageing_bucket === '90+ Days').reduce((s, r) => s + r.balance, 0),
  };

  const columns: ReportColumn<OutstandingRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_code', label: 'PIN' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'panel_name', label: 'Panel / Private' },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'paid_amount', label: 'Paid', align: 'right', isNumeric: true, exportValue: (r) => r.paid_amount },
    { key: 'balance', label: 'Balance', align: 'right', isNumeric: true, exportValue: (r) => r.balance },
    { key: 'age_days', label: 'Age (Days)', align: 'right', isNumeric: true, exportValue: (r) => r.age_days },
    {
      key: 'ageing_bucket',
      label: 'Ageing',
      render: (r) => {
        const variant = r.ageing_bucket === '0-7 Days' ? 'default' : r.ageing_bucket === '90+ Days' ? 'destructive' : 'secondary';
        return <Badge variant={variant as any} className="text-xs">{r.ageing_bucket}</Badge>;
      },
      exportValue: (r) => r.ageing_bucket,
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Outstanding / Receivables Report</h1>
        <p className="text-sm text-muted-foreground">Unpaid and partially paid invoices with ageing analysis</p>
      </div>

      <ReportFilterBar
        fields={filterFields}
        values={filters}
        onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        onApply={load}
        onReset={() => { setFilters({}); }}
        loading={loading}
      />

      {/* Ageing Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-lg font-bold text-primary">Rs {formatCurrency(totals.balance)}</p>
        </CardContent></Card>
        {Object.entries(ageingSummary).map(([bucket, amount]) => (
          <Card key={bucket}><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{bucket}</p>
            <p className="text-lg font-bold">Rs {formatCurrency(amount)}</p>
          </CardContent></Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable
          columns={columns}
          data={filtered}
          search={search}
          searchPlaceholder="Search by patient, PIN, or invoice..."
          onSearchChange={setSearch}
          exportFilename="outstanding-report"
          title="Outstanding / Receivables Report"
          subtitle="All unpaid and partially paid invoices"
          totalsRow={totals}
          pageSize={50}
        />
      )}
    </div>
  );
}
