'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  DollarSign,
  Receipt,
  TrendingUp,
  Users,
  Stethoscope,
  FileText,
  Package,
  Calculator,
  AlertCircle,
  Loader2,
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  FlaskConical,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils/export';

type DashboardData = {
  todayRevenue: number;
  todayCollections: number;
  todayDiscounts: number;
  todayNetSales: number;
  todayOutstanding: number;
  todayDoctorShare: number;
  todayReferralShare: number;
  todayPanelShare: number;
  opdRevenue: number;
  labRevenue: number;
  radiologyRevenue: number;
  otherRevenue: number;
  panelRevenue: number;
  cashCollection: number;
  creditCollection: number;
  revenueTrend: { date: string; revenue: number; collections: number }[];
  serviceRevenue: { name: string; value: number }[];
  departmentRevenue: { name: string; value: number }[];
  doctorRevenue: { name: string; value: number }[];
  paymentMethods: { name: string; value: number; color: string }[];
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'hsl(var(--chart-1))',
  online: 'hsl(var(--chart-4))',
  card: 'hsl(var(--chart-5))',
};

const REPORT_CATEGORIES = [
  {
    title: 'Billing Reports',
    icon: Receipt,
    color: 'text-blue-600 bg-blue-50',
    reports: [
      { label: 'Daily Billing', href: '/reports/billing/daily' },
      { label: 'Sales Report', href: '/reports/sales' },
      { label: 'Patient Billing', href: '/reports/patients/billing' },
      { label: 'Discount Report', href: '/reports/discount' },
    ],
  },
  {
    title: 'Collection Reports',
    icon: DollarSign,
    color: 'text-green-600 bg-green-50',
    reports: [
      { label: 'Daily Collection', href: '/reports/collection/daily' },
      { label: 'Outstanding / Receivables', href: '/reports/outstanding' },
      { label: 'Payment Method Report', href: '/reports/collection/payment-methods' },
    ],
  },
  {
    title: 'Service Reports',
    icon: BarChart3,
    color: 'text-purple-600 bg-purple-50',
    reports: [
      { label: 'Service-wise Sales', href: '/reports/services/service-wise' },
      { label: 'Department-wise Revenue', href: '/reports/services/department-wise' },
    ],
  },
  {
    title: 'Doctor Reports',
    icon: Stethoscope,
    color: 'text-teal-600 bg-teal-50',
    reports: [
      { label: 'Doctor Performance', href: '/reports/doctors/performance' },
      { label: 'Doctor Share Detail', href: '/reports/doctors/share-detail' },
      { label: 'Doctor Share Summary', href: '/reports/doctors/share-summary' },
    ],
  },
  {
    title: 'Referral Reports',
    icon: FileText,
    color: 'text-orange-600 bg-orange-50',
    reports: [
      { label: 'Referral Performance', href: '/reports/referrals/performance' },
      { label: 'Referral Share Detail', href: '/reports/referrals/share-detail' },
      { label: 'Referral Share Summary', href: '/reports/referrals/share-summary' },
      { label: 'Referral Partner Statement', href: '/reports/referrals/statement' },
    ],
  },
  {
    title: 'Panel Reports',
    icon: Package,
    color: 'text-indigo-600 bg-indigo-50',
    reports: [
      { label: 'Panel Billing', href: '/reports/panels/billing' },
      { label: 'Panel Performance', href: '/reports/panels/performance' },
      { label: 'Panel Share Detail', href: '/reports/panels/share-detail' },
      { label: 'Panel Outstanding', href: '/reports/panels/outstanding' },
    ],
  },
  {
    title: 'Share Reports',
    icon: TrendingUp,
    color: 'text-amber-600 bg-amber-50',
    reports: [
      { label: 'Consolidated Share Report', href: '/reports/shares' },
    ],
  },
  {
    title: 'Accounting & Management',
    icon: Calculator,
    color: 'text-rose-600 bg-rose-50',
    reports: [
      { label: 'Revenue Summary', href: '/reports/management/revenue' },
      { label: 'Management Summary', href: '/reports/management/summary' },
      { label: 'Custom Report Builder', href: '/reports/custom' },
    ],
  },
];

const trendConfig: ChartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
  collections: { label: 'Collections', color: 'hsl(var(--chart-2))' },
};

const pieConfig: ChartConfig = {
  value: { label: 'Amount' },
};

