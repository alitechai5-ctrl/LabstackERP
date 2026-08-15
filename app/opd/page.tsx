'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import type { Appointment, Patient, Doctor, Department } from '@/lib/types';

type OPDVisit = Appointment & {
  patient?: Patient;
  doctor?: Doctor;
  department?: Department;
};

export default function OPDPage() {
  const { appUser } = useAuth();
  const [visits, setVisits] = useState<OPDVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('appointments')
        .select('*, patient:patients(*), doctor:doctors(*), department:departments(*)')
        .order('appointment_date', { ascending: false })
        .limit(50);
      setVisits((data as OPDVisit[]) || []);
      setLoading(false);
    })();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter((v) => v.appointment_date === today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OPD — Outpatient Department</h1>
          <p className="text-sm text-muted-foreground">Manage outpatient visits and consultations</p>
        </div>
        <Link href="/reception/appointments">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New OPD Visit
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayVisits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayVisits.filter((v) => v.status === 'scheduled').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checked In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayVisits.filter((v) => v.status === 'checked_in').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayVisits.filter((v) => v.status === 'completed').length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent OPD Visits</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Stethoscope className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No OPD visits yet</p>
              <Link href="/reception/appointments">
                <Button variant="outline" className="mt-3">
                  <Search className="mr-2 h-4 w-4" />
                  Schedule a visit
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Patient</th>
                    <th className="pb-2 pr-4 font-medium">Doctor</th>
                    <th className="pb-2 pr-4 font-medium">Department</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 pr-4">{v.appointment_date}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/patients/${v.patient_id}`} className="text-primary hover:underline">
                          {v.patient?.full_name || 'Unknown'}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{v.doctor?.full_name || '-'}</td>
                      <td className="py-2 pr-4">{v.department?.name || '-'}</td>
                      <td className="py-2 pr-4 capitalize">{v.type?.replace('_', ' ') || '-'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={v.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                          {v.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
