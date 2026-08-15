'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { formatDate, formatCurrency } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Printer, Download, FileText, Building2, Calendar, User, Phone } from 'lucide-react';
import { exportToCSV, type ExportColumn } from '@/lib/utils/export';

type StatementRow = {
  id: string;
  date: string;
  order_code: string;
  patient_name: string;
  service_name: string;
  net_amount: number;
  commission_amount: number;
  settled: boolean;
  balance: number;
};

export default function ReferralStatementPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatementRow[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [referrals, setReferrals] = useState<{ id: string; name: string; type: string; phone: string; address: string }[]>([]);
  const [selectedReferral, setSelectedReferral] = useState('');
  const [referralDetail, setReferralDetail] = useState<{ name: string; type: string; phone: string; address: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: refData } = await supabase.from('referral_sources').select('id, name, type, phone, address').eq('is_active', true).order('name');
      setReferrals((refData as any[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
  ];

  const load = useCallback(async () => {
    if (!selectedReferral) { setData([]); setLoading(false); return; }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    const ref = referrals.find((r) => r.id === selectedReferral);
    setReferralDetail(ref ? { name: ref.name, type: ref.type, phone: ref.phone || '-', address: ref.address || '-' } : null);

    const { data: settlements } = await supabase
      .from('referral_settlements')
      .select('id, created_at, lab_order_id, service_name, commission_amount, settled')
      .eq('referral_source_id', selectedReferral)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    const orderIds = Array.from(new Set((settlements as any[])?.map((s) => s.lab_order_id).filter(Boolean) || []));
    let orderMap: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase.from('lab_orders').select('id, order_code, net_amount, patient:patients(full_name)').in('id', orderIds);
      for (const o of (orders as any[]) || []) orderMap[o.id] = o;
    }

    let runningBalance = 0;
    const rows: StatementRow[] = ((settlements as any[]) || []).map((s) => {
      const o = s.lab_order_id ? orderMap[s.lab_order_id] : null;
      const amt = Number(s.commission_amount) || 0;
      if (!s.settled) runningBalance += amt;
      return {
        id: s.id,
        date: s.created_at,
        order_code: o?.order_code || '-',
        patient_name: o?.patient?.full_name || '-',
        service_name: s.service_name || '-',
        net_amount: Number(o?.net_amount) || 0,
        commission_amount: amt,
        settled: s.settled,
        balance: s.settled ? 0 : runningBalance,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters, selectedReferral, referrals]);

  useEffect(() => { load(); }, [load]);

  const totalCommission = data.reduce((s, r) => s + r.commission_amount, 0);
  const totalSettled = data.filter((r) => r.settled).reduce((s, r) => s + r.commission_amount, 0);
  const totalPending = data.filter((r) => !r.settled).reduce((s, r) => s + r.commission_amount, 0);
  const totalInvoice = data.reduce((s, r) => s + r.net_amount, 0);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const cols: ExportColumn<StatementRow>[] = [
      { key: 'date', label: 'Date', format: (r) => formatDate(r.date) },
      { key: 'order_code', label: 'Invoice' },
      { key: 'patient_name', label: 'Patient' },
      { key: 'service_name', label: 'Service' },
      { key: 'net_amount', label: 'Invoice Amount', format: (r) => String(r.net_amount) },
      { key: 'commission_amount', label: 'Commission', format: (r) => String(r.commission_amount) },
      { key: 'settled', label: 'Status', format: (r) => r.settled ? 'Settled' : 'Pending' },
    ];
    exportToCSV('referral-statement', cols, data, {
      summaryRows: [
        { label: 'Total Invoice', values: { net_amount: totalInvoice } },
        { label: 'Total Commission', values: { commission_amount: totalCommission } },
        { label: 'Settled', values: { commission_amount: totalSettled } },
        { label: 'Pending', values: { commission_amount: totalPending } },
      ],
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Partner Statement</h1>
          <p className="text-sm text-muted-foreground">Detailed commission statement for a specific referral partner</p>
        </div>
        {selectedReferral && !loading && (
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={data.length === 0}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={data.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        )}
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-4 pb-4">
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs text-muted-foreground">Select Referral Partner</Label>
            <Select value={selectedReferral} onValueChange={setSelectedReferral}>
              <SelectTrigger><SelectValue placeholder="Choose a referral source..." /></SelectTrigger>
              <SelectContent>
                {referrals.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !selectedReferral ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
          Select a referral partner to view their statement
        </CardContent></Card>
      ) : (
        <div className="statement-paper overflow-hidden">
          {/* Statement Header */}
          <div className="statement-header px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display">{referralDetail?.name || 'Referral Partner'}</h2>
                  <p className="text-xs text-muted-foreground capitalize">{referralDetail?.type || '-'}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <p className="font-medium text-foreground">Statement of Account</p>
                <p className="text-xs">{filters.dateFrom || 'Today'} — {filters.dateTo || 'Today'}</p>
              </div>
            </div>

            {/* Partner Info Grid */}
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{referralDetail?.name || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{referralDetail?.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Period:</span>
                <span className="font-medium">{filters.dateFrom || 'Today'} to {filters.dateTo || 'Today'}</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <div className="bg-card px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Invoice</p>
              <p className="mt-1 text-lg font-bold">Rs {formatCurrency(totalInvoice)}</p>
            </div>
            <div className="bg-card px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Commission</p>
              <p className="mt-1 text-lg font-bold text-primary">Rs {formatCurrency(totalCommission)}</p>
            </div>
            <div className="bg-card px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Settled</p>
              <p className="mt-1 text-lg font-bold text-green-600">Rs {formatCurrency(totalSettled)}</p>
            </div>
            <div className="bg-card px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-bold text-orange-600">Rs {formatCurrency(totalPending)}</p>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Patient</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Service</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Amount</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commission</th>
                  <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No transactions in this period</td></tr>
                ) : data.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs">{r.order_code}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium">{r.patient_name}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{r.service_name}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">Rs {formatCurrency(r.net_amount)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums">Rs {formatCurrency(r.commission_amount)}</td>
                    <td className="px-5 py-2.5 text-center">
                      {r.settled
                        ? <Badge className="bg-green-600 hover:bg-green-600">Settled</Badge>
                        : <Badge variant="secondary">Pending</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td colSpan={4} className="px-5 py-3 text-right">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums">Rs {formatCurrency(totalInvoice)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-primary">Rs {formatCurrency(totalCommission)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 sm:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </p>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Outstanding Balance: </span>
                  <span className="font-bold text-orange-600">Rs {formatCurrency(totalPending)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
