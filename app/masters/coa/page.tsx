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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { ChartOfAccount } from '@/lib/types';

const emptyCOA: Omit<ChartOfAccount, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  code: '',
  name: '',
  type: 'asset',
  parent_id: null,
  is_group: false,
  opening_balance: 0,
  current_balance: 0,
  is_active: true,
};

const typeColors: Record<string, string> = {
  asset: 'text-[hsl(var(--chart-4))]',
  liability: 'text-destructive',
  equity: 'text-[hsl(var(--chart-1))]',
  revenue: 'text-primary',
  expense: 'text-[hsl(var(--chart-2))]',
};

export default function COAPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChartOfAccount | null>(null);
  const [form, setForm] = useState<typeof emptyCOA>(emptyCOA);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChartOfAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase.from('chart_of_accounts').select('*').eq('company_id', companyId).order('code');
    setAccounts(data || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyCOA);
    setDialogOpen(true);
  };

  const handleEdit = (acc: ChartOfAccount) => {
    setEditing(acc);
    const { id, company_id, created_at, updated_at, ...rest } = acc;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim() || !companyId) {
      toast.error('Code and Name are required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from('chart_of_accounts').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Account updated');
    } else {
      const { error } = await supabase.from('chart_of_accounts').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Account created');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Account deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<ChartOfAccount>[] = [
    { key: 'code', label: 'Code', render: (a) => <span className="font-mono text-sm">{a.code}</span> },
    { key: 'name', label: 'Name', render: (a) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{a.name}</span>
        {a.is_group && <Badge variant="secondary">Group</Badge>}
      </div>
    ) },
    { key: 'type', label: 'Type', render: (a) => <Badge variant="outline" className={typeColors[a.type]}>{a.type}</Badge> },
    { key: 'opening_balance', label: 'Opening', render: (a) => a.opening_balance.toLocaleString() },
    { key: 'current_balance', label: 'Current', render: (a) => a.current_balance.toLocaleString() },
    { key: 'is_active', label: 'Status', render: (a) => <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: 'Actions', render: (a) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(a); }}>Edit</Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground">Manage accounting ledger accounts</p>
      </div>

      <div className="flex gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
            <SelectItem value="liability">Liability</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by code or name..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Account"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Account' : 'New Account'}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent Account</Label>
              <Select value={form.parent_id ?? 'none'} onValueChange={(v) => setForm({ ...form, parent_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {accounts.filter((a) => a.id !== editing?.id && a.is_group).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <Input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_group} onCheckedChange={(c) => setForm({ ...form, is_group: c })} />
            <Label>Is Group Account</Label>
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
        title="Delete Account"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
