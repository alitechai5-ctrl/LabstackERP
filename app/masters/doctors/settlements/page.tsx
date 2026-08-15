'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Loader2, CheckCircle2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Doctor, DoctorSettlement } from '@/lib/types';

type SettlementWithDoctor = DoctorSettlement & { doctor?: Doctor };

const trendConfig: ChartConfig = {
  settled: { label: 'Settled', color: 'hsl(var(--chart-1))' },
  unsettled: { label: 'Unsettled', color: 'hsl(var(--chart-2))' },
};

const topConfig: ChartConfig = {
  amount: { label: 'Amount', color: 'hsl(var(--chart-4))' },
};

export default function DoctorSettlementsPage() {
  const supabase = getSupabaseClient();
  const [settlements, setSettlements] = useState<SettlementWithDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unsettled');
  const [settling, setSettling] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ month: string; settled: number; unsettled: number }[]>([]);
  const [topDoctors, setTopDoctors] = useState<{ name: string; amount: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('doctor_settlements').select('*, doctor:doctors(*)').order('created_at', { ascending: false });
    if (filter === 'unsettled') q = q.eq('settled', false);
    else if (filter === 'settled') q = q.eq('settled', true);
    const { data, error } = await q.limit(100);
    if (error) toast.error(error.message);
    setSettlements((data as any) || []);
    setLoading(false);
  }, [supabase, filter]);

  const loadCharts = useCallback(async () => {
    setChartLoading(true);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data, error } = await supabase
      .from('doctor_settlements')
      .select('share_amount, settled, created_at, doctor:doctors(full_name)')
      .gte('created_at', sixMonthsAgo)
      .order('created_at', { ascending: true });

    if (error) {
      setChartLoading(false);
      return;
    }

    const rows = (data as any[]) || [];

    // Trend by month
    const monthMap = new Map<string, { settled: number; unsettled: number }>();
    for (const s of rows) {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const entry = monthMap.get(key) ?? { settled: 0, unsettled: 0 };
      if (s.settled) entry.settled += Number(s.share_amount);
      else entry.unsettled += Number(s.share_amount);
      monthMap.set(key, entry);
    }
    setTrendData(Array.from(monthMap.entries()).map(([month, val]) => ({ month, ...val })));

    // Top doctors by total volume
    const doctorMap = new Map<string, number>();
    for (const s of rows) {
      const name = s.doctor?.full_name ?? 'Unknown';
      doctorMap.set(name, (doctorMap.get(name) ?? 0) + Number(s.share_amount));
    }
    setTopDoctors(
      Array.from(doctorMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    );

    setChartLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCharts(); }, [loadCharts]);

  const handleSettle = async (id: string) => {
    setSettling(id);
    const { error } = await supabase.from('doctor_settlements').update({
      settled: true,
      settled_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); setSettling(null); return; }
    toast.success('Settlement marked as paid');
    setSettling(null);
    load();
    loadCharts();
  };

  const handleSettleAll = async (doctorId: string) => {
    setSettling(doctorId);
    const { error } = await supabase.from('doctor_settlements').update({
      settled: true,
      settled_at: new Date().toISOString(),
    }).eq('doctor_id', doctorId).eq('settled', false);
    if (error) { toast.error(error.message); setSettling(null); return; }
    toast.success('All settlements marked as paid for this doctor');
    setSettling(null);
    load();
    loadCharts();
  };

  const totalUnsettled = settlements.filter(s => !s.settled).reduce((sum, s) => sum + Number(s.share_amount), 0);
  const totalSettled = settlements.filter(s => s.settled).reduce((sum, s) => sum + Number(s.share_amount), 0);

  const byDoctor = settlements.reduce<Record<string, { doctor?: Doctor; unsettled: number; settled: number; items: SettlementWithDoctor[] }>>((acc, s) => {
    const key = s.doctor_id;
    if (!acc[key]) acc[key] = { doctor: s.doctor, unsettled: 0, settled: 0, items: [] };
    if (s.settled) acc[key].settled += Number(s.share_amount);
    else acc[key].unsettled += Number(s.share_amount);
    acc[key].items.push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Settlements</h1>
          <p className="text-muted-foreground">Track and settle doctor share payments</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unsettled">Unsettled</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-2))]" /></div>
            <div><p className="text-sm text-muted-foreground">Unsettled Total</p><p className="text-2xl font-bold data-mono">Rs {totalUnsettled.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
            <div><p className="text-sm text-muted-foreground">Settled Total</p><p className="text-2xl font-bold data-mono">Rs {totalSettled.toLocaleString()}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Settled vs Unsettled Trend</CardTitle>
            <CardDescription>Monthly settlement amounts (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : trendData.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No settlement data</p>
            ) : (
              <ChartContainer config={trendConfig} className="h-[260px] w-full">
                <BarChart data={trendData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="settled" stackId="a" fill="var(--color-settled)" radius={[0, 0, 0, 0]} barSize={24} />
                  <Bar dataKey="unsettled" stackId="a" fill="var(--color-unsettled)" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Referring Doctors</CardTitle>
            <CardDescription>By total settlement volume (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : topDoctors.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No settlement data</p>
            ) : (
              <ChartContainer config={topConfig} className="h-[260px] w-full">
                <BarChart data={topDoctors} layout="vertical" margin={{ left: 8, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : Object.keys(byDoctor).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No settlements found</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDoctor).map(([doctorId, group]) => (
            <Card key={doctorId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{group.doctor?.full_name ?? 'Unknown Doctor'}</CardTitle>
                    <p className="text-sm text-muted-foreground">{group.doctor?.specialization ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Unsettled</p>
                      <p className="font-bold text-[hsl(var(--chart-2))] data-mono">Rs {group.unsettled.toLocaleString()}</p>
                    </div>
                    {group.unsettled > 0 && (
                      <Button size="sm" onClick={() => handleSettleAll(doctorId)} disabled={settling === doctorId}>
                        {settling === doctorId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Settle All'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.items.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{s.service_name}</p>
                        <p className="text-xs text-muted-foreground">{s.share_type} · {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium data-mono">Rs {Number(s.share_amount).toLocaleString()}</span>
                        <Badge variant={s.settled ? 'default' : 'secondary'}>{s.settled ? 'Settled' : 'Pending'}</Badge>
                        {!s.settled && (
                          <Button size="sm" variant="outline" onClick={() => handleSettle(s.id)} disabled={settling === s.id}>
                            {settling === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Settle'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
