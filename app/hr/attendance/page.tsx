'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CalendarClock, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Attendance, Employee } from '@/lib/types';

type AttendanceWithEmp = Attendance & { employee?: Employee };

const STATUSES = ['present', 'absent', 'late', 'half_day', 'leave', 'holiday'];

export default function AttendancePage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [records, setRecords] = useState<AttendanceWithEmp[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; check_in: string; check_out: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, eRes] = await Promise.all([
      supabase.from('attendance').select('*, employee:employees(*)').eq('date', selectedDate).order('created_at'),
      supabase.from('employees').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (aRes.error) toast.error(aRes.error.message);
    setRecords((aRes.data as any) || []);
    setEmployees((eRes.data as Employee[]) || []);
    const map: Record<string, { status: string; check_in: string; check_out: string }> = {};
    for (const emp of (eRes.data as Employee[]) || []) {
      const rec = (aRes.data as any)?.find((a: any) => a.employee_id === emp.id);
      map[emp.id] = {
        status: rec?.status || 'present',
        check_in: rec?.check_in || '09:00',
        check_out: rec?.check_out || '17:00',
      };
    }
    setAttendanceMap(map);
    setLoading(false);
  }, [supabase, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const inserts = employees.map((emp) => {
      const a = attendanceMap[emp.id] || { status: 'present', check_in: '09:00', check_out: '17:00' };
      return {
        company_id: appUser?.company_id,
        branch_id: appUser?.branch_id,
        employee_id: emp.id,
        date: selectedDate,
        check_in: a.check_in || null,
        check_out: a.check_out || null,
        status: a.status,
      };
    });

    const existingByEmp: Record<string, Attendance> = {};
    for (const r of records) { existingByEmp[r.employee_id] = r; }

    let saved = 0;
    for (const ins of inserts) {
      const existing = existingByEmp[ins.employee_id];
      if (existing) {
        const { error } = await supabase.from('attendance').update({
          check_in: ins.check_in, check_out: ins.check_out, status: ins.status,
        }).eq('id', existing.id);
        if (!error) saved++;
      } else {
        const { error } = await supabase.from('attendance').insert(ins);
        if (!error) saved++;
      }
    }

    toast.success(`Attendance saved for ${saved} employees`);
    setSaving(false);
    load();
  };

  const updateEntry = (empId: string, patch: Partial<{ status: string; check_in: string; check_out: string }>) => {
    setAttendanceMap((prev) => ({ ...prev, [empId]: { ...prev[empId], ...patch } }));
  };

  const presentCount = Object.values(attendanceMap).filter((a) => a.status === 'present').length;
  const absentCount = Object.values(attendanceMap).filter((a) => a.status === 'absent').length;
  const lateCount = Object.values(attendanceMap).filter((a) => a.status === 'late').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track daily employee attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" />
          <Button onClick={handleSave} disabled={saving || employees.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Save Attendance
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-2.5"><Check className="h-5 w-5 text-[hsl(var(--chart-1))]" /></div>
          <div><p className="text-sm text-muted-foreground">Present</p><p className="text-xl font-bold">{presentCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-destructive/10 p-2.5"><X className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-sm text-muted-foreground">Absent</p><p className="text-xl font-bold">{absentCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-2.5"><Clock className="h-5 w-5 text-[hsl(var(--chart-2))]" /></div>
          <div><p className="text-sm text-muted-foreground">Late</p><p className="text-xl font-bold">{lateCount}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Daily Attendance</CardTitle>
          <CardDescription>{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : employees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No active employees</TableCell></TableRow>
              ) : (
                employees.map((emp) => {
                  const a = attendanceMap[emp.id] || { status: 'present', check_in: '09:00', check_out: '17:00' };
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{emp.employee_code ?? '-'}</TableCell>
                      <TableCell>
                        <Input type="time" value={a.check_in} onChange={(e) => updateEntry(emp.id, { check_in: e.target.value })} className="w-32" />
                      </TableCell>
                      <TableCell>
                        <Input type="time" value={a.check_out} onChange={(e) => updateEntry(emp.id, { check_out: e.target.value })} className="w-32" />
                      </TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateEntry(emp.id, { status: v })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
