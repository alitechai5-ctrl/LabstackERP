'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ReferralSource } from '@/lib/types';

type SettlementWithSource = {
  id: string;
  commission_amount: number;
  commission_type: string;
  service_name: string;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
  referral_source_id: string;
  referral_source?: ReferralSource;
};

export default function ReferralShareReportPage() {
  const supabase = getSupabaseClient();
  const [settlements, setSettlements] = useState<SettlementWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<{ month: string; amount: number }[]>([]);
  const [topSources, setTopSources] = useState<{ name: string; amount: number; count: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('referral_settlements')
      .select('*, referral_source:referral_sources(*)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setSettlements((data as any) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const loadCharts = useCallback(async () => {
    setChartLoading(true);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data } = await supabase
      .from('referral_settlements')
      .select('commission_amount, created_at, referral_source:referral_sources(name)')
      .gte('created_at', sixMonthsAgo)
      .order('created_at', { ascending: true });
    const rows = (data as any[]) || [];
    const monthMap = new Map<string, number>();
    for (const s of rows) {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(s.commission_amount));
    }
    setTrendData(Array.from(monthMap.entries()).map(([month, amount]) => ({ month, amount })));
    const sourceMap = new Map<string, { amount: number; count: number }>();
    for (const s of rows) {
      const name = s.referral_source?.name ?? 'Unknown';
      const existing = sourceMap.get(name) ?? { amount: 0, count: 0 };
      sourceMap.set(name, { amount: existing.amount + Number(s.commission_amount), count: existing.count + 1 });
    }
    setTopSources(Array.from(sourceMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 10));
    setChartLoading(false);
  }, [supabase]);
  useEffect(() => { loadCharts(); }, [loadCharts]);

  const totalCommission = settlements.reduce((s, x) => s + Number(x.commission_amount), 0);
  const settledTotal = settlements.filter(s => s.settled).reduce((s, x) => s + Number(x.commission_amount), 0);
  const unsettledTotal = settlements.filter(s => !s.settled).reduce((s, x) => s + Number(x.commission_amount), 0);

  const bySource = settlements.reduce<Record<string, { source?: ReferralSource; total: number; settled: number; unsettled: number; count: number }>>((acc, s) => {
    const key = s.referral_source_id;
    if (!acc[key]) acc[key] = { source: s.referral_source, total: 0, settled: 0, unsettled: 0, count: 0 };
    acc[key].total += Number(s.commission_amount);
    acc[key].count += 1;
    if (s.settled) acc[key].settled += Number(s.commission_amount);
    else acc[key].unsettled += Number(s.commission_amount);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Share Report</h1>
        <p className="text-muted-foreground">Commission breakdown by referral source</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-4))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-4))]" /></div>
            <div><p className="text-sm text-muted-foreground">Total Commission</p><p className="text-2xl font-bold">Rs {totalCommission.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><TrendingUp className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
            <div><p className="text-sm text-muted-foreground">Settled</p><p className="text-2xl font-bold">Rs {settledTotal.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-2))]" /></div>
            <div><p className="text-sm text-muted-foreground">Unsettled</p><p className="text-2xl font-bold">Rs {unsettledTotal.toLocaleString()}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Commission Trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[260px] w-full" /> : trendData.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No data</p>
            ) : (
              <ChartContainer config={{ amount: { label: 'Commission', color: 'hsl(var(--chart-4))' } }} className="h-[260px] w-full">
                <BarChart data={trendData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Referral Sources</CardTitle>
            <CardDescription>By commission volume (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[260px] w-full" /> : topSources.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No data</p>
            ) : (
              <ChartContainer config={{ amount: { label: 'Commission', color: 'hsl(var(--chart-3))' } }} className="h-[260px] w-full">
                <BarChart data={topSources} layout="vertical" margin={{ left: 8, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : Object.keys(bySource).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No referral share data found</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySource).map(([sourceId, group]) => (
            <Card key={sourceId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{group.source?.name ?? 'Unknown Source'}</CardTitle>
                    <p className="text-sm text-muted-foreground">{group.count} transactions · {group.source?.type ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold">Rs {group.total.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Settled</p>
                      <p className="font-bold text-[hsl(var(--chart-1))]">Rs {group.settled.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Unsettled</p>
                      <p className="font-bold text-[hsl(var(--chart-2))]">Rs {group.unsettled.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