export default function ReportsDashboardPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setBranches((branchData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = dateFrom || today;
    const to = dateTo || today;

    let orderQuery = supabase
      .from('lab_orders')
      .select(
        'id, order_code, total_amount, discount_amount, net_amount, paid_amount, payment_status, created_at, branch_id, patient:patients(full_name, patient_code), doctor:doctors(full_name), referral_source:referral_sources(name), corporate_client:corporate_clients(name)',
      )
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });

    if (branchFilter !== 'all') orderQuery = orderQuery.eq('branch_id', branchFilter);

    const [ordersRes, paymentsRes, doctorSettlementsRes, referralSettlementsRes, panelSettlementsRes] =
      await Promise.all([
        orderQuery,
        supabase
          .from('lab_order_payments')
          .select('amount, payment_method, received_at')
          .gte('received_at', `${from}T00:00:00`)
          .lte('received_at', `${to}T23:59:59`),
        supabase
          .from('doctor_settlements')
          .select('share_amount, created_at')
          .gte('created_at', `${from}T00:00:00`)
          .lte('created_at', `${to}T23:59:59`),
        supabase
          .from('referral_settlements')
          .select('commission_amount, created_at')
          .gte('created_at', `${from}T00:00:00`)
          .lte('created_at', `${to}T23:59:59`),
        supabase
          .from('panel_settlements')
          .select('share_amount, created_at')
          .gte('created_at', `${from}T00:00:00`)
          .lte('created_at', `${to}T23:59:59`),
      ]);

    const orders = (ordersRes.data as any[]) || [];
    const payments = (paymentsRes.data as any[]) || [];
    const doctorSettlements = (doctorSettlementsRes.data as any[]) || [];
    const referralSettlements = (referralSettlementsRes.data as any[]) || [];
    const panelSettlements = (panelSettlementsRes.data as any[]) || [];

    const todayRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
    const todayDiscounts = orders.reduce((s, o) => s + Number(o.discount_amount), 0);
    const todayNetSales = orders.reduce((s, o) => s + Number(o.net_amount), 0);
    const todayCollections = payments.reduce((s, p) => s + Number(p.amount), 0);
    const todayOutstanding = orders.reduce(
      (s, o) => s + (Number(o.net_amount) - Number(o.paid_amount)),
      0,
    );
    const todayDoctorShare = doctorSettlements.reduce((s, r) => s + Number(r.share_amount), 0);
    const todayReferralShare = referralSettlements.reduce((s, r) => s + Number(r.commission_amount), 0);
    const todayPanelShare = panelSettlements.reduce((s, r) => s + Number(r.share_amount), 0);

    // Revenue by category - need service info from lab_order_items
    const orderIds = orders.map((o) => o.id);
    let categoryRevenue = { lab: 0, radiology: 0, opd: 0, procedure: 0, package: 0 };
    let panelRevenue = 0;

    if (orderIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('lab_order_items')
        .select('lab_order_id, price, service:services(category)')
        .in('lab_order_id', orderIds);

      const itemsByOrder = new Map<string, any[]>();
      for (const item of (itemsData as any[]) || []) {
        const arr = itemsByOrder.get(item.lab_order_id) || [];
        arr.push(item);
        itemsByOrder.set(item.lab_order_id, arr);
      }

      for (const order of orders) {
        const items = itemsByOrder.get(order.id) || [];
        for (const item of items) {
          const cat = item.service?.category || 'lab';
          categoryRevenue[cat as keyof typeof categoryRevenue] += Number(item.price);
        }
        if (order.corporate_client) panelRevenue += Number(order.net_amount);
      }
    }

    const cashCollection = payments
      .filter((p) => p.payment_method === 'cash')
      .reduce((s, p) => s + Number(p.amount), 0);
    const creditCollection = payments
      .filter((p) => p.payment_method !== 'cash')
      .reduce((s, p) => s + Number(p.amount), 0);

    // Revenue trend (last 7 days)
    const trendData: { date: string; revenue: number; collections: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(
        (o) => o.created_at.slice(0, 10) === dateStr,
      );
      const dayPayments = payments.filter(
        (p) => p.received_at.slice(0, 10) === dateStr,
      );
      trendData.push({
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        revenue: dayOrders.reduce((s, o) => s + Number(o.net_amount), 0),
        collections: dayPayments.reduce((s, p) => s + Number(p.amount), 0),
      });
    }

    // Department revenue
    const deptMap = new Map<string, number>();
    for (const order of orders) {
      const deptName = order.doctor?.full_name
        ? 'Clinical'
        : 'Laboratory';
      deptMap.set(deptName, (deptMap.get(deptName) || 0) + Number(order.net_amount));
    }

    // Doctor revenue
    const docMap = new Map<string, number>();
    for (const order of orders) {
      const name = order.doctor?.full_name || 'No Doctor';
      docMap.set(name, (docMap.get(name) || 0) + Number(order.net_amount));
    }

    // Payment method breakdown
    const methodMap = new Map<string, number>();
    for (const p of payments) {
      methodMap.set(p.payment_method, (methodMap.get(p.payment_method) || 0) + Number(p.amount));
    }

    setData({
      todayRevenue,
      todayCollections,
      todayDiscounts,
      todayNetSales,
      todayOutstanding,
      todayDoctorShare,
      todayReferralShare,
      todayPanelShare,
      opdRevenue: categoryRevenue.opd,
      labRevenue: categoryRevenue.lab,
      radiologyRevenue: categoryRevenue.radiology,
      otherRevenue: categoryRevenue.procedure + categoryRevenue.package,
      panelRevenue,
      cashCollection,
      creditCollection,
      revenueTrend: trendData,
      serviceRevenue: [
        { name: 'Lab', value: categoryRevenue.lab },
        { name: 'Radiology', value: categoryRevenue.radiology },
        { name: 'OPD', value: categoryRevenue.opd },
        { name: 'Other', value: categoryRevenue.procedure + categoryRevenue.package },
      ].filter((s) => s.value > 0),
      departmentRevenue: Array.from(deptMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      doctorRevenue: Array.from(docMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      paymentMethods: Array.from(methodMap.entries()).map(([name, value]) => ({
        name,
        value,
        color: PAYMENT_COLORS[name] || 'hsl(var(--chart-3))',
      })),
    });
    setLoading(false);
  }, [supabase, dateFrom, dateTo, branchFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const summaryCards = data
    ? [
        { label: "Today's Revenue", value: data.todayRevenue, icon: DollarSign, color: 'text-blue-600 bg-blue-50', href: '/reports/billing/daily' },
        { label: "Today's Collections", value: data.todayCollections, icon: Banknote, color: 'text-green-600 bg-green-50', href: '/reports/collection/daily' },
        { label: "Today's Discounts", value: data.todayDiscounts, icon: TrendingUp, color: 'text-orange-600 bg-orange-50', href: '/reports/discount' },
        { label: "Today's Net Sales", value: data.todayNetSales, icon: Receipt, color: 'text-teal-600 bg-teal-50', href: '/reports/billing/daily' },
        { label: "Today's Outstanding", value: data.todayOutstanding, icon: AlertCircle, color: 'text-red-600 bg-red-50', href: '/reports/outstanding' },
        { label: "Today's Doctor Share", value: data.todayDoctorShare, icon: Stethoscope, color: 'text-purple-600 bg-purple-50', href: '/reports/doctors/share-detail' },
        { label: "Today's Referral Share", value: data.todayReferralShare, icon: FileText, color: 'text-indigo-600 bg-indigo-50', href: '/reports/referrals/share-detail' },
        { label: "Today's Panel Share", value: data.todayPanelShare, icon: Package, color: 'text-amber-600 bg-amber-50', href: '/reports/panels/share-detail' },
      ]
    : [];

  const secondaryCards = data
    ? [
        { label: 'OPD Revenue', value: data.opdRevenue, icon: Users },
        { label: 'Lab Revenue', value: data.labRevenue, icon: FlaskConical },
        { label: 'Radiology Revenue', value: data.radiologyRevenue, icon: BarChart3 },
        { label: 'Other Services', value: data.otherRevenue, icon: Package },
        { label: 'Panel Revenue', value: data.panelRevenue, icon: FileText },
        { label: 'Cash Collection', value: data.cashCollection, icon: Banknote },
        { label: 'Credit Collection', value: data.creditCollection, icon: CreditCard },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Reporting Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive business intelligence and analytics
          </p>
        </div>
      </div>

      {/* Date Range Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Primary Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <Link key={card.label} href={card.href}>
                <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                  <CardContent className="flex items-center gap-3 pt-5">
                    <div className={`rounded-lg p-2.5 ${card.color}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {card.label}
                      </p>
                      <p className="text-xl font-bold">
                        Rs {formatCurrency(card.value)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Secondary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {secondaryCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <card.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-lg font-bold">
                    Rs {formatCurrency(card.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue & Collection Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={trendConfig} className="h-[280px] w-full">
                  <BarChart data={data.revenueTrend}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                    <Bar dataKey="collections" fill="var(--color-collections)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Service Revenue Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Service Category</CardTitle>
                <CardDescription>Breakdown by service type</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={pieConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="value" />} />
                    <Pie
                      data={data.serviceRevenue}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {data.serviceRevenue.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                        />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Doctor Revenue */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Doctor</CardTitle>
                <CardDescription>Top performing doctors</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={pieConfig} className="h-[280px] w-full">
                  <BarChart data={data.doctorRevenue} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
                <CardDescription>Collection by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                {data.paymentMethods.length > 0 ? (
                  <ChartContainer config={pieConfig} className="h-[280px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="value" />} />
                      <Pie
                        data={data.paymentMethods}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {data.paymentMethods.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No payment data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No data available for the selected period
          </CardContent>
        </Card>
      )}

      {/* Report Categories */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Report Categories</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {REPORT_CATEGORIES.map((cat) => (
            <Card key={cat.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-2 ${cat.color}`}>
                    <cat.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{cat.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {cat.reports.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {r.label}
                    <ArrowRight className="h-3 w-3 opacity-50" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
