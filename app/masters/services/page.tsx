'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, FileDown } from 'lucide-react';
import { ImportRateListDialog } from './import-dialog';
import type { Service, Department } from '@/lib/types';

const emptyService: Omit<Service, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  department_id: null,
  code: '',
  name: '',
  arabic_name: null,
  short_name: '',
  category: 'lab',
  price: 0,
  cost: 0,
  doctor_share_type: 'percentage',
  doctor_share: 0,
  referral_share_type: 'percentage',
  referral_share: 0,
  outsource_cost: 0,
  outsource_lab: null,
  sample_type: null,
  container: null,
  method: null,
  machine: null,
  normal_range: null,
  critical_value: null,
  turnaround_time_hours: 24,
  barcode_required: true,
  is_active: true,
};

export default function ServicesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [services, setServices] = useState<Service[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<typeof emptyService>(emptyService);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: svcs }, { data: depts }] = await Promise.all([
      supabase.from('services').select('*, department:departments(*)').eq('company_id', companyId).order('name'),
      supabase.from('departments').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
    ]);
    setServices((svcs as Service[]) || []);
    setDepartments(depts || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.short_name?.toLowerCase().includes(q);
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyService);
    setDialogOpen(true);
  };

  const handleEdit = (svc: Service) => {
    setEditing(svc);
    const { id, company_id, created_at, updated_at, ...rest } = svc;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim() || !companyId) {
      toast.error('Name and Code are required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { department, ...cleanForm } = form;
      const { error } = await supabase.from('services').update(cleanForm).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Service updated successfully');
    } else {
      const { error } = await supabase.from('services').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Service created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (svc: Service) => {
    const { error } = await supabase.from('services').update({ is_active: !svc.is_active }).eq('id', svc.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(svc.is_active ? 'Service deactivated' : 'Service activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Service deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const handleExport = () => {
    const headers = [
      'code', 'name', 'category', 'price', 'cost',
      'doctor_share', 'referral_share', 'turnaround_time_hours',
      'sample_type', 'container', 'method', 'normal_range', 'short_name',
    ];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(',')];
    for (const s of services) {
      lines.push([
        s.code, s.name, s.category, s.price, s.cost,
        s.doctor_share, s.referral_share, s.turnaround_time_hours,
        s.sample_type, s.container, s.method, s.normal_range, s.short_name,
      ].map(escape).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-list.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${services.length} services`);
  };

  const categoryColors: Record<string, string> = {
    lab: 'text-[hsl(var(--chart-4))]',
    radiology: 'text-[hsl(var(--chart-2))]',
    opd: 'text-[hsl(var(--chart-1))]',
    procedure: 'text-[hsl(var(--chart-5))]',
    package: 'text-primary',
  };

  const columns: Column<Service>[] = [
    { key: 'code', label: 'Code', render: (s) => <span className="font-mono text-sm">{s.code}</span> },
    { key: 'name', label: 'Name', render: (s) => (
      <div>
        <p className="font-medium">{s.name}</p>
        {s.short_name && <p className="text-sm text-muted-foreground">{s.short_name}</p>}
      </div>
    ) },
    { key: 'category', label: 'Category', render: (s) => (
      <Badge variant="outline" className={categoryColors[s.category]}>{s.category}</Badge>
    ) },
    { key: 'department', label: 'Department', render: (s) => s.department?.name ?? '-' },
    { key: 'price', label: 'Price', render: (s) => <span className="font-medium">{s.price.toLocaleString()}</span> },
    { key: 'cost', label: 'Cost', render: (s) => s.cost.toLocaleString() },
    { key: 'shares', label: 'Shares', render: (s) => (
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">Dr {s.doctor_share}{s.doctor_share_type === 'percentage' ? '%' : ''}</Badge>
        <Badge variant="outline">Ref {s.referral_share}{s.referral_share_type === 'percentage' ? '%' : ''}</Badge>
      </div>
    ) },
    { key: 'tat', label: 'TAT (hrs)', render: (s) => s.turnaround_time_hours },
    { key: 'is_active', label: 'Status', render: (s) => (
      <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (s) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(s); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(s); }}>
          {s.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services / Tests</h1>
        <p className="text-muted-foreground">Manage laboratory, radiology, and OPD services with pricing and shares</p>
      </div>

      <div className="flex gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="lab">Lab</SelectItem>
            <SelectItem value="radiology">Radiology</SelectItem>
            <SelectItem value="opd">OPD</SelectItem>
            <SelectItem value="procedure">Procedure</SelectItem>
            <SelectItem value="package">Package</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import Rate List
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={services.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export Rates
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, code..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Service"
        onRowClick={handleEdit}
      />

      <ImportRateListDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingServices={services}
        onImported={loadData}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Service' : 'New Service'}
        description="Enter service details including pricing and share configuration"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input value={form.short_name ?? ''} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Arabic Name</Label>
              <Input value={form.arabic_name ?? ''} onChange={(e) => setForm({ ...form, arabic_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="radiology">Radiology</SelectItem>
                  <SelectItem value="opd">OPD</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.department_id ?? 'none'} onValueChange={(v) => setForm({ ...form, department_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Price</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>TAT (hours)</Label>
              <Input type="number" value={form.turnaround_time_hours} onChange={(e) => setForm({ ...form, turnaround_time_hours: parseInt(e.target.value) || 24 })} />
            </div>
          </div>

          <div className="rounded-md bg-muted p-4">
            <p className="mb-3 text-sm font-medium">Share Configuration</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Doctor Share Type</Label>
                <Select value={form.doctor_share_type} onValueChange={(v) => setForm({ ...form, doctor_share_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage %</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={form.doctor_share} onChange={(e) => setForm({ ...form, doctor_share: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Referral Share Type</Label>
                <Select value={form.referral_share_type} onValueChange={(v) => setForm({ ...form, referral_share_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage %</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={form.referral_share} onChange={(e) => setForm({ ...form, referral_share: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outsource Cost</Label>
              <Input type="number" value={form.outsource_cost} onChange={(e) => setForm({ ...form, outsource_cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Outsource Lab</Label>
              <Input value={form.outsource_lab ?? ''} onChange={(e) => setForm({ ...form, outsource_lab: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Sample Type</Label>
              <Input value={form.sample_type ?? ''} onChange={(e) => setForm({ ...form, sample_type: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Container</Label>
              <Input value={form.container ?? ''} onChange={(e) => setForm({ ...form, container: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Input value={form.method ?? ''} onChange={(e) => setForm({ ...form, method: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Normal Range</Label>
              <Textarea value={form.normal_range ?? ''} onChange={(e) => setForm({ ...form, normal_range: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Critical Value</Label>
              <Textarea value={form.critical_value ?? ''} onChange={(e) => setForm({ ...form, critical_value: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Machine</Label>
            <Input value={form.machine ?? ''} onChange={(e) => setForm({ ...form, machine: e.target.value })} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.barcode_required} onCheckedChange={(c) => setForm({ ...form, barcode_required: c })} />
            <Label>Barcode Required</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <Label>Active</Label>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Service"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
