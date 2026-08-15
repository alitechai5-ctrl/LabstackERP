'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { formatCurrency } from '@/lib/utils/export';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type Summary = {
  totalOrders: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  cashCollection: number;
  onlineCollection: number;
  cardCollection: number;
  doctorShare: number;
  referralShare: number;
  panelShare: number;
  totalShares: number;
  netAfterShares: number;
  panelRevenue: number;
  privateRevenue: number;
  labTests: number;
  radiologyTests: number;
};

export default function ManagementSummaryPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
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

    let orderQ = supabase
      .from('lab_orders')
      .select('id, total_amount, discount_amount, net_amount, paid_amount, corporate_client_id, branch_id')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`);
    if (filters.branch) orderQ = orderQ.eq('branch_id', filters.branch);
    const { data: orders } = await orderQ;

    const orderIds = ((orders as any[]) || []).map((o) => o.id);

    let paymentQ = supabase
      .from('lab_order_payments')
      .select('amount, payment_method')
      .gte('received_at', `${from}T00:00:00`)
      .lte('received_at', `${to}T23:59:59`);
    const { data: payments } = await paymentQ;

    const [docRes, refRes, panelRes] = await Promise.all([
      supabase.from('doctor_settlements').select('share_amount').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
      supabase.from('referral_settlements').select('commission_amount').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
      supabase.from('panel_settlements').select('share_amount').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
    ]);

    let labTests = 0, radiologyTests = 0;
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('lab_order_items')
        .select('service:services(category)')
        .in('lab_order_id', orderIds);
      for (const item of (items as any[]) || []) {
        if (item.service?.category === 'radiology') radiologyTests += 1;
        else labTests += 1;
      }
    }

    const ord = (orders as any[]) || [];
    const pay = (payments as any[]) || [];
    const docSet = (docRes.data as any[]) || [];
    const refSet = (refRes.data as any[]) || [];
    const panelSet = (panelRes.data as any[]) || [];

    const doctorShare = docSet.reduce((s, r) => s + Number(r.share_amount) || 0, 0);
    const referralShare = refSet.reduce((s, r) => s + Number(r.commission_amount) || 0, 0);
    const panelShare = panelSet.reduce((s, r) => s + Number(r.share_amount) || 0, 0);

    const netRevenue = ord.reduce((s, o) => s + Number(o.net_amount) || 0, 0);
    const totalShares = doctorShare + referralShare + panelShare;

    setSummary({
      totalOrders: ord.length,
      grossRevenue: ord.reduce((s, o) => s + Number(o.total_amount) || 0, 0),
      totalDiscount: ord.reduce((s, o) => s + Number(o.discount_amount) || 0, 0),
      netRevenue,
      totalCollected: pay.reduce((s, p) => s + Number(p.amount) || 0, 0),
      totalOutstanding: ord.reduce((s, o) => s + (Number(o.net_amount) - Number(o.paid_amount)) || 0, 0),
      cashCollection: pay.filter((p) => p.payment_method === 'cash').reduce((s, p) => s + Number(p.amount) || 0, 0),
      onlineCollection: pay.filter((p) => p.payment_method === 'online').reduce((s, p) => s + Number(p.amount) || 0, 0),
      cardCollection: pay.filter((p) => p.payment_method === 'card').reduce((s, p) => s + Number(p.amount) || 0, 0),
      doctorShare,
      referralShare,
      panelShare,
      totalShares,
      netAfterShares: netRevenue - totalShares,
      panelRevenue: ord.filter((o) => o.corporate_client_id).reduce((s, o) => s + Number(o.net_amount) || 0, 0),
      privateRevenue: ord.filter((o) => !o.corporate_client_id).reduce((s, o) => s + Number(o.net_amount) || 0, 0),
      labTests,
      radiologyTests,
    });
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Management Summary Report</h1>
        <p className="text-sm text-muted-foreground">High-level business overview with all key metrics</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : summary ? (
        <div className="space-y-4">
          {/* Revenue Section */}
          <Card>
            <CardHeader><CardTitle className="text-base">Revenue Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Total Orders" value={summary.totalOrders.toString()} />
                <Metric label="Gross Revenue" value={`Rs ${formatCurrency(summary.grossRevenue)}`} />
                <Metric label="Total Discount" value={`Rs ${formatCurrency(summary.totalDiscount)}`} />
                <Metric label="Net Revenue" value={`Rs ${formatCurrency(summary.netRevenue)}`} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Collection Section */}
          <Card>
            <CardHeader><CardTitle className="text-base">Collection Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Total Collected" value={`Rs ${formatCurrency(summary.totalCollected)}`} highlight />
                <Metric label="Outstanding" value={`Rs ${formatCurrency(summary.totalOutstanding)}`} danger />
                <Metric label="Cash" value={`Rs ${formatCurrency(summary.cashCollection)}`} />
                <Metric label="Online + Card" value={`Rs ${formatCurrency(summary.onlineCollection + summary.cardCollection)}`} />
              </div>
            </CardContent>
          </Card>

          {/* Share Section */}
          <Card>
            <CardHeader><CardTitle className="text-base">Share Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Doctor Share" value={`Rs ${formatCurrency(summary.doctorShare)}`} />
                <Metric label="Referral Share" value={`Rs ${formatCurrency(summary.referralShare)}`} />
                <Metric label="Panel Share" value={`Rs ${formatCurrency(summary.panelShare)}`} />
                <Metric label="Net After Shares" value={`Rs ${formatCurrency(summary.netAfterShares)}`} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Segment Section */}
          <Card>
            <CardHeader><CardTitle className="text-base">Segment Analysis</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Panel Revenue" value={`Rs ${formatCurrency(summary.panelRevenue)}`} />
                <Metric label="Private Revenue" value={`Rs ${formatCurrency(summary.privateRevenue)}`} />
                <Metric label="Lab Tests" value={summary.labTests.toString()} />
                <Metric label="Radiology Tests" value={summary.radiologyTests.toString()} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-primary' : danger ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}
