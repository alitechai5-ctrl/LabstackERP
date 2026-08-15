'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Loader2, Plus, CheckCircle2, XCircle, Clock, Footprints, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import type { Doctor, Patient } from '@/lib/types';

type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: string;
  type: string;
  reason: string | null;
  notes: string | null;
  patient?: { full_name: string; patient_code: string; phone: string | null };
  doctor?: { full_name: string; specialization: string | null } | null;
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  scheduled: { label: 'Scheduled', variant: 'secondary', icon: Clock },
  checked_in: { label: 'Checked In', variant: 'default', icon: CheckCircle2 },
  completed: { label: 'Completed', variant: 'default', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
  no_show: { label: 'No Show', variant: 'destructive', icon: XCircle },
  walk_in: { label: 'Walk In', variant: 'outline', icon: Footprints },
};

export default function ReceptionAppointmentsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', date: '', time: '', type: 'new', reason: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, pRes] = await Promise.all([
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
      supabase.from('patients').select('*').order('full_name').limit(200),
    ]);
    setDoctors((dRes.data as Doctor[]) || []);
    setPatients((pRes.data as Patient[]) || []);

    let q = supabase
      .from('appointments')
      .select('*, patient:patients(full_name, patient_code, phone), doctor:doctors(full_name, specialization)')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(100);

    if (filterDate) q = q.eq('appointment_date', filterDate);
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);

    const { data, error } = await q;
    if (error) { toast.error('Failed to load appointments'); }
    setAppointments((data as Appointment[]) || []);
    setLoading(false);
  }, [supabase, filterDate, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleBook = async () => {
    if (!form.patient_id || !form.date) { toast.error('Patient and date are required'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('appointments').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      appointment_date: form.date,
      appointment_time: form.time || null,
      status: form.type === 'walk_in' ? 'walk_in' : 'scheduled',
      type: form.type,
      reason: form.reason || null,
      notes: form.notes || null,
      created_by: appUser?.id,
    });
    if (error) { toast.error('Failed to book: ' + error.message); setSubmitting(false); return; }
    toast.success('Appointment scheduled');
    setForm({ patient_id: '', doctor_id: '', date: '', time: '', type: 'new', reason: '', notes: '' });
    setShowForm(false);
    setSubmitting(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update status'); return; }
    toast.success('Status updated');
    load();
  };

  const deleteAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Appointment deleted');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Schedule and manage patient appointments</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New Appointment
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Book Appointment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Patient *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Doctor</Label>
                <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Any doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}{d.specialization ? ` · ${d.specialization}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Visit</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for visit" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleBook} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking...</> : <><CalendarClock className="mr-2 h-4 w-4" /> Book</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="sm:w-48" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
            <SelectItem value="walk_in">Walk-in</SelectItem>
          </SelectContent>
        </Select>
        {(filterDate || filterStatus !== 'all') && (
          <Button variant="ghost" onClick={() => { setFilterDate(''); setFilterStatus('all'); }}>Clear</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointments ({appointments.length})</CardTitle>
          <CardDescription>Manage upcoming and past appointments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : appointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No appointments found</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => {
                const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
                return (
                  <div key={apt.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2"><CalendarClock className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm">{apt.patient?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="data-mono">{apt.patient?.patient_code}</span> · {apt.appointment_date}{apt.appointment_time ? ` at ${apt.appointment_time}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.doctor?.full_name ?? 'Any doctor'}{apt.reason ? ` · ${apt.reason}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {apt.type === 'follow_up' && <Badge variant="outline"><RotateCcw className="mr-1 h-3 w-3" />Follow-up</Badge>}
                      <Select value={apt.status} onValueChange={(v) => updateStatus(apt.id, v)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="checked_in">Checked In</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                          <SelectItem value="walk_in">Walk-in</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => deleteAppointment(apt.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
