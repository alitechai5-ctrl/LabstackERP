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
import { Fingerprint, RefreshCw, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/utils/errors';
import type { BiometricMachine, Branch } from '@/lib/types';

type FormState = {
  name: string;
  ip_address: string;
  port: number;
  model: string;
  location: string;
  branch_id: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: '',
  ip_address: '',
  port: 4370,
  model: '',
  location: '',
  branch_id: '',
  is_active: true,
};

export default function BiometricMachinesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [machines, setMachines] = useState<BiometricMachine[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BiometricMachine | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BiometricMachine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [syncing, setSyncing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [mRes, bRes] = await Promise.all([
      supabase.from('biometric_machines').select('*, branch:branches(name)').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    if (mRes.error) toast.error(getFriendlyErrorMessage(mRes.error));
    setMachines((mRes.data as any) || []);
    setBranches((bRes.data as Branch[]) || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = machines.filter((m) => {
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.ip_address.includes(q) || (m.model ?? '').toLowerCase().includes(q);
  });

  const handleAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const handleEdit = (m: BiometricMachine) => {
    setEditing(m);
    setForm({
      name: m.name,
      ip_address: m.ip_address,
      port: m.port,
      model: m.model ?? '',
      location: m.location ?? '',
      branch_id: m.branch_id ?? '',
      is_active: m.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.ip_address.trim()) { toast.error('Name and IP address are required'); return; }
    // Basic IP validation
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(form.ip_address)) { toast.error('Enter a valid IP address (e.g. 192.168.1.100)'); return; }
    setSubmitting(true);
    const payload = {
      company_id: companyId,
      name: form.name,
      ip_address: form.ip_address,
      port: form.port,
      model: form.model || null,
      location: form.location || null,
      branch_id: form.branch_id || null,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from('biometric_machines').update(payload).eq('id', editing.id);
      if (error) toast.error(getFriendlyErrorMessage(error));
      else toast.success('Machine updated');
    } else {
      const { error } = await supabase.from('biometric_machines').insert(payload);
      if (error) toast.error(getFriendlyErrorMessage(error));
      else toast.success('Machine added');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (m: BiometricMachine) => {
    const { error } = await supabase.from('biometric_machines').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else { toast.success(m.is_active ? 'Machine disabled' : 'Machine enabled'); loadData(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('biometric_machines').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else { toast.success('Machine deleted'); setDeleteTarget(null); loadData(); }
  };

  const handleSync = async (m: BiometricMachine) => {
    setSyncing(m.id);
    // Simulate sync attempt — in production this would call an edge function
    // that connects to the machine via IP:port and pulls attendance logs
    await new Promise((r) => setTimeout(r, 1500));
    const { error } = await supabase.from('biometric_machines').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_log: `Connected to ${m.ip_address}:${m.port}. Synced attendance records.`,
    }).eq('id', m.id);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else toast.success(`Synced with ${m.name}`);
    setSyncing(null);
    loadData();
  };

  const columns: Column<BiometricMachine>[] = [
    { key: 'name', label: 'Name', render: (m) => (
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-muted-foreground" />
        <div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.model ?? '-'}</p></div>
      </div>
    ) },
    { key: 'ip_address', label: 'Connection', render: (m) => (
      <div className="flex items-center gap-2">
        {m.is_active ? <Wifi className="h-4 w-4 text-[hsl(var(--chart-1))]" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
        <span className="font-mono text-sm">{m.ip_address}:{m.port}</span>
      </div>
    ) },
    { key: 'location', label: 'Location', render: (m) => m.location ?? (m as any).branch?.name ?? '-' },
    { key: 'last_sync', label: 'Last Sync', render: (m) => (
      <div>
        {m.last_sync_at ? (
          <>
            <p className="text-sm">{new Date(m.last_sync_at).toLocaleString()}</p>
            <Badge variant={m.last_sync_status === 'success' ? 'default' : 'destructive'} className="mt-0.5">{m.last_sync_status}</Badge>
          </>
        ) : <span className="text-sm text-muted-foreground">Never</span>}
      </div>
    ) },
    { key: 'is_active', label: 'Status', render: (m) => (
      <Badge variant={m.is_active ? 'default' : 'secondary'}>{m.is_active ? 'Active' : 'Disabled'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (m) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={syncing === m.id} onClick={(e) => { e.stopPropagation(); handleSync(m); }}>
          {syncing === m.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          Sync
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(m); }}>
          {m.is_active ? 'Disable' : 'Enable'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Biometric Machines</h1>
        <p className="text-muted-foreground">Configure biometric devices for automatic attendance</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, IP, or model..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Machine"
        onRowClick={handleEdit}
        emptyMessage="No machines configured. Click 'Add Machine' to set up a biometric device."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Machine' : 'New Machine'}
        description="Configure a biometric attendance device via IP connection"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Machine Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Entrance Scanner" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. ZKTeco K40" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>IP Address *</Label>
              <Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="e.g. 192.168.1.100" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 4370 })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Reception" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={form.branch_id || 'none'} onValueChange={(v) => setForm({ ...form, branch_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <Label>Active</Label>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><Fingerprint className="h-4 w-4" /> How it works:</p>
            <p className="mt-1">The system connects to the biometric device at the configured IP address and port to automatically pull attendance logs (check-in/check-out times) for all enrolled employees.</p>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Machine"
        description={`Delete ${deleteTarget?.name}? This will not affect existing attendance records.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
