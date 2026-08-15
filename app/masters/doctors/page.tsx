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
import { CalendarClock, Wallet } from 'lucide-react';
import type { Doctor, Department, Branch } from '@/lib/types';

const emptyDoctor: Omit<Doctor, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  branch_id: null,
  department_id: null,
  doctor_code: '',
  photo_url: null,
  full_name: '',
  specialization: '',
  qualification: '',
  pmc_license: '',
  phone: '',
  email: '',
  address: '',
  consultation_fee: 0,
  opd_share_type: 'percentage',
  opd_share: 0,
  lab_share_type: 'percentage',
  lab_share: 0,
  radiology_share_type: 'percentage',
  radiology_share: 0,
  procedure_share_type: 'percentage',
  procedure_share: 0,
  monthly_settlement: false,
  is_active: true,
};

export default function DoctorsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<typeof emptyDoctor>(emptyDoctor);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: docs }, { data: depts }, { data: brs }] = await Promise.all([
      supabase.from('doctors').select('*, department:departments(*), branch:branches(*)').eq('company_id', companyId).order('full_name'),
      supabase.from('departments').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
      supabase.from('branches').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
    ]);
    setDoctors((docs as Doctor[]) || []);
    setDepartments(depts || []);
    setBranches(brs || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.full_name.toLowerCase().includes(q) ||
      d.doctor_code.toLowerCase().includes(q) ||
      d.specialization?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm({ ...emptyDoctor, branch_id: appUser?.branch_id ?? null });
    setDialogOpen(true);
  };

  const handleEdit = (doc: Doctor) => {
    setEditing(doc);
    const { id, company_id, created_at, updated_at, ...rest } = doc;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.doctor_code.trim() || !companyId) {
      toast.error('Name and Doctor Code are required');
      return;
    }
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from('doctors').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Doctor updated successfully');
    } else {
      const { error } = await supabase.from('doctors').insert({ ...form, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Doctor created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (doc: Doctor) => {
    const { error } = await supabase.from('doctors').update({ is_active: !doc.is_active }).eq('id', doc.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success(doc.is_active ? 'Doctor deactivated' : 'Doctor activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('doctors').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Doctor deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<Doctor>[] = [
    { key: 'doctor_code', label: 'Code', render: (d) => <span className="font-mono text-sm">{d.doctor_code}</span> },
    { key: 'full_name', label: 'Name', render: (d) => (
      <div>
        <p className="font-medium">{d.full_name}</p>
        <p className="text-sm text-muted-foreground">{d.specialization}</p>
      </div>
    ) },
    { key: 'department', label: 'Department', render: (d) => d.department?.name ?? '-' },
    { key: 'phone', label: 'Phone' },
    { key: 'consultation_fee', label: 'Consult Fee', render: (d) => d.consultation_fee.toLocaleString() },
    { key: 'shares', label: 'Shares', render: (d) => (
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">OPD {d.opd_share}{d.opd_share_type === 'percentage' ? '%' : ''}</Badge>
        <Badge variant="outline">Lab {d.lab_share}{d.lab_share_type === 'percentage' ? '%' : ''}</Badge>
      </div>
    ) },
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctors</h1>
          <p className="text-muted-foreground">Manage doctor master records with share calculations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/masters/doctors/schedules"><Button variant="outline" size="sm"><CalendarClock className="mr-2 h-4 w-4" /> Schedules</Button></Link>
          <Link href="/masters/doctors/settlements"><Button variant="outline" size="sm"><Wallet className="mr-2 h-4 w-4" /> Settlements</Button></Link>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, code, phone..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Doctor"
        onRowClick={handleEdit}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Doctor' : 'New Doctor'}
        description="Enter doctor details including share percentages"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Doctor Code *</Label>
              <Input value={form.doctor_code} onChange={(e) => setForm({ ...form, doctor_code: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input value={form.specialization ?? ''} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Qualification</Label>
              <Input value={form.qualification ?? ''} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PMC License</Label>
              <Input value={form.pmc_license ?? ''} onChange={(e) => setForm({ ...form, pmc_license: e.target.value })} />
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
              <Label>Consultation Fee</Label>
              <Input type="number" value={form.consultation_fee} onChange={(e) => setForm({ ...form, consultation_fee: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="rounded-md bg-muted p-4">
            <p className="mb-3 text-sm font-medium">Share Configuration</p>
            {(['opd', 'lab', 'radiology', 'procedure'] as const).map((field) => (
              <div key={field} className="mb-3 grid grid-cols-3 items-center gap-2">
                <Label className="capitalize">{field} Share</Label>
                <Select
                  value={form[`${field}_share_type` as keyof typeof form] as string}
                  onValueChange={(v) => setForm({ ...form, [`${field}_share_type`]: v } as any)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage %</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={form[`${field}_share` as keyof typeof form] as number}
                  onChange={(e) => setForm({ ...form, [`${field}_share`]: parseFloat(e.target.value) || 0 } as any)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.monthly_settlement} onCheckedChange={(c) => setForm({ ...form, monthly_settlement: c })} />
            <Label>Monthly Settlement</Label>
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
        title="Delete Doctor"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
