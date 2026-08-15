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
import { toast } from 'sonner';
import type { CorporateClient } from '@/lib/types';

const emptyCorporate: Omit<CorporateClient, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  name: '',
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  contract_start: null,
  contract_end: null,
  discount_percentage: 0,
  credit_limit: 0,
  outstanding: 0,
  is_active: true,
};

export default function CorporatesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateClient | null>(null);
  const [form, setForm] = useState<typeof emptyCorporate>(emptyCorporate);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CorporateClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from('corporate_clients').select('*').eq('company_id', companyId).order('name');
    if (error) {
      toast.error('Failed to load corporate clients: ' + error.message);
    } else {
      setCorporates((data as CorporateClient[]) || []);
    }
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = corporates.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyCorporate);
    setDialogOpen(true);
  };

  const handleEdit = (c: CorporateClient) => {
    setEditing(c);
    const { id, company_id, created_at, updated_at, ...rest } = c;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !companyId) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from('corporate_clients').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Corporate client updated successfully');
    } else {
      const { error } = await supabase.from('corporate_clients').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Corporate client created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (c: CorporateClient) => {
    const { error } = await supabase.from('corporate_clients').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(c.is_active ? 'Corporate client deactivated' : 'Corporate client activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('corporate_clients').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Corporate client deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<CorporateClient>[] = [
    { key: 'name', label: 'Name', render: (c) => (
      <div>
        <p className="font-medium">{c.name}</p>
        <p className="text-sm text-muted-foreground">{c.contact_person ?? '-'}</p>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (c) => c.phone ?? '-' },
    { key: 'email', label: 'Email', render: (c) => c.email ?? '-' },
    { key: 'discount_percentage', label: 'Discount %', render: (c) => `${c.discount_percentage}%` },
    { key: 'credit_limit', label: 'Credit Limit', render: (c) => c.credit_limit.toLocaleString() },
    { key: 'outstanding', label: 'Outstanding', render: (c) => c.outstanding.toLocaleString() },
    { key: 'contract', label: 'Contract', render: (c) => (
      c.contract_start && c.contract_end ? (
        <span className="text-sm">{c.contract_start} → {c.contract_end}</span>
      ) : '-'
    ) },
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
        <h1 className="text-2xl font-bold">Corporate Clients</h1>
        <p className="text-muted-foreground">Manage corporate clients with contracts, discounts, and credit limits</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, contact, phone..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Corporate"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Corporate Client' : 'New Corporate Client'}
        description="Enter corporate client details including contract and credit information"
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
              <Label>Contact Person</Label>
              <Input value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
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
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Start</Label>
              <Input type="date" value={form.contract_start ?? ''} onChange={(e) => setForm({ ...form, contract_start: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>Contract End</Label>
              <Input type="date" value={form.contract_end ?? ''} onChange={(e) => setForm({ ...form, contract_end: e.target.value || null })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Discount %</Label>
              <Input type="number" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Credit Limit</Label>
              <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Outstanding</Label>
              <Input type="number" value={form.outstanding} onChange={(e) => setForm({ ...form, outstanding: parseFloat(e.target.value) || 0 })} />
            </div>
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
        title="Delete Corporate Client"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
