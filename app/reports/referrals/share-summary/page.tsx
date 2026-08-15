'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type ReferralDetailRow = {
  id: string;
  referral_name: string;
  source_type: string;
  mr_no: string;
  patient_name: string;
  order_code: string;
  service_name: string;
  date: string;
  gross_amount: number;
  discount_amount: number;
  paid_amount: number;
  net_amount: number;
  share_percentage: number;
  commission_amount: number;
  test_type: string;
  settled: boolean;
};

export default function ReferralShareSummaryPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralDetailRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'referralId', label: 'Referral Source', type: 'select', options: [] },
    { key: 'sourceType', label: 'Source Type', type: 'select', options: [
      { value: 'all', label: 'All' },
      { value: 'in_source', label: 'In-Source' },
      { value: 'out_source', label: 'Out-Source' },
    ] },
    { key: 'settled', label: 'Status', type: 'select', options: [
      { value: 'all', label: 'All' },
      { value: 'pending', label: 'Pending' },
      { value: 'settled', label: 'Cleared' },
    ] },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let query = supabase
      .from('referral_settlements')
      .select(`
        id, referral_source_id, lab_order_id, service_name, commission_amount,
        share_percentage, gross_amount, discount_amount, net_amount,
        source_type, settled, created_at,
        referral_source:referral_sources(name, type),
        lab_order:lab_orders(order_code, total_amount, discount_amount, paid_amount, patient_id, created_at),
        service:services(outsource_cost, outsource_lab)
      `)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    if (filters.referralId) {
      query = query.eq('referral_source_id', filters.referralId);
    }
    if (filters.sourceType && filters.sourceType !== 'all') {
      query = query.eq('source_type', filters.sourceType);
    }
    if (filters.settled === 'settled') {
      query = query.eq('settled', true);
    } else if (filters.settled === 'pending') {
      query = query.eq('settled', false);
    }

    const { data: settlements } = await query;

    const patientIds = new Set<string>();
    for (const s of (settlements as any[]) || []) {
      if (s.lab_order?.patient_id) patientIds.add(s.lab_order.patient_id);
    }

    let patientMap: Record<string, any> = {};
    if (patientIds.size > 0) {
      const { data: patients } = await supabase
        .from('patients')
        .select('id, patient_code, full_name')
        .in('id', Array.from(patientIds));
      for (const p of (patients as any[]) || []) {
        patientMap[p.id] = p;
      }
    }

    const rows: ReferralDetailRow[] = ((settlements as any[]) || []).map((s) => {
      const order = s.lab_order || {};
      const patient = patientMap[order.patient_id] || {};
      const service = s.service || {};
      const isOutsourced = service.outsource_lab != null && service.outsource_lab !== '';
      const sourceType = s.source_type || 'out_source';

      return {
        id: s.id,
        referral_name: s.referral_source?.name || 'Unknown',
        source_type: sourceType,
        mr_no: patient.patient_code || '-',
        patient_name: patient.full_name || '-',
        order_code: order.order_code || '-',
        service_name: s.service_name || '-',
        date: s.created_at ? new Date(s.created_at).toLocaleDateString() : '-',
        gross_amount: Number(s.gross_amount) || 0,
        discount_amount: Number(s.discount_amount) || 0,
        paid_amount: Number(order.paid_amount) || 0,
        net_amount: Number(s.net_amount) || 0,
        share_percentage: Number(s.share_percentage) || 0,
        commission_amount: Number(s.commission_amount) || 0,
        test_type: isOutsourced ? 'Outsource' : 'In-house',
        settled: s.settled || false,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.referral_name.toLowerCase().includes(q) ||
      r.patient_name.toLowerCase().includes(q) ||
      r.mr_no.toLowerCase().includes(q) ||
      r.order_code.toLowerCase().includes(q) ||
      r.service_name.toLowerCase().includes(q);
  });

  const totals = {
    gross_amount: filtered.reduce((s, r) => s + r.gross_amount, 0),
    discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0),
    paid_amount: filtered.reduce((s, r) => s + r.paid_amount, 0),
    net_amount: filtered.reduce((s, r) => s + r.net_amount, 0),
    commission_amount: filtered.reduce((s, r) => s + r.commission_amount, 0),
  };

  const columns: ReportColumn<ReferralDetailRow>[] = [
    { key: 'referral_name', label: 'Referral Source', sortable: true },
    { key: 'source_type', label: 'Source', render: (r) => (
      <Badge variant={r.source_type === 'in_source' ? 'default' : 'secondary'}>
        {r.source_type === 'in_source' ? 'IN' : 'OUT'}
      </Badge>
    ), exportValue: (r) => r.source_type === 'in_source' ? 'IN' : 'OUT' },
    { key: 'mr_no', label: 'MR No', sortable: true },
    { key: 'patient_name', label: 'Patient Name', sortable: true },
    { key: 'order_code', label: 'Order No' },
    { key: 'service_name', label: 'Service / Test', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'gross_amount', label: 'Total Amount', align: 'right', isNumeric: true, exportValue: (r) => r.gross_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net Amount', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'paid_amount', label: 'Paid Amount', align: 'right', isNumeric: true, exportValue: (r) => r.paid_amount },
    { key: 'share_percentage', label: 'Share %', align: 'right', isNumeric: true, exportValue: (r) => r.share_percentage, render: (r) => `${r.share_percentage}%` },
    { key: 'commission_amount', label: 'Commission', align: 'right', isNumeric: true, exportValue: (r) => r.commission_amount },
    { key: 'test_type', label: 'Test Type', render: (r) => (
      <Badge variant={r.test_type === 'Outsource' ? 'secondary' : 'default'}>{r.test_type}</Badge>
    ), exportValue: (r) => r.test_type },
    { key: 'settled', label: 'Status', render: (r) => (
      <Badge variant={r.settled ? 'default' : 'destructive'} className={r.settled ? 'bg-green-600 hover:bg-green-600' : ''}>
        {r.settled ? 'Cleared' : 'Pending'}
      </Badge>
    ), exportValue: (r) => r.settled ? 'Cleared' : 'Pending' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Referral Share Summary Report</h1>
        <p className="text-sm text-muted-foreground">Detailed per-transaction breakdown of referral commissions with patient, service, and settlement status</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Amount</p><p className="text-sm font-bold">Rs {formatCurrency(totals.gross_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Discount</p><p className="text-sm font-bold">Rs {formatCurrency(totals.discount_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Net Amount</p><p className="text-sm font-bold">Rs {formatCurrency(totals.net_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Paid Amount</p><p className="text-sm font-bold text-green-600">Rs {formatCurrency(totals.paid_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Commission</p><p className="text-sm font-bold text-primary">Rs {formatCurrency(totals.commission_amount)}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable
          columns={columns}
          data={filtered}
          search={search}
          searchPlaceholder="Search referral, patient, MR no, order..."
          onSearchChange={setSearch}
          exportFilename="referral-share-summary"
          title="Referral Share Summary Report"
          subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`}
          totalsRow={totals as any}
          pageSize={25}
          groupBy={{ label: 'Referral Source', getGroupKey: (r) => r.referral_name }}
        />
      )}
    </div>
  );
}
