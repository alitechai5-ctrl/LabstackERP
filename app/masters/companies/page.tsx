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
import type { Company } from '@/lib/types';

const emptyCompany: Omit<Company, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  legal_name: null,
  registration_number: null,
  address: null,
  address_line_2: null,
  city: null,
  state: null,
  country: '',
  postal_code: null,
  phone: null,
  email: null,
  website: null,
  logo_url: null,
  currency: 'PKR',
  currency_symbol: 'Rs',
  tax_number: null,
  tax_percentage: 0,
  fiscal_year_start_month: 1,
  timezone: 'Asia/Karachi',
  language: 'en',
  is_active: true,
};

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function CompaniesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<typeof emptyCompany>(emptyCompany);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('companies').select('*').order('name');
    if (error) {
      toast.error('Failed to load companies: ' + error.message);
    } else {
      setCompanies((data as Company[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.legal_name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyCompany);
    setDialogOpen(true);
  };

  const handleEdit = (c: Company) => {
    setEditing(c);
    const { id, created_at, updated_at, ...rest } = c;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from('companies').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Company updated successfully');
    } else {
      const { error } = await supabase.from('companies').insert(form);
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Company created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (c: Company) => {
    const { error } = await supabase.from('companies').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(c.is_active ? 'Company deactivated' : 'Company activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('companies').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Company deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<Company>[] = [
    { key: 'name', label: 'Name', render: (c) => (
      <div>
        <p className="font-medium">{c.name}</p>
        <p className="text-sm text-muted-foreground">{c.legal_name ?? '-'}</p>
      </div>
    ) },
    { key: 'city', label: 'City', render: (c) => `${c.city ?? '-'}, ${c.country}` },
    { key: 'phone', label: 'Phone', render: (c) => c.phone ?? '-' },
    { key: 'email', label: 'Email', render: (c) => c.email ?? '-' },
    { key: 'currency', label: 'Currency', render: (c) => `${c.currency_symbol} ${c.currency}` },
    { key: 'tax_percentage', label: 'Tax %', render: (c) => `${c.tax_percentage}%` },
    { key: 'is_active', label: 'Status', render: (c) => (
      <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(c); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(c); }}>
          {c.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Companies</h1>
        <p className="text-muted-foreground">Manage company master records and fiscal settings</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, city, email..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Company"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Company' : 'New Company'}
        description="Enter company details including currency and tax configuration"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input value={form.legal_name ?? ''} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state ?? ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input value={form.postal_code ?? ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={form.logo_url ?? ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <Input value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tax Number</Label>
              <Input value={form.tax_number ?? ''} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tax Percentage</Label>
              <Input type="number" value={form.tax_percentage} onChange={(e) => setForm({ ...form, tax_percentage: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fiscal Year Start Month</Label>
            <Select value={String(form.fiscal_year_start_month)} onValueChange={(v) => setForm({ ...form, fiscal_year_start_month: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
        title="Delete Company"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
