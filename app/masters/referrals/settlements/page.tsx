'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, CheckCircle2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { ReferralSource, ReferralSettlement } from '@/lib/types';

type SettlementWithSource = ReferralSettlement & { referral_source?: ReferralSource };

export default function ReferralSettlementsPage() {
  const supabase = getSupabaseClient();
  const [settlements, setSettlements] = useState<SettlementWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unsettled');
  const [settling, setSettling] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ month: string; settled: number; unsettled: number }[]>([]);
  const [topSources, setTopSources] = useState<{ name: string; amount: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('referral_settlements').select('*, referral_source:referral_sources(*)').order('created_at', { ascending: false });
    if (filter === 'unsettled') q = q.eq('settled', false);
    else if (filter === 'settled') q = q.eq('settled', true);
    const { data, error } = await q.limit(100);
    if (error) toast.error(error.message);
    setSettlements((data as any) || []);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => { load(); }, [load]);

  const loadCharts = useCallback(async () => {
    setChartLoading(true);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data } = await supabase
      .from('referral_settlements')
      .select('commission_amount, settled, created_at, referral_source:referral_sources(name)')
      .gte('created_at', sixMonthsAgo)
      .order('created_at', { ascending: true });
    const rows = (data as any[]) || [];
    const monthMap = new Map<string, { settled: number; unsettled: number }>();
    for (const s of rows) {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const entry = monthMap.get(key) ?? { settled: 0, unsettled: 0 };
      if (s.settled) entry.settled += Number(s.commission_amount);
      else entry.unsettled += Number(s.commission_amount);
      monthMap.set(key, entry);
    }
    setTrendData(Array.from(monthMap.entries()).map(([month, val]) => ({ month, ...val })));
    const sourceMap = new Map<string, number>();
    for (const s of rows) {
      const name = s.referral_source?.name ?? 'Unknown';
      sourceMap.set(name, (sourceMap.get(name) ?? 0) + Number(s.commission_amount));
    }
    setTopSources(Array.from(sourceMap.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10));
    setChartLoading(false);
  }, [supabase]);
  useEffect(() => { loadCharts(); }, [loadCharts]);

  const handleSettle = async (id: string) => {
    setSettling(id);
    const { error } = await supabase.from('referral_settlements').update({
      settled: true,
      settled_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); setSettling(null); return; }
    toast.success('Settlement marked as paid');
    setSettling(null);
    load();
    loadCharts();
  };

  const handleSettleAll = async (sourceId: string) => {
    setSettling(sourceId);
    const { error } = await supabase.from('referral_settlements').update({
      settled: true,
      settled_at: new Date().toISOString(),
    }).eq('referral_source_id', sourceId).eq('settled', false);
    if (error) { toast.error(error.message); setSettling(null); return; }
    toast.success('All settlements marked as paid for this referral source');
    setSettling(null);
    load();
    loadCharts();
  };

  const totalUnsettled = settlements.filter(s => !s.settled).reduce((sum, s) => sum + Number(s.commission_amount), 0);
  const totalSettled = settlements.filter(s => s.settled).reduce((sum, s) => sum + Number(s.commission_amount), 0);

  const bySource = settlements.reduce<Record<string, { source?: ReferralSource; unsettled: number; settled: number; items: SettlementWithSource[] }>>((acc, s) => {
    const key = s.referral_source_id;
    if (!acc[key]) acc[key] = { source: s.referral_source, unsettled: 0, settled: 0, items: [] };
    if (s.settled) acc[key].settled += Number(s.commission_amount);
    else acc[key].unsettled += Number(s.commission_amount);
    acc[key].items.push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Settlements</h1>
          <p className="text-muted-foreground">Track and settle referral commission payments</p>
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
            <div><p className="text-sm text-muted-foreground">Unsettled Total</p><p className="text-2xl font-bold">Rs {totalUnsettled.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
            <div><p className="text-sm text-muted-foreground">Settled Total</p><p className="text-2xl font-bold">Rs {totalSettled.toLocaleString()}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Settled vs Unsettled Trend</CardTitle>
            <CardDescription>Monthly commission amounts (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[260px] w-full" /> : trendData.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No settlement data</p>
            ) : (
              <ChartContainer config={{ settled: { label: 'Settled', color: 'hsl(var(--chart-1))' }, unsettled: { label: 'Unsettled', color: 'hsl(var(--chart-2))' } }} className="h-[260px] w-full">
                <BarChart data={trendData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="settled" stackId="a" fill="hsl(var(--chart-1))" barSize={24} />
                  <Bar dataKey="unsettled" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Referral Sources</CardTitle>
            <CardDescription>By total commission volume (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[260px] w-full" /> : topSources.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No settlement data</p>
            ) : (
              <ChartContainer config={{ amount: { label: 'Amount', color: 'hsl(var(--chart-4))' } }} className="h-[260px] w-full">
                <BarChart data={topSources} layout="vertical" margin={{ left: 8, right: 12, top: 12, bottom: 12 }}>
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
      ) : Object.keys(bySource).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No settlements found</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySource).map(([sourceId, group]) => (
            <Card key={sourceId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{group.source?.name ?? 'Unknown Source'}</CardTitle>
                    <p className="text-sm text-muted-foreground">{group.source?.type ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Unsettled</p>
                      <p className="font-bold text-[hsl(var(--chart-2))]">Rs {group.unsettled.toLocaleString()}</p>
                    </div>
                    {group.unsettled > 0 && (
                      <Button size="sm" onClick={() => handleSettleAll(sourceId)} disabled={settling === sourceId}>
                        {settling === sourceId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Settle All'}
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
                        <p className="text-xs text-muted-foreground">{s.commission_type} · {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">Rs {Number(s.commission_amount).toLocaleString()}</span>
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
