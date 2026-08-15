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
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import type { ReferralSource, Branch } from '@/lib/types';

const emptyReferral: Omit<ReferralSource, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  branch_id: null,
  type: 'doctor',
  name: '',
  phone: null,
  email: null,
  address: null,
  commission_type: 'percentage',
  commission_value: 0,
  settlement_frequency: 'monthly',
  monthly_limit: null,
  outstanding: 0,
  ledger_balance: 0,
  is_active: true,
};

const REFERRAL_TYPES: { value: string; label: string }[] = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'agent', label: 'Agent' },
  { value: 'marketing', label: 'Marketing' },
];

export default function ReferralsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [referrals, setReferrals] = useState<ReferralSource[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReferralSource | null>(null);
  const [form, setForm] = useState<typeof emptyReferral>(emptyReferral);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReferralSource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: refs, error: refError }, { data: brs, error: branchError }] = await Promise.all([
      supabase.from('referral_sources').select('*').eq('company_id', companyId).order('name'),
      supabase.from('branches').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
    ]);
    if (refError) toast.error('Failed to load referrals: ' + refError.message);
    if (branchError) toast.error('Failed to load branches: ' + branchError.message);
    setReferrals((refs as ReferralSource[]) || []);
    setBranches(brs || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = referrals.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm({ ...emptyReferral, branch_id: appUser?.branch_id ?? null });
    setDialogOpen(true);
  };

  const handleEdit = (r: ReferralSource) => {
    setEditing(r);
    const { id, company_id, created_at, updated_at, ...rest } = r;
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
      const { error } = await supabase.from('referral_sources').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Referral source updated successfully');
    } else {
      const { error } = await supabase.from('referral_sources').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Referral source created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (r: ReferralSource) => {
    const { error } = await supabase.from('referral_sources').update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(r.is_active ? 'Referral source deactivated' : 'Referral source activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('referral_sources').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Referral source deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<ReferralSource>[] = [
    { key: 'name', label: 'Name', render: (r) => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-sm text-muted-foreground">{r.phone ?? '-'}</p>
      </div>
    ) },
    { key: 'type', label: 'Type', render: (r) => {
      const label = REFERRAL_TYPES.find((t) => t.value === r.type)?.label ?? r.type;
      return <Badge variant="outline">{label}</Badge>;
    } },
    { key: 'commission', label: 'Commission', render: (r) => (
      <span>{r.commission_value}{r.commission_type === 'percentage' ? '%' : ''}</span>
    ) },
    { key: 'settlement_frequency', label: 'Settlement', render: (r) => (
      <Badge variant="outline" className="capitalize">{r.settlement_frequency}</Badge>
    ) },
    { key: 'outstanding', label: 'Outstanding', render: (r) => r.outstanding.toLocaleString() },
    { key: 'ledger_balance', label: 'Ledger', render: (r) => r.ledger_balance.toLocaleString() },
    { key: 'is_active', label: 'Status', render: (r) => (
      <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(r); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(r); }}>
          {r.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Sources</h1>
          <p className="text-muted-foreground">Manage referral sources with commission and settlement tracking</p>
        </div>
        <Link href="/masters/referrals/settlements"><Button variant="outline" size="sm"><Wallet className="mr-2 h-4 w-4" /> Settlements</Button></Link>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, type, phone..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Referral"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Referral Source' : 'New Referral Source'}
        description="Enter referral details including commission configuration"
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
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ReferralSource['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REFERRAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label>Branch</Label>
              <Select value={form.branch_id ?? 'none'} onValueChange={(v) => setForm({ ...form, branch_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Settlement Frequency</Label>
              <Select value={form.settlement_frequency} onValueChange={(v) => setForm({ ...form, settlement_frequency: v as ReferralSource['settlement_frequency'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Commission Type</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v as ReferralSource['commission_type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage %</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commission Value</Label>
              <Input type="number" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Limit</Label>
              <Input type="number" value={form.monthly_limit ?? ''} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Ledger Balance</Label>
              <Input type="number" value={form.ledger_balance} onChange={(e) => setForm({ ...form, ledger_balance: parseFloat(e.target.value) || 0 })} />
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
        title="Delete Referral Source"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
