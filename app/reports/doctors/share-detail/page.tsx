'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatDate } from '@/lib/utils/export';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type DoctorShareRow = {
  id: string;
  date: string;
  doctor_name: string;
  doctor_code: string;
  order_code: string;
  patient_name: string;
  service_name: string;
  share_type: string;
  share_amount: number;
  calculation_basis: string;
  settled: boolean;
};

export default function DoctorShareDetailPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DoctorShareRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: docData } = await supabase.from('doctors').select('id, full_name').eq('is_active', true).order('full_name');
      setDoctors((docData as { id: string; full_name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'doctor', label: 'Doctor', type: 'select', options: doctors.map((d) => ({ label: d.full_name, value: d.id })) },
    {
      key: 'status',
      label: 'Settlement Status',
      type: 'select',
      options: [{ label: 'Settled', value: 'settled' }, { label: 'Pending', value: 'pending' }],
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('doctor_settlements')
      .select('id, created_at, doctor_id, lab_order_id, service_name, share_type, share_amount, calculation_basis, settled, doctor:doctors(full_name, doctor_code)')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });
    if (filters.doctor) q = q.eq('doctor_id', filters.doctor);
    if (filters.status === 'settled') q = q.eq('settled', true);
    if (filters.status === 'pending') q = q.eq('settled', false);
    const { data: settlements } = await q;

    // Fetch order codes and patient names
    const orderIds = Array.from(new Set((settlements as any[])?.map((s) => s.lab_order_id).filter(Boolean) || []));
    let orderMap: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('lab_orders')
        .select('id, order_code, patient:patients(full_name)')
        .in('id', orderIds);
      for (const o of (orders as any[]) || []) orderMap[o.id] = o;
    }

    const rows: DoctorShareRow[] = ((settlements as any[]) || []).map((s) => {
      const o = s.lab_order_id ? orderMap[s.lab_order_id] : null;
      return {
        id: s.id,
        date: s.created_at,
        doctor_name: s.doctor?.full_name || 'Unknown',
        doctor_code: s.doctor?.doctor_code || '-',
        order_code: o?.order_code || '-',
        patient_name: o?.patient?.full_name || '-',
        service_name: s.service_name || '-',
        share_type: s.share_type || '-',
        share_amount: Number(s.share_amount) || 0,
        calculation_basis: (s.calculation_basis || 'net_amount').replace(/_/g, ' '),
        settled: s.settled,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.doctor_name.toLowerCase().includes(s) || r.patient_name.toLowerCase().includes(s) || r.order_code.toLowerCase().includes(s) || r.service_name.toLowerCase().includes(s);
  });

  const totals = { share_amount: filtered.reduce((s, r) => s + r.share_amount, 0) };

  const columns: ReportColumn<DoctorShareRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'doctor_name', label: 'Doctor' },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'service_name', label: 'Service' },
    { key: 'share_type', label: 'Type', render: (r) => <Badge variant="outline" className="text-xs">{r.share_type}</Badge>, exportValue: (r) => r.share_type },
    { key: 'share_amount', label: 'Share Amount', align: 'right', isNumeric: true, exportValue: (r) => r.share_amount },
    { key: 'calculation_basis', label: 'Basis' },
    { key: 'settled', label: 'Status', render: (r) => r.settled ? <Badge variant="default">Settled</Badge> : <Badge variant="secondary">Pending</Badge>, exportValue: (r) => r.settled ? 'Settled' : 'Pending' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Doctor Share Detail Report</h1>
        <p className="text-sm text-muted-foreground">Individual share transactions for each doctor</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search by doctor, patient, invoice..." onSearchChange={setSearch} exportFilename="doctor-share-detail" title="Doctor Share Detail Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
