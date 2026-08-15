'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Patient } from '@/lib/types';

const emptyPatient: Omit<Patient, 'id' | 'created_at' | 'updated_at'> = {
  company_id: '',
  branch_id: null,
  patient_code: '',
  full_name: '',
  gender: 'male',
  date_of_birth: null,
  age: null,
  phone: null,
  email: null,
  address: null,
  city: null,
  cnic: null,
  blood_group: null,
  is_active: true,
};

export default function PatientsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<typeof emptyPatient>(emptyPatient);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load patients: ' + error.message);
    } else {
      setPatients((data as Patient[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.patient_code.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.cnic?.toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyPatient);
    setDialogOpen(true);
  };

  const handleEdit = (p: Patient) => {
    setEditing(p);
    const { id, created_at, updated_at, ...rest } = p;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast.error('Patient name is required');
      return;
    }
    setSubmitting(true);

    if (editing) {
      const { error } = await supabase.from('patients').update(form).eq('id', editing.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Patient updated successfully');
    } else {
      const code = `PT-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from('patients').insert({
        ...form,
        company_id: appUser?.company_id,
        branch_id: appUser?.branch_id,
        patient_code: code,
      });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success(`Patient registered: ${code}`);
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('patients').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success('Patient deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const columns: Column<Patient>[] = [
    { key: 'patient_code', label: 'MRN', render: (p) => <span className="font-mono text-sm">{p.patient_code}</span> },
    { key: 'full_name', label: 'Name', render: (p) => (
      <div>
        <p className="font-medium">{p.full_name}</p>
        <p className="text-sm text-muted-foreground">{p.gender}, {p.age ?? '-'} yrs</p>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (p) => p.phone ?? '-' },
    { key: 'cnic', label: 'CNIC', render: (p) => p.cnic ?? '-' },
    { key: 'city', label: 'City', render: (p) => p.city ?? '-' },
    { key: 'is_active', label: 'Status', render: (p) => (
      <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (p) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(p); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/patients/${p.id}`); }}>View</Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-muted-foreground">Manage patient registrations and records</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, MRN, phone, CNIC..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Register Patient"
        onRowClick={(p) => router.push(`/patients/${p.id}`)}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Patient' : 'New Patient Registration'}
        description="Enter patient demographic details"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth ?? ''} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={form.age ?? ''} onChange={(e) => setForm({ ...form, age: e.target.value ? parseInt(e.target.value) : null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>CNIC</Label>
              <Input value={form.cnic ?? ''} onChange={(e) => setForm({ ...form, cnic: e.target.value || null })} placeholder="XXXXX-XXXXXXX-X" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={form.blood_group ?? ''} onValueChange={(v) => setForm({ ...form, blood_group: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value || null })} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value || null })} />
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Patient"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? This will also delete all lab orders for this patient.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
