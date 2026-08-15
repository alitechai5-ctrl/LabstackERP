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
import type { Department, Branch } from '@/lib/types';

type DepartmentWithBranch = Department & { branch?: Branch | null };

const emptyDepartment: Omit<Department, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  branch_id: '',
  name: '',
  code: '',
  type: 'lab',
  description: null,
  is_active: true,
};

const DEPARTMENT_TYPES: { value: string; label: string }[] = [
  { value: 'lab', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'opd', label: 'OPD' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'admin', label: 'Administration' },
  { value: 'clinical', label: 'Clinical' },
];

export default function DepartmentsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [departments, setDepartments] = useState<DepartmentWithBranch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentWithBranch | null>(null);
  const [form, setForm] = useState<typeof emptyDepartment>(emptyDepartment);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentWithBranch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: depts, error: deptError }, { data: brs, error: branchError }] = await Promise.all([
      supabase.from('departments').select('*, branch:branches(*)').eq('company_id', companyId).order('name'),
      supabase.from('branches').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
    ]);
    if (deptError) toast.error('Failed to load departments: ' + deptError.message);
    if (branchError) toast.error('Failed to load branches: ' + branchError.message);
    setDepartments((depts as DepartmentWithBranch[]) || []);
    setBranches(brs || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = departments.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.branch?.name?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm({ ...emptyDepartment, branch_id: appUser?.branch_id ?? '' });
    setDialogOpen(true);
  };

  const handleEdit = (d: Department) => {
    setEditing(d);
    const { id, company_id, created_at, updated_at, ...rest } = d;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.branch_id || !companyId) {
      toast.error('Name, Code and Branch are required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from('departments').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Department updated successfully');
    } else {
      const { error } = await supabase.from('departments').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Department created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (d: Department) => {
    const { error } = await supabase.from('departments').update({ is_active: !d.is_active }).eq('id', d.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(d.is_active ? 'Department deactivated' : 'Department activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('departments').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Department deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<DepartmentWithBranch>[] = [
    { key: 'code', label: 'Code', render: (d) => <span className="font-mono text-sm">{d.code}</span> },
    { key: 'name', label: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
    { key: 'type', label: 'Type', render: (d) => {
      const label = DEPARTMENT_TYPES.find((t) => t.value === d.type)?.label ?? d.type;
      return <Badge variant="outline">{label}</Badge>;
    } },
    { key: 'branch', label: 'Branch', render: (d) => d.branch?.name ?? '-' },
    { key: 'description', label: 'Description', render: (d) => d.description ?? '-' },
    { key: 'is_active', label: 'Status', render: (d) => (
      <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (d) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(d); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(d); }}>
          {d.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Departments</h1>
        <p className="text-muted-foreground">Manage departments across branches with type classification</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, code, type..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Department"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Department' : 'New Department'}
        description="Enter department details and assign to a branch"
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
              <Label>Branch *</Label>
              <Select value={form.branch_id || 'none'} onValueChange={(v) => setForm({ ...form, branch_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select branch</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        title="Delete Department"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
