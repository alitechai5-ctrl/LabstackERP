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
import type { InsuranceCompany } from '@/lib/types';

const emptyInsurance: Omit<InsuranceCompany, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  name: '',
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  discount_percentage: 0,
  credit_limit: 0,
  outstanding: 0,
  is_active: true,
};

export default function InsurancePage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [insurances, setInsurances] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<typeof emptyInsurance>(emptyInsurance);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InsuranceCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from('insurance_companies').select('*').eq('company_id', companyId).order('name');
    if (error) {
      toast.error('Failed to load insurance companies: ' + error.message);
    } else {
      setInsurances((data as InsuranceCompany[]) || []);
    }
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = insurances.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.contact_person?.toLowerCase().includes(q) ||
      i.phone?.includes(q) ||
      i.email?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyInsurance);
    setDialogOpen(true);
  };

  const handleEdit = (i: InsuranceCompany) => {
    setEditing(i);
    const { id, company_id, created_at, updated_at, ...rest } = i;
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
      const { error } = await supabase.from('insurance_companies').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Insurance company updated successfully');
    } else {
      const { error } = await supabase.from('insurance_companies').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Insurance company created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (i: InsuranceCompany) => {
    const { error } = await supabase.from('insurance_companies').update({ is_active: !i.is_active }).eq('id', i.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(i.is_active ? 'Insurance company deactivated' : 'Insurance company activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('insurance_companies').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Insurance company deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<InsuranceCompany>[] = [
    { key: 'name', label: 'Name', render: (i) => (
      <div>
        <p className="font-medium">{i.name}</p>
        <p className="text-sm text-muted-foreground">{i.contact_person ?? '-'}</p>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (i) => i.phone ?? '-' },
    { key: 'email', label: 'Email', render: (i) => i.email ?? '-' },
    { key: 'discount_percentage', label: 'Discount %', render: (i) => `${i.discount_percentage}%` },
    { key: 'credit_limit', label: 'Credit Limit', render: (i) => i.credit_limit.toLocaleString() },
    { key: 'outstanding', label: 'Outstanding', render: (i) => i.outstanding.toLocaleString() },
    { key: 'is_active', label: 'Status', render: (i) => (
      <Badge variant={i.is_active ? 'default' : 'secondary'}>{i.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (i) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(i); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(i); }}>
          {i.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(i); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insurance Companies</h1>
        <p className="text-muted-foreground">Manage insurance companies with discounts and credit limits</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, contact, phone..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Insurance"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Insurance Company' : 'New Insurance Company'}
        description="Enter insurance company details including discount and credit configuration"
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
        title="Delete Insurance Company"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
