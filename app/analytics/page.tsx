'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TrendingUp, Users, FlaskConical, Scan, DollarSign, Activity } from 'lucide-react';

type AnalyticsData = {
  totalPatients: number;
  totalLabOrders: number;
  totalRadiologyOrders: number;
  totalRevenue: number;
  totalCollection: number;
  totalOutstanding: number;
  totalDiscount: number;
  totalReferralShare: number;
  totalDoctorShare: number;
  byDepartment: { name: string; count: number; revenue: number }[];
  byReferral: { name: string; count: number; revenue: number }[];
  byDoctor: { name: string; count: number; revenue: number }[];
  byPaymentMode: { mode: string; count: number; amount: number }[];
};

export default function AnalyticsPage() {
  const { appUser } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const companyId = appUser?.company_id;
      if (!companyId) {
        setLoading(false);
        return;
      }

      let query = supabase.from('lab_orders').select('total_amount, discount_amount, net_amount, paid_amount, payment_status, created_at, doctor_id, referral_source_id, corporate_client_id').eq('company_id', companyId);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

      const { data: orders } = await query;

      const { data: patients } = await supabase.from('patients').select('id').eq('company_id', companyId);
      const { data: doctors } = await supabase.from('doctors').select('id, full_name').eq('company_id', companyId);
      const { data: referrals } = await supabase.from('referral_sources').select('id, name').eq('company_id', companyId);
      const { data: departments } = await supabase.from('departments').select('id, name').eq('company_id', companyId);
      const { data: services } = await supabase.from('services').select('id, department_id, category').eq('company_id', companyId);
      const { data: payments } = await supabase.from('lab_order_payments').select('amount, payment_method').eq('company_id', companyId);

      const ordersList = orders || [];
      const totalRevenue = ordersList.reduce((s, o) => s + (o.total_amount || 0), 0);
      const totalCollection = ordersList.reduce((s, o) => s + (o.paid_amount || 0), 0);
      const totalOutstanding = ordersList.reduce((s, o) => s + ((o.net_amount || 0) - (o.paid_amount || 0)), 0);
      const totalDiscount = ordersList.reduce((s, o) => s + (o.discount_amount || 0), 0);

      const byDeptMap = new Map<string, { count: number; revenue: number }>();
      const byReferralMap = new Map<string, { count: number; revenue: number }>();
      const byDoctorMap = new Map<string, { count: number; revenue: number }>();
      const byPaymentMap = new Map<string, { count: number; amount: number }>();

      for (const o of ordersList) {
        if (o.referral_source_id) {
          const ref = referrals?.find((r) => r.id === o.referral_source_id);
          const key = ref?.name || 'Unknown';
          const existing = byReferralMap.get(key) || { count: 0, revenue: 0 };
          byReferralMap.set(key, { count: existing.count + 1, revenue: existing.revenue + (o.net_amount || 0) });
        }
        if (o.doctor_id) {
          const doc = doctors?.find((d) => d.id === o.doctor_id);
          const key = doc?.full_name || 'Unknown';
          const existing = byDoctorMap.get(key) || { count: 0, revenue: 0 };
          byDoctorMap.set(key, { count: existing.count + 1, revenue: existing.revenue + (o.net_amount || 0) });
        }
      }

      for (const p of payments || []) {
        const key = p.payment_method || 'cash';
        const existing = byPaymentMap.get(key) || { count: 0, amount: 0 };
        byPaymentMap.set(key, { count: existing.count + 1, amount: existing.amount + (p.amount || 0) });
      }

      const radiologyOrders = ordersList.filter((o) => {
        return false;
      });

      setData({
        totalPatients: patients?.length || 0,
        totalLabOrders: ordersList.length,
        totalRadiologyOrders: 0,
        totalRevenue,
        totalCollection,
        totalOutstanding,
        totalDiscount,
        totalReferralShare: 0,
        totalDoctorShare: 0,
        byDepartment: Array.from(byDeptMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
        byReferral: Array.from(byReferralMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
        byDoctor: Array.from(byDoctorMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
        byPaymentMode: Array.from(byPaymentMap.entries()).map(([mode, v]) => ({ mode, ...v })),
      });
      setLoading(false);
    })();
  }, [appUser?.company_id, dateFrom, dateTo]);

  const stats = [
    { label: 'Total Patients', value: data?.totalPatients ?? 0, icon: Users, color: 'text-blue-600' },
    { label: 'Lab Orders', value: data?.totalLabOrders ?? 0, icon: FlaskConical, color: 'text-emerald-600' },
    { label: 'Total Revenue', value: (data?.totalRevenue ?? 0).toLocaleString(), icon: DollarSign, color: 'text-amber-600' },
    { label: 'Collection', value: (data?.totalCollection ?? 0).toLocaleString(), icon: TrendingUp, color: 'text-green-600' },
    { label: 'Outstanding', value: (data?.totalOutstanding ?? 0).toLocaleString(), icon: Activity, color: 'text-red-600' },
    { label: 'Discount Given', value: (data?.totalDiscount ?? 0).toLocaleString(), icon: DollarSign, color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Business intelligence and performance insights</p>
        </div>
        <div className="flex gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ml-1 rounded-md border px-2 py-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ml-1 rounded-md border px-2 py-1 text-sm" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${s.color}`} />
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Referral</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : data?.byReferral.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {data?.byReferral.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{r.name}</span>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground">{r.count} orders</span>
                      <span className="font-medium data-mono">{r.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-mutedString">Loading...</p>
            ) : data?.byDoctor.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {data?.byDoctor.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.name}</span>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground">{d.count} orders</span>
                      <span className="font-medium data-mono">{d.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collection by Payment Mode</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data?.byPaymentMode.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {data?.byPaymentMode.map((p) => (
                <div key={p.mode} className="rounded-lg border p-4">
                  <p className="text-sm font-medium capitalize text-muted-foreground">{p.mode}</p>
                  <p className="mt-1 text-2xl font-bold data-mono">{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{p.count} transactions</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
