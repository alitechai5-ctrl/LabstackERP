'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { Doctor, DoctorSchedule } from '@/lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DayForm = { start_time: string; end_time: string; is_available: boolean; room: string };

const DEFAULT_FORM: DayForm = { start_time: '09:00', end_time: '17:00', is_available: true, room: '' };

export default function DoctorSchedulesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<Record<number, DayForm>>({});

  const loadDoctors = useCallback(async () => {
    const { data } = await supabase.from('doctors').select('*').eq('is_active', true).order('full_name');
    const dlist = (data as Doctor[]) || [];
    setDoctors(dlist);
    if (dlist.length > 0 && !selectedDoctor) setSelectedDoctor(dlist[0].id);
  }, [supabase, selectedDoctor]);

  const loadSchedules = useCallback(async () => {
    if (!selectedDoctor) return;
    setLoading(true);
    const { data } = await supabase.from('doctor_schedules').select('*').eq('doctor_id', selectedDoctor);
    const slist = (data as DoctorSchedule[]) || [];
    setSchedules(slist);
    const newForms: Record<number, DayForm> = {};
    for (let i = 0; i < 7; i++) {
      const s = slist.find(x => x.day_of_week === i);
      newForms[i] = s
        ? { start_time: s.start_time, end_time: s.end_time, is_available: s.is_available, room: s.room || '' }
        : { ...DEFAULT_FORM };
    }
    setForms(newForms);
    setLoading(false);
  }, [supabase, selectedDoctor]);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);
  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const handleSave = async (day: number) => {
    const form = forms[day];
    if (!form) return;
    setSaving(true);
    const existing = schedules.find(s => s.day_of_week === day);
    if (existing) {
      const { error } = await supabase.from('doctor_schedules').update({
        start_time: form.start_time, end_time: form.end_time, is_available: form.is_available, room: form.room || null,
      }).eq('id', existing.id);
      if (error) toast.error(error.message); else toast.success(`${DAYS[day]} schedule updated`);
    } else {
      const { error } = await supabase.from('doctor_schedules').insert({
        company_id: appUser?.company_id,
        doctor_id: selectedDoctor,
        branch_id: appUser?.branch_id,
        day_of_week: day,
        start_time: form.start_time || '09:00',
        end_time: form.end_time || '17:00',
        is_available: form.is_available,
        room: form.room || null,
      });
      if (error) toast.error(error.message); else toast.success(`${DAYS[day]} schedule created`);
    }
    setSaving(false);
    loadSchedules();
  };

  const updateForm = (day: number, patch: Partial<DayForm>) => {
    setForms(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Doctor Schedules</h1>
        <p className="text-muted-foreground">Manage weekly availability for each doctor</p>
      </div>

      <div className="space-y-2 max-w-md">
        <Label>Select Doctor</Label>
        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
          <SelectTrigger><SelectValue placeholder="Choose a doctor" /></SelectTrigger>
          <SelectContent>
            {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name} {d.specialization ? `· ${d.specialization}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((day, idx) => {
            const form = forms[idx] || { ...DEFAULT_FORM };
            return (
              <Card key={day}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{day}</CardTitle>
                    <Switch
                      checked={form.is_available}
                      onCheckedChange={(v) => updateForm(idx, { is_available: v })}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start</Label>
                      <Input type="time" value={form.start_time} onChange={(e) => updateForm(idx, { start_time: e.target.value })} disabled={!form.is_available} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End</Label>
                      <Input type="time" value={form.end_time} onChange={(e) => updateForm(idx, { end_time: e.target.value })} disabled={!form.is_available} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Room</Label>
                    <Input value={form.room} onChange={(e) => updateForm(idx, { room: e.target.value })} placeholder="Room number" disabled={!form.is_available} />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => handleSave(idx)} disabled={saving}>
                    <Save className="mr-2 h-3 w-3" /> Save
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
