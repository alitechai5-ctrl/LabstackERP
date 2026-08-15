'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { LabOrder, Patient } from '@/lib/types';

type OrderWithPatient = LabOrder & { patient?: Patient };

export default function BillingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [orders, setOrders] = useState<OrderWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_orders')
      .select('*, patient:patients(*)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load: ' + error.message);
    else setOrders((data as any) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return o.order_code.toLowerCase().includes(q) || o.patient?.full_name?.toLowerCase().includes(q);
  });

  const columns: Column<OrderWithPatient>[] = [
    { key: 'order_code', label: 'Invoice #', render: (o) => <span className="font-mono text-sm">{o.order_code}</span> },
    { key: 'patient', label: 'Patient', render: (o) => o.patient?.full_name ?? '-' },
    { key: 'created_at', label: 'Date', render: (o) => new Date(o.created_at).toLocaleDateString() },
    { key: 'total_amount', label: 'Total', render: (o) => `Rs ${Number(o.total_amount).toLocaleString()}` },
    { key: 'discount_amount', label: 'Discount', render: (o) => `Rs ${Number(o.discount_amount).toLocaleString()}` },
    { key: 'net_amount', label: 'Net', render: (o) => `Rs ${Number(o.net_amount).toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (o) => `Rs ${Number(o.paid_amount).toLocaleString()}` },
    { key: 'payment_status', label: 'Payment', render: (o) => (
      <Badge variant={o.payment_status === 'paid' ? 'default' : o.payment_status === 'partial' ? 'secondary' : 'destructive'}>
        {o.payment_status}
      </Badge>
    ) },
    { key: 'status', label: 'Status', render: (o) => (
      <Badge variant={o.status === 'completed' ? 'default' : 'secondary'}>{o.status.replace('_',' ')}</Badge>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage invoices and payments</p>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by invoice or patient..."
        onSearchChange={setSearch}
        onAdd={() => router.push('/billing/new')}
        addLabel="New Invoice"
      />
    </div>
  );
}
