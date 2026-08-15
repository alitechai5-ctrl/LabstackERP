'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  BarChart, Area, AreaChart,
} from 'recharts';
import {
  Users, DollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle, FlaskConical, Package, Pill,
  Activity, FileText, Stethoscope, Building2, CalendarDays, Clock,
  CheckCircle2, UserCheck, Wallet, ShoppingCart, Undo2, Calculator,
  TestTube, FileEdit, Printer, Scan, UserCog, BarChart3, ArrowRight,
  Fingerprint, Scale, BookOpen, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RangeKey = 'today' | '7d' | '30d' | '90d' | 'ytd';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'ytd', label: 'Year to Date' },
];

function rangeStart(range: RangeKey): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'today': return today;
    case '7d': return new Date(today.getTime() - 6 * 86400000);
    case '30d': return new Date(today.getTime() - 29 * 86400000);
    case '90d': return new Date(today.getTime() - 89 * 86400000);
    case 'ytd': return new Date(today.getFullYear(), 0, 1);
  }
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'hsl(var(--chart-3))',
  sample_collected: 'hsl(var(--chart-4))',
  processing: 'hsl(var(--chart-5))',
  result_entered: 'hsl(var(--chart-4))',
  verified: 'hsl(var(--chart-2))',
  approved: 'hsl(var(--chart-1))',
  cancelled: 'hsl(var(--chart-5))',
};

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, accent, loading, trend, sparkData }: {
  label: string;
  value: string | number | undefined;
  icon: any;
  accent: string;
  loading: boolean;
  trend?: 'up' | 'down' | 'neutral';
  sparkData?: number[];
}) {
  const [displayValue, setDisplayValue] = useState<string | number>(0);
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : (value ?? 0);
  const isMonetary = typeof value === 'string' && value.startsWith('Rs');

  useEffect(() => {
    if (loading || numericValue === 0) { setDisplayValue(value ?? 0); return; }
    let frame = 0;
    const totalFrames = 30;
    const startVal = 0;
    const interval = setInterval(() => {
      frame++;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      const current = Math.round(startVal + (numericValue - startVal) * progress);
      setDisplayValue(isMonetary ? `Rs ${current.toLocaleString()}` : current);
      if (frame >= totalFrames) { clearInterval(interval); setDisplayValue(value ?? 0); }
    }, 16);
    return () => clearInterval(interval);
  }, [numericValue, loading, value, isMonetary]);

  return (
    <div className="stat-card animate-fade-in-up" style={{ '--stat-accent': accent } as React.CSSProperties}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold font-display data-mono animate-count-up">{displayValue}</p>}
          {trend && (
            <div className="flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="h-3 w-3 kpi-trend-up" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3 kpi-trend-down" />}
              {trend === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
              <span className={`text-[11px] font-medium ${trend === 'up' ? 'kpi-trend-up' : trend === 'down' ? 'kpi-trend-down' : 'text-muted-foreground'}`}>
                {trend === 'up' ? 'vs yesterday' : trend === 'down' ? 'vs yesterday' : 'no change'}
              </span>
            </div>
          )}
        </div>
        <div className="rounded-xl p-2.5 transition-transform duration-300 hover:scale-110" style={{ backgroundColor: `hsl(${accent} / 0.08)`, color: `hsl(${accent})` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="kpi-sparkline">
          <Sparkline data={sparkData} color={`hsl(${accent})`} />
        </div>
      )}
    </div>
  );
}

// ── Mini Sparkline ─────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} className="animate-draw-line" />
    </svg>
  );
}

// ── Animated Donut with Center Label ───────────────────────
function AnimatedDonut({ data, centerLabel, centerValue }: {
  data: { name: string; value: number; fill: string }[];
  centerLabel: string;
  centerValue: string | number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="relative flex items-center justify-center">
      <ChartContainer config={{}} className="h-[220px] w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            strokeWidth={2}
            paddingAngle={2}
            animationBegin={0}
            animationDuration={800}
            isAnimationActive
          >
            {data.map((e) => <Cell key={e.name} fill={e.fill} />)}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      <div className="donut-center">
        <p className="text-2xl font-bold font-display data-mono animate-count-up">{centerValue}</p>
        <p className="text-xs text-muted-foreground">{centerLabel}</p>
      </div>
    </div>
  );
}

