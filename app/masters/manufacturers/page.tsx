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
import type { Manufacturer } from '@/lib/types';

const emptyManufacturer: Omit<Manufacturer, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  name: '',
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  is_active: true,
};

export default function ManufacturersPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [form, setForm] = useState<typeof emptyManufacturer>(emptyManufacturer);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Manufacturer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from('manufacturers').select('*').eq('company_id', companyId).order('name');
    if (error) {
      toast.error('Failed to load manufacturers: ' + error.message);
    } else {
      setManufacturers((data as Manufacturer[]) || []);
    }
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = manufacturers.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.contact_person?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyManufacturer);
    setDialogOpen(true);
  };

  const handleEdit = (m: Manufacturer) => {
    setEditing(m);
    const { id, company_id, created_at, updated_at, ...rest } = m;
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
      const { error } = await supabase.from('manufacturers').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Manufacturer updated successfully');
    } else {
      const { error } = await supabase.from('manufacturers').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Manufacturer created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (m: Manufacturer) => {
    const { error } = await supabase.from('manufacturers').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(m.is_active ? 'Manufacturer deactivated' : 'Manufacturer activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('manufacturers').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Manufacturer deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<Manufacturer>[] = [
    { key: 'name', label: 'Name', render: (m) => (
      <div>
        <p className="font-medium">{m.name}</p>
        <p className="text-sm text-muted-foreground">{m.contact_person ?? '-'}</p>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (m) => m.phone ?? '-' },
    { key: 'email', label: 'Email', render: (m) => m.email ?? '-' },
    { key: 'address', label: 'Address', render: (m) => m.address ?? '-' },
    { key: 'is_active', label: 'Status', render: (m) => (
      <Badge variant={m.is_active ? 'default' : 'secondary'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (m) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(m); }}>
          {m.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manufacturers</h1>
        <p className="text-muted-foreground">Manage drug and equipment manufacturers</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, contact, phone..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Manufacturer"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Manufacturer' : 'New Manufacturer'}
        description="Enter manufacturer contact details"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
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
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <Label>Active</Label>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Manufacturer"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