// ── Animated Horizontal Bar List ────────────────────────────
function HBarList({ data, formatValue }: {
  data: { name: string; value: number; fill: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3 pt-2">
      {data.map((item, i) => (
        <div key={item.name} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium capitalize">{item.name}</span>
            <span className="font-bold data-mono text-muted-foreground">{formatValue ? formatValue(item.value) : item.value.toLocaleString()}</span>
          </div>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.fill,
                ['--target-width' as any]: `${(item.value / max) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Chart Card wrapper ────────────────────────────────────
function ChartCard({ title, description, children, className }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Quick Link Card ────────────────────────────────────────
function QuickLink({ href, label, desc, icon: Icon }: {
  href: string; label: string; desc: string; icon: any;
}) {
  return (
    <Link href={href}>
      <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
        <CardContent className="flex items-center gap-3 pt-5 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold font-display">{label}</p>
            <p className="text-xs text-muted-foreground truncate">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Module Nav Card ────────────────────────────────────────
function ModuleNavCard({ href, title, desc, icon: Icon }: {
  href: string; title: string; desc: string; icon: any;
}) {
  return (
    <Link href={href}>
      <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-display">{title}</CardTitle>
              <CardDescription className="text-xs">{desc}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

// ── Empty State ────────────────────────────────────────────
function EmptyChartState({ message }: { message: string }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{message}</p>;
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function DashboardPage() {
  const { appUser } = useAuth();
  const { hasModule } = usePermissions();
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>('7d');

  // Overview stats
  const [stats, setStats] = useState<any>({});
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; revenue: number; patients: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [deptBreakdown, setDeptBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);

  // Reception stats
  const [receptionStats, setReceptionStats] = useState<any>({});
  const [paymentData, setPaymentData] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [sourceData, setSourceData] = useState<{ name: string; value: number; fill: string }[]>([]);

  // Lab stats
  const [labStats, setLabStats] = useState<any>({});
  const [tatData, setTatData] = useState<{ date: string; tat: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ category: string; count: number; fill: string }[]>([]);

  // Pharmacy stats
  const [pharmacyStats, setPharmacyStats] = useState<any>({});
  const [salesTrend, setSalesTrend] = useState<{ date: string; revenue: number }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; quantity: number }[]>([]);

  // HR stats
  const [hrStats, setHrStats] = useState<any>({});
  const [attendanceTrend, setAttendanceTrend] = useState<{ date: string; present: number; absent: number }[]>([]);

  // Accounting stats
  const [acctStats, setAcctStats] = useState<any>({});
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const start = rangeStart(range).toISOString();
    const now = new Date().toISOString();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString();
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

    const queries: Promise<any>[] = [
      // Overview
      supabase.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      supabase.from('lab_orders').select('id, created_at, net_amount', { count: 'exact' }).gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id', { count: 'exact', head: true }).in('status', ['pending', 'sample_collected', 'processing', 'result_entered', 'verified']) as unknown as Promise<any>,
      supabase.from('inventory_items').select('id', { count: 'exact', head: true }).lt('current_stock', 1) as unknown as Promise<any>,
      supabase.from('inventory_items').select('id, current_stock, reorder_level') as unknown as Promise<any>,
      supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('is_active', true) as unknown as Promise<any>,
      supabase.from('lab_orders').select('*, patient:patients(*)').order('created_at', { ascending: false }).limit(6) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('status').gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('service:services(category)').gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      supabase.from('lab_order_payments').select('amount, payment_method').gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      supabase.from('patients').select('created_at').gte('created_at', start).lte('created_at', now) as unknown as Promise<any>,
      // Reception
      supabase.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', todayStart) as unknown as Promise<any>,
      supabase.from('lab_orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id', { count: 'exact', head: true }).eq('status', 'approved') as unknown as Promise<any>,
      supabase.from('lab_orders').select('net_amount, paid_amount').neq('payment_status', 'paid') as unknown as Promise<any>,
      supabase.from('lab_order_payments').select('amount, payment_method').gte('created_at', todayStart).lt('created_at', todayEnd) as unknown as Promise<any>,
      supabase.from('lab_orders').select('id, doctor_id, corporate_client_id').gte('created_at', todayStart).lt('created_at', todayEnd) as unknown as Promise<any>,
      // Lab
      supabase.from('lab_order_items').select('id, service:services(category)', { count: 'exact' }).eq('status', 'pending') as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id, service:services(category)', { count: 'exact' }).in('status', ['sample_collected', 'processing']) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id, service:services(category)', { count: 'exact' }).eq('status', 'result_entered') as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id, service:services(category)', { count: 'exact' }).eq('status', 'verified') as unknown as Promise<any>,
      supabase.from('lab_order_items').select('id, service:services(category)', { count: 'exact' }).eq('status', 'approved') as unknown as Promise<any>,
      supabase.from('lab_orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('collected_at, verified_at').in('status', ['verified', 'approved']).not('collected_at', 'is', null).not('verified_at', 'is', null).gte('collected_at', start) as unknown as Promise<any>,
      supabase.from('lab_order_items').select('service:services(category), created_at').gte('created_at', start) as unknown as Promise<any>,
      // Pharmacy
      supabase.from('inventory_items').select('id', { count: 'exact', head: true }) as unknown as Promise<any>,
      supabase.from('inventory_items').select('id', { count: 'exact', head: true }).filter('current_stock', 'lte', 'reorder_level').gt('current_stock', 0) as unknown as Promise<any>,
      supabase.from('inventory_items').select('id', { count: 'exact', head: true }).lte('current_stock', 0) as unknown as Promise<any>,
      supabase.from('inventory_items').select('current_stock, sale_price') as unknown as Promise<any>,
      supabase.from('pharmacy_sales').select('total, created_at').gte('created_at', sevenDaysAgo) as unknown as Promise<any>,
      supabase.from('pharmacy_sale_items').select('quantity, item:inventory_items(name)').gte('created_at', thirtyDaysAgo) as unknown as Promise<any>,
      // HR
      supabase.from('app_users').select('id', { count: 'exact', head: true }) as unknown as Promise<any>,
      supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('is_active', true) as unknown as Promise<any>,
      supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('date', todayStart).lt('date', todayEnd) as unknown as Promise<any>,
      supabase.from('payroll').select('net_salary').eq('status', 'paid') as unknown as Promise<any>,
      supabase.from('attendance').select('date, status').gte('date', sevenDaysAgo) as unknown as Promise<any>,
      // Accounting
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }) as unknown as Promise<any>,
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('status', 'posted') as unknown as Promise<any>,
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('status', 'draft') as unknown as Promise<any>,
      supabase.from('journal_entries').select('total_debit, total_credit') as unknown as Promise<any>,
      supabase.from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true) as unknown as Promise<any>,
      supabase.from('journal_lines').select('debit, account:chart_of_accounts(type)') as unknown as Promise<any>,
    ];

    const results = await Promise.all(queries);
    const r = results;

    // Overview
    const totalRevenue = (r[1].data || []).reduce((s: number, o: any) => s + Number(o.net_amount), 0);
    setStats({
      totalPatients: r[0].count || 0,
      totalRevenue,
      totalOrders: r[1].count || 0,
      pendingReports: r[2].count || 0,
      inventoryAlerts: r[3].count || 0,
      lowStockItems: ((r[4].data as any[]) || []).filter((i: any) => i.current_stock <= (i.reorder_level ?? 0)).length,
      totalDoctors: r[5].count || 0,
    });
    setRecentOrders((r[6].data as any[]) || []);

    const dayMap = new Map<string, { revenue: number; patients: number }>();
    for (const o of (r[1].data as any[]) || []) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dayMap.get(key) ?? { revenue: 0, patients: 0 };
      entry.revenue += Number(o.net_amount);
      dayMap.set(key, entry);
    }
    for (const p of (r[10].data as any[]) || []) {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dayMap.get(key) ?? { revenue: 0, patients: 0 };
      entry.patients += 1;
      dayMap.set(key, entry);
    }
    const sorted = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    setTrendData(sorted.map(([key, val]) => ({
      date: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: val.revenue, patients: val.patients,
    })));

    const statusCounts = new Map<string, number>();
    for (const item of (r[7].data as any[]) || []) statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
    setStatusBreakdown(Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value, fill: STATUS_COLOR_MAP[name] ?? 'hsl(var(--muted-foreground))' })));

    const deptCounts = new Map<string, number>();
    for (const item of (r[8].data as any[]) || []) { const cat = item.service?.category ?? 'other'; deptCounts.set(cat, (deptCounts.get(cat) ?? 0) + 1); }
    setDeptBreakdown(Array.from(deptCounts.entries()).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] })));

    const payCounts = new Map<string, number>();
    for (const p of (r[9].data as any[]) || []) { const m = p.payment_method ?? 'cash'; payCounts.set(m, (payCounts.get(m) ?? 0) + Number(p.amount)); }
    setPaymentBreakdown(Array.from(payCounts.entries()).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] })));

    // Reception
    const outstanding = (r[14].data || []).reduce((s: number, o: any) => s + (Number(o.net_amount) - Number(o.paid_amount)), 0);
    setReceptionStats({
      todayPatients: r[11].count || 0, todayOrders: r[12].count || 0,
      readyReports: r[13].count || 0, outstanding,
    });
    const payMap = new Map<string, number>();
    for (const p of (r[15].data as any[]) || []) { const m = p.payment_method ?? 'cash'; payMap.set(m, (payMap.get(m) ?? 0) + Number(p.amount)); }
    setPaymentData(Array.from(payMap.entries()).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] })));
    let walkin = 0, referred = 0, panel = 0;
    for (const o of (r[16].data as any[]) || []) { if (o.corporate_client_id) panel++; else if (o.doctor_id) referred++; else walkin++; }
    setSourceData([{ name: 'walkin', value: walkin, fill: CHART_COLORS[0] }, { name: 'referred', value: referred, fill: CHART_COLORS[1] }, { name: 'panel', value: panel, fill: CHART_COLORS[2] }].filter(d => d.value > 0));

    // Lab
    const countLab = (res: any) => ((res.data as any[]) || []).filter((i: any) => i.service?.category === 'lab').length;
    setLabStats({
      pendingCollection: countLab(r[17]), processing: countLab(r[18]),
      resultEntered: countLab(r[19]), verified: countLab(r[20]),
      approved: countLab(r[21]), totalToday: r[22].count || 0,
    });
    const tatMap = new Map<string, { total: number; count: number }>();
    for (const item of (r[23].data as any[]) || []) {
      const collected = new Date(item.collected_at); const verified = new Date(item.verified_at);
      const hours = (verified.getTime() - collected.getTime()) / 3600000;
      if (hours < 0 || hours > 720) continue;
      const key = `${collected.getFullYear()}-${String(collected.getMonth() + 1).padStart(2, '0')}-${String(collected.getDate()).padStart(2, '0')}`;
      const entry = tatMap.get(key) ?? { total: 0, count: 0 }; entry.total += hours; entry.count += 1; tatMap.set(key, entry);
    }
    const sortedTat = Array.from(tatMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    setTatData(sortedTat.map(([key, val]) => ({ date: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tat: Math.round((val.total / val.count) * 10) / 10 })));
    const catMap = new Map<string, number>();
    for (const item of (r[24].data as any[]) || []) { const cat = item.service?.category ?? 'other'; catMap.set(cat, (catMap.get(cat) ?? 0) + 1); }
    setCategoryData(Array.from(catMap.entries()).map(([category, count], i) => ({ category, count, fill: CHART_COLORS[i % CHART_COLORS.length] })));

    // Pharmacy
    const stockValue = (r[27].data || []).reduce((s: number, i: any) => s + (Number(i.current_stock) * Number(i.sale_price)), 0);
    setPharmacyStats({ totalItems: r[25].count || 0, lowStock: r[26].count || 0, outOfStock: r[27].count || 0, stockValue });
    const salesDayMap = new Map<string, number>();
    for (const s of (r[28].data as any[]) || []) {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      salesDayMap.set(key, (salesDayMap.get(key) ?? 0) + Number(s.total));
    }
    const sortedSales = Array.from(salesDayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    setSalesTrend(sortedSales.map(([key, revenue]) => ({ date: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue })));
    const itemMap = new Map<string, number>();
    for (const si of (r[29].data as any[]) || []) { const name = si.item?.name ?? 'Unknown'; itemMap.set(name, (itemMap.get(name) ?? 0) + Number(si.quantity)); }
    setTopItems(Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 10));

    // HR
    const monthlyPayroll = (r[33].data || []).reduce((s: number, p: any) => s + Number(p.net_salary), 0);
    setHrStats({ totalStaff: r[30].count || 0, activeStaff: r[31].count || 0, presentToday: r[32].count || 0, monthlyPayroll });
    const attMap = new Map<string, { present: number; absent: number }>();
    for (const a of (r[34].data as any[]) || []) {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = attMap.get(key) ?? { present: 0, absent: 0 };
      if (a.status === 'absent' || a.status === 'leave') entry.absent++; else entry.present++;
      attMap.set(key, entry);
    }
    const sortedAtt = Array.from(attMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    setAttendanceTrend(sortedAtt.map(([key, val]) => ({ date: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), present: val.present, absent: val.absent })));

    // Accounting
    const totalDebit = (r[38].data || []).reduce((s: number, e: any) => s + Number(e.total_debit), 0);
    const totalCredit = (r[38].data || []).reduce((s: number, e: any) => s + Number(e.total_credit), 0);
    setAcctStats({ totalEntries: r[35].count || 0, postedEntries: r[36].count || 0, draftEntries: r[37].count || 0, totalDebit, totalCredit, totalAccounts: r[39].count || 0 });
    const typeMap = new Map<string, number>();
    for (const line of (r[40].data as any[]) || []) { const type = line.account?.type ?? 'other'; typeMap.set(type, (typeMap.get(type) ?? 0) + Number(line.debit)); }
    setExpenseBreakdown(Array.from(typeMap.entries()).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] })));

    setLoading(false);
  }, [supabase, range]);

  useEffect(() => { load(); }, [load]);

  const trendConfig: ChartConfig = { revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' }, patients: { label: 'Patients', color: 'hsl(var(--chart-4))' } };
  const paymentConfig: ChartConfig = { cash: { label: 'Cash', color: 'hsl(var(--chart-1))' }, online: { label: 'Online', color: 'hsl(var(--chart-4))' }, card: { label: 'Card', color: 'hsl(var(--chart-5))' } };
  const salesConfig: ChartConfig = { revenue: { label: 'Sales', color: 'hsl(var(--chart-1))' } };
  const attendanceConfig: ChartConfig = { present: { label: 'Present', color: 'hsl(var(--chart-1))' }, absent: { label: 'Absent', color: 'hsl(var(--chart-5))' } };
  const tatConfig: ChartConfig = { tat: { label: 'Avg TAT (hrs)', color: 'hsl(var(--chart-1))' } };

  const overviewCards = useMemo(() => [
    { label: 'Patients', value: stats.totalPatients, icon: Users, accent: '200 85% 41%', trend: 'up' as const, sparkData: trendData.map((d) => d.patients) },
    { label: 'Revenue', value: `Rs ${Number(stats.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, accent: '160 70% 38%', trend: 'up' as const, sparkData: trendData.map((d) => d.revenue) },
    { label: 'Orders', value: stats.totalOrders, icon: FileText, accent: '200 85% 41%', trend: 'up' as const, sparkData: trendData.map((d) => d.patients) },
    { label: 'Pending Reports', value: stats.pendingReports, icon: FlaskConical, accent: '38 88% 50%', trend: 'neutral' as const, sparkData: trendData.map((d) => d.revenue) },
    { label: 'Active Doctors', value: stats.totalDoctors, icon: Stethoscope, accent: '200 85% 41%', trend: 'neutral' as const },
    { label: 'Low Stock', value: stats.lowStockItems, icon: AlertTriangle, accent: '38 88% 50%', trend: 'down' as const },
    { label: 'Out of Stock', value: stats.inventoryAlerts, icon: Package, accent: '4 72% 50%', trend: 'down' as const },
  ], [stats, trendData]);

  const receptionCards = [
    { label: "Today's Patients", value: receptionStats.todayPatients, icon: Users, accent: '200 85% 41%', trend: 'up' as const },
    { label: "Today's Orders", value: receptionStats.todayOrders, icon: FileText, accent: '160 70% 38%', trend: 'up' as const },
    { label: 'Ready Reports', value: receptionStats.readyReports, icon: CheckCircle2, accent: '160 70% 38%', trend: 'up' as const },
    { label: 'Outstanding', value: `Rs ${Number(receptionStats.outstanding || 0).toLocaleString()}`, icon: AlertTriangle, accent: '4 72% 50%', trend: 'down' as const },
  ];

  const labCards = [
    { label: 'Pending Collection', value: labStats.pendingCollection, icon: TestTube, accent: '200 85% 41%', trend: 'neutral' as const },
    { label: 'Processing', value: labStats.processing, icon: FlaskConical, accent: '38 88% 50%', trend: 'neutral' as const },
    { label: 'Result Entry', value: labStats.resultEntered, icon: FileEdit, accent: '38 88% 50%', trend: 'neutral' as const },
    { label: 'Verified', value: labStats.verified, icon: CheckCircle2, accent: '160 70% 38%', trend: 'up' as const },
    { label: 'Approved', value: labStats.approved, icon: CheckCircle2, accent: '160 70% 38%', trend: 'up' as const },
    { label: "Today's Orders", value: labStats.totalToday, icon: Clock, accent: '200 85% 41%', trend: 'up' as const },
  ];

  const pharmacyCards = [
    { label: 'Total Items', value: pharmacyStats.totalItems, icon: Package, accent: '200 85% 41%', trend: 'neutral' as const },
    { label: 'Low Stock', value: pharmacyStats.lowStock, icon: AlertTriangle, accent: '38 88% 50%', trend: 'down' as const },
    { label: 'Out of Stock', value: pharmacyStats.outOfStock, icon: AlertTriangle, accent: '4 72% 50%', trend: 'down' as const },
    { label: 'Stock Value', value: `Rs ${Number(pharmacyStats.stockValue || 0).toLocaleString()}`, icon: DollarSign, accent: '160 70% 38%', trend: 'up' as const },
  ];

  const hrCards = [
    { label: 'Total Staff', value: hrStats.totalStaff, icon: Users, accent: '200 85% 41%', trend: 'neutral' as const },
    { label: 'Active', value: hrStats.activeStaff, icon: UserCheck, accent: '160 70% 38%', trend: 'up' as const },
    { label: 'Present Today', value: hrStats.presentToday, icon: CalendarClock, accent: '200 85% 41%', trend: 'up' as const },
    { label: 'Monthly Payroll', value: `Rs ${Number(hrStats.monthlyPayroll || 0).toLocaleString()}`, icon: Wallet, accent: '160 70% 38%', trend: 'neutral' as const },
  ];

  const acctCards = [
    { label: 'Total Entries', value: acctStats.totalEntries, icon: BookOpen, accent: '200 85% 41%', trend: 'up' as const },
    { label: 'Posted', value: acctStats.postedEntries, icon: TrendingUp, accent: '160 70% 38%', trend: 'up' as const },
    { label: 'Drafts', value: acctStats.draftEntries, icon: FileText, accent: '38 88% 50%', trend: 'neutral' as const },
    { label: 'Total Debit', value: `Rs ${Number(acctStats.totalDebit || 0).toLocaleString()}`, icon: DollarSign, accent: '200 85% 41%', trend: 'up' as const },
    { label: 'Total Credit', value: `Rs ${Number(acctStats.totalCredit || 0).toLocaleString()}`, icon: Scale, accent: '210 65% 55%', trend: 'up' as const },
    { label: 'Chart Accounts', value: acctStats.totalAccounts, icon: FileText, accent: '210 65% 55%', trend: 'neutral' as const },
  ];

  const receptionModules = [
    { href: '/reception/register', title: 'Patient Registration', desc: 'Register a new patient', icon: Users },
    { href: '/reception/search', title: 'Patient Search', desc: 'Find patient or order', icon: FileText },
    { href: '/reception/billing', title: 'Billing', desc: 'Create invoice', icon: DollarSign },
    { href: '/reception/payments', title: 'Payment Collection', desc: 'Collect payment', icon: Wallet },
    { href: '/reception/reports', title: 'Report Center', desc: 'Print reports', icon: Printer },
    { href: '/reception/appointments', title: 'Appointments', desc: 'Schedule visits', icon: CalendarClock },
  ];

  const labModules = [
    { href: '/lab/collection', title: 'Sample Collection', desc: 'Collect pending samples', icon: TestTube },
    { href: '/lab/processing', title: 'Processing', desc: 'Samples being processed', icon: FlaskConical },
    { href: '/lab/results', title: 'Result Entry', desc: 'Enter test results', icon: FileEdit },
    { href: '/lab/verification', title: 'Verification', desc: 'Verify entered results', icon: CheckCircle2 },
    { href: '/lab/approval', title: 'Approval', desc: 'Approve verified results', icon: CheckCircle2 },
    { href: '/lab/reports', title: 'Reports', desc: 'Track status and print', icon: Printer },
  ];

  const pharmacyModules = [
    { href: '/pharmacy/sale', title: 'Sale', desc: 'Sell medicine to customers', icon: ShoppingCart },
    { href: '/pharmacy/purchase', title: 'Purchase', desc: 'Record medicine purchases', icon: ShoppingCart },
    { href: '/pharmacy/returns', title: 'Returns', desc: 'Process returns and refunds', icon: Undo2 },
  ];

  const hrModules = [
    { href: '/hr/attendance', title: 'Attendance', desc: 'Track employee attendance', icon: CalendarClock },
    { href: '/hr/payroll', title: 'Payroll', desc: 'Manage payroll and salaries', icon: Wallet },
    { href: '/hr/biometric', title: 'Biometric Machines', desc: 'Configure biometric devices', icon: Fingerprint },
  ];

  const acctModules = [
    { href: '/accounting/journal', title: 'Journal Entries', desc: 'Create and manage journal entries', icon: BookOpen },
    { href: '/accounting/coa', title: 'Chart of Accounts', desc: 'View chart of accounts', icon: FileText },
    { href: '/accounting/reports', title: 'Financial Reports', desc: 'View financial reports', icon: BarChart3 },
  ];

  const quickLinks = [
    { href: '/reception', label: 'Reception', desc: 'Register & bill patients', icon: Users },
    { href: '/lab', label: 'Laboratory', desc: 'Lab workflow', icon: FlaskConical },
    { href: '/pharmacy', label: 'Pharmacy', desc: 'Medicine inventory', icon: Pill },
    { href: '/accounting', label: 'Accounting', desc: 'Journal & reports', icon: TrendingUp },
    { href: '/masters', label: 'Masters', desc: 'Master data', icon: Building2 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {appUser?.full_name}</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[180px]">
            <CalendarDays className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl border bg-card p-1.5">
          <TabsTrigger value="overview" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          {hasModule('reception') && <TabsTrigger value="reception" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reception</TabsTrigger>}
          {hasModule('lab') && <TabsTrigger value="lab" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Laboratory</TabsTrigger>}
          {hasModule('pharmacy') && <TabsTrigger value="pharmacy" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Pharmacy</TabsTrigger>}
          {hasModule('hr') && <TabsTrigger value="hr" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">HR</TabsTrigger>}
          {hasModule('accounting') && <TabsTrigger value="accounting" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Accounting</TabsTrigger>}
        </TabsList>

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
            {overviewCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 7)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Patient Visits - Animated Area Chart */}
            <ChartCard title="Patient Visits" description="Daily visit trend over selected period" className="lg:col-span-2 chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : trendData.length === 0 ? <EmptyChartState message="No data for this period" /> : (
                <ChartContainer config={trendConfig} className="h-[260px] w-full">
                  <AreaChart data={trendData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <defs>
                      <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#revGrad)" animationDuration={1000} />
                    <Area type="monotone" dataKey="patients" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#visitGrad)" animationDuration={1200} />
                  </AreaChart>
                </ChartContainer>
              )}
            </ChartCard>

            {/* Reporting Status - Animated Donut */}
            <ChartCard title="Reporting Status" description="Test order status breakdown" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : statusBreakdown.length === 0 ? <EmptyChartState message="No data for this period" /> : (
                <AnimatedDonut data={statusBreakdown} centerLabel="Total Tests" centerValue={statusBreakdown.reduce((s, d) => s + d.value, 0)} />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Head-wise Sales - Animated Horizontal Bars */}
            <ChartCard title="Head-wise Sales" description="Revenue by service department" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : deptBreakdown.length === 0 ? <EmptyChartState message="No data for this period" /> : (
                <HBarList data={deptBreakdown} formatValue={(v) => `Rs ${v.toLocaleString()}`} />
              )}
            </ChartCard>

            {/* Cash Collection - Animated Donut */}
            <ChartCard title="Cash Collection" description="Revenue by payment method" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : paymentBreakdown.length === 0 ? <EmptyChartState message="No data for this period" /> : (
                <AnimatedDonut data={paymentBreakdown} centerLabel="Total Collected" centerValue={`Rs ${paymentBreakdown.reduce((s, d) => s + d.value, 0).toLocaleString()}`} />
              )}
            </ChartCard>

            {/* Type-wise Orders - Animated Horizontal Bars */}
            <ChartCard title="Visit Type" description="Walk-in vs referred vs panel" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : sourceData.length === 0 ? <EmptyChartState message="No orders today" /> : (
                <HBarList data={sourceData} />
              )}
            </ChartCard>
          </div>

          {/* Quick Access */}
          <div>
            <h2 className="mb-3 text-lg font-semibold font-display">Quick Access</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {quickLinks.map((q, i) => (
                <div key={q.href} className={`animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}>
                  <QuickLink {...q} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="chart-card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-display"><Activity className="h-5 w-5 text-primary" /> Recent Activity</CardTitle>
              <CardDescription>Latest patient orders</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : recentOrders.length === 0 ? <EmptyChartState message="No orders yet" /> : (
                <div className="space-y-2">
                  {recentOrders.map((order, i) => (
                    <Link key={order.id} href={`/reception/search?id=${order.id}`}>
                      <div className="flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-muted/50 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-4 w-4 text-primary" /></div>
                          <div>
                            <p className="text-sm font-medium data-mono">{order.order_code}</p>
                            <p className="text-xs text-muted-foreground">{order.patient?.full_name ?? 'Unknown'} · {new Date(order.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'partial' ? 'secondary' : 'destructive'}>{order.payment_status}</Badge>
                          <span className="text-sm font-medium data-mono">Rs {Number(order.net_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RECEPTION ═══ */}
        {hasModule('reception') && (
        <TabsContent value="reception" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {receptionCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 4)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue by Payment Mode" description="Today's collections split by method" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : paymentData.length === 0 ? <EmptyChartState message="No payments collected today" /> : (
                <ChartContainer config={paymentConfig} className="h-[260px] w-full">
                  <BarChart data={paymentData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} animationDuration={800} isAnimationActive>
                      {paymentData.map((e) => <Cell key={e.name} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </ChartCard>
            <ChartCard title="Invoice Source Split" description="Walk-in vs referred vs panel-billed" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : sourceData.length === 0 ? <EmptyChartState message="No orders today" /> : (
                <AnimatedDonut data={sourceData} centerLabel="Orders" centerValue={sourceData.reduce((s, d) => s + d.value, 0)} />
              )}
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {receptionModules.map((m) => <ModuleNavCard key={m.href} {...m} />)}
          </div>
        </TabsContent>
        )}

        {/* ═══ LAB ═══ */}
        {hasModule('lab') && (
        <TabsContent value="lab" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {labCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Sample Turnaround Time (TAT)" description="Average hours from collection to verified result" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : tatData.length === 0 ? <EmptyChartState message="No TAT data for this period" /> : (
                <ChartContainer config={tatConfig} className="h-[260px] w-full">
                  <AreaChart data={tatData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <defs>
                      <linearGradient id="tatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="tat" stroke="var(--color-tat)" strokeWidth={2.5} fill="url(#tatGrad)" animationDuration={1000} />
                  </AreaChart>
                </ChartContainer>
              )}
            </ChartCard>
            <ChartCard title="Test Volume by Category" description="Order items grouped by service category" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : categoryData.length === 0 ? <EmptyChartState message="No test data for this period" /> : (
                <HBarList data={categoryData.map((c) => ({ name: c.category, value: c.count, fill: c.fill }))} />
              )}
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labModules.map((m) => <ModuleNavCard key={m.href} {...m} />)}
          </div>
        </TabsContent>
        )}

        {/* ═══ PHARMACY ═══ */}
        {hasModule('pharmacy') && (
        <TabsContent value="pharmacy" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {pharmacyCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 4)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Sales Revenue Trend" description="Daily pharmacy sales over last 7 days" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : salesTrend.length === 0 ? <EmptyChartState message="No sales in the last 7 days" /> : (
                <ChartContainer config={salesConfig} className="h-[260px] w-full">
                  <AreaChart data={salesTrend} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#salesGrad)" animationDuration={1000} />
                  </AreaChart>
                </ChartContainer>
              )}
            </ChartCard>
            <ChartCard title="Top Selling Items" description="Top 10 by quantity sold (last 30 days)" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : topItems.length === 0 ? <EmptyChartState message="No sales data" /> : (
                <HBarList data={topItems.map((t, i) => ({ name: t.name, value: t.quantity, fill: CHART_COLORS[i % CHART_COLORS.length] }))} />
              )}
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pharmacyModules.map((m) => <ModuleNavCard key={m.href} {...m} />)}
          </div>
        </TabsContent>
        )}

        {/* ═══ HR ═══ */}
        {hasModule('hr') && (
        <TabsContent value="hr" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {hrCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 4)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>
          <ChartCard title="Attendance Trend" description="Daily present vs absent (last 7 days)" className="chart-card-hover">
            {loading ? <Skeleton className="h-[260px] w-full" /> : attendanceTrend.length === 0 ? <EmptyChartState message="No attendance data for this period" /> : (
              <ChartContainer config={attendanceConfig} className="h-[260px] w-full">
                <BarChart data={attendanceTrend} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="present" stackId="a" fill="var(--color-present)" barSize={24} animationDuration={800} isAnimationActive />
                  <Bar dataKey="absent" stackId="a" fill="var(--color-absent)" radius={[4, 4, 0, 0]} barSize={24} animationDuration={1000} isAnimationActive />
                </BarChart>
              </ChartContainer>
            )}
          </ChartCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hrModules.map((m) => <ModuleNavCard key={m.href} {...m} />)}
          </div>
        </TabsContent>
        )}

        {/* ═══ ACCOUNTING ═══ */}
        {hasModule('accounting') && (
        <TabsContent value="accounting" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {acctCards.map((c, i) => (
              <div key={c.label} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
                <KpiCard {...c} loading={loading} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Expense Breakdown" description="Journal debits by account category" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : expenseBreakdown.length === 0 ? <EmptyChartState message="No journal entries posted yet" /> : (
                <AnimatedDonut data={expenseBreakdown} centerLabel="Total Debit" centerValue={`Rs ${expenseBreakdown.reduce((s, d) => s + d.value, 0).toLocaleString()}`} />
              )}
            </ChartCard>
            <ChartCard title="Category Summary" description="Total debit amounts by account type" className="chart-card-hover">
              {loading ? <Skeleton className="h-[260px] w-full" /> : expenseBreakdown.length === 0 ? <EmptyChartState message="No data" /> : (
                <HBarList data={expenseBreakdown} formatValue={(v) => `Rs ${v.toLocaleString()}`} />
              )}
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {acctModules.map((m) => <ModuleNavCard key={m.href} {...m} />)}
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* System Status */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">System Status</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium">{appUser?.role?.display_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-medium">{appUser?.branch?.name || 'Not assigned'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium text-[hsl(var(--chart-2))]">Active</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
