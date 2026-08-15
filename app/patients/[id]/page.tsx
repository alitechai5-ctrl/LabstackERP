'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, FileText, Printer, Pencil, Save, X, FlaskConical, Scan, Pill, Wallet, CalendarClock, Activity } from 'lucide-react';
import { toast } from 'sonner';
import type { Patient, LabOrder, LabOrderItem } from '@/lib/types';

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  status: string;
  type: string;
  reason: string | null;
  doctor?: { full_name: string } | null;
};

type PharmacySale = {
  id: string;
  sale_code: string;
  total_amount: number;
  paid_amount: number;
  payment_status: string;
  created_at: string;
};

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const supabase = getSupabaseClient();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pharmacySales, setPharmacySales] = useState<PharmacySale[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, LabOrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Patient | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
    if (p) { setPatient(p as Patient); setEditForm(p as Patient); }

    const { data: ord } = await supabase
      .from('lab_orders')
      .select('*, patient:patients(*)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setOrders((ord as LabOrder[]) || []);

    if (ord && ord.length > 0) {
      const orderIds = ord.map((o) => o.id);
      const { data: items } = await supabase
        .from('lab_order_items')
        .select('*')
        .in('lab_order_id', orderIds);
      const grouped: Record<string, LabOrderItem[]> = {};
      (items as LabOrderItem[] | null)?.forEach((item) => {
        if (!grouped[item.lab_order_id]) grouped[item.lab_order_id] = [];
        grouped[item.lab_order_id].push(item);
      });
      setOrderItems(grouped);
    }

    const { data: apts } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(full_name)')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false })
      .limit(20);
    setAppointments((apts as Appointment[]) || []);

    const { data: sales } = await supabase
      .from('pharmacy_sales')
      .select('id, sale_code, total_amount, paid_amount, payment_status, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(20);
    setPharmacySales((sales as PharmacySale[]) || []);

    setLoading(false);
  }, [supabase, patientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSavingEdit(true);
    const { error } = await supabase.from('patients').update({
      full_name: editForm.full_name,
      gender: editForm.gender,
      phone: editForm.phone,
      email: editForm.email,
      address: editForm.address,
      city: editForm.city,
      cnic: editForm.cnic,
      blood_group: editForm.blood_group,
      age: editForm.age,
      date_of_birth: editForm.date_of_birth,
      updated_at: new Date().toISOString(),
    }).eq('id', patientId);
    if (error) { toast.error('Failed to save: ' + error.message); setSavingEdit(false); return; }
    toast.success('Patient updated');
    setPatient(editForm);
    setEditing(false);
    setSavingEdit(false);
  };

  const statusColors: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
    pending: 'secondary', sample_collected: 'default', processing: 'default',
    result_entered: 'default', verified: 'default', approved: 'default', printed: 'default',
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (!patient) {
    return <div className="p-8 text-center text-muted-foreground">Patient not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/reception/search')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{patient.full_name}</h1>
          <p className="text-muted-foreground"><span className="data-mono">{patient.patient_code}</span> | {patient.gender}, {patient.age ?? '-'} yrs | {patient.phone ?? '-'}</p>
        </div>
        <Button onClick={() => router.push(`/reception/billing?patient=${patientId}`)}>
          <Plus className="mr-2 h-4 w-4" /> New Invoice
        </Button>
      </div>

      {/* Patient Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Patient Information</CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                <Save className="mr-1 h-4 w-4" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditForm(patient); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing && editForm ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Age</Label><Input type="number" value={editForm.age ?? ''} onChange={(e) => setEditForm({ ...editForm, age: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone ?? ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>CNIC</Label><Input value={editForm.cnic ?? ''} onChange={(e) => setEditForm({ ...editForm, cnic: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editForm.date_of_birth ?? ''} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} /></div>
              <div className="space-y-2"><Label>Blood Group</Label>
                <Select value={editForm.blood_group ?? ''} onValueChange={(v) => setEditForm({ ...editForm, blood_group: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>City</Label><Input value={editForm.city ?? ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={editForm.email ?? ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-3"><Label>Address</Label><Input value={editForm.address ?? ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><p className="text-sm text-muted-foreground">CNIC</p><p className="font-medium">{patient.cnic ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">Blood Group</p><p className="font-medium">{patient.blood_group ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">Date of Birth</p><p className="font-medium">{patient.date_of_birth ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">City</p><p className="font-medium">{patient.city ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{patient.email ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">Address</p><p className="font-medium">{patient.address ?? '-'}</p></div>
              <div><p className="text-sm text-muted-foreground">Registered</p><p className="font-medium">{new Date(patient.created_at).toLocaleDateString()}</p></div>
              <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={patient.is_active ? 'default' : 'destructive'}>{patient.is_active ? 'Active' : 'Inactive'}</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="orders">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="orders" className="gap-1"><FlaskConical className="h-4 w-4" /> Lab Orders</TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1"><CalendarClock className="h-4 w-4" /> Appointments</TabsTrigger>
          <TabsTrigger value="pharmacy" className="gap-1"><Pill className="h-4 w-4" /> Pharmacy</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><Wallet className="h-4 w-4" /> Payments</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><Activity className="h-4 w-4" /> Activity</TabsTrigger>
        </TabsList>

        {/* Lab Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Lab & Radiology Orders ({orders.length})</CardTitle></CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders yet</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.order_code}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()} | Total: Rs {Number(order.total_amount).toLocaleString()} | Net: Rs {Number(order.net_amount).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                            {order.payment_status}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/lab/reports/${order.id}`)}>
                            <Printer className="mr-1 h-3 w-3" /> Report
                          </Button>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Test</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {(orderItems[order.id] || []).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.service_name}</TableCell>
                              <TableCell>Rs {Number(item.price).toLocaleString()}</TableCell>
                              <TableCell><Badge variant={statusColors[item.status] || 'secondary'}>{item.status.replace('_', ' ')}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Appointments ({appointments.length})</CardTitle></CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No appointments yet</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2"><CalendarClock className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="font-medium text-sm">{apt.appointment_date}{apt.appointment_time ? ` at ${apt.appointment_time}` : ''}</p>
                          <p className="text-xs text-muted-foreground">{apt.doctor?.full_name ?? 'Any doctor'}{apt.reason ? ` · ${apt.reason}` : ''}</p>
                        </div>
                      </div>
                      <Badge variant={apt.status === 'completed' ? 'default' : apt.status === 'cancelled' || apt.status === 'no_show' ? 'destructive' : 'secondary'}>
                        {apt.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pharmacy Tab */}
        <TabsContent value="pharmacy" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Pharmacy Sales ({pharmacySales.length})</CardTitle></CardHeader>
            <CardContent>
              {pharmacySales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pharmacy sales yet</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pharmacySales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium data-mono">{sale.sale_code}</TableCell>
                        <TableCell>{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>Rs {Number(sale.total_amount).toLocaleString()}</TableCell>
                        <TableCell>Rs {Number(sale.paid_amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={sale.payment_status === 'paid' ? 'default' : 'destructive'}>{sale.payment_status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Payment Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const totalBilled = orders.reduce((s, o) => s + Number(o.net_amount), 0);
                const totalPaid = orders.reduce((s, o) => s + Number(o.paid_amount), 0);
                const balance = totalBilled - totalPaid;
                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total Billed</p><p className="text-2xl font-bold">Rs {totalBilled.toLocaleString()}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-2xl font-bold text-[hsl(var(--chart-1))]">Rs {totalPaid.toLocaleString()}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-destructive">Rs {balance.toLocaleString()}</p></div>
                  </div>
                );
              })()}
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium">Invoice-wise Breakdown</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Net</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.order_code}</TableCell>
                        <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>Rs {Number(o.net_amount).toLocaleString()}</TableCell>
                        <TableCell>Rs {Number(o.paid_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-destructive">Rs {(Number(o.net_amount) - Number(o.paid_amount)).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={o.payment_status === 'paid' ? 'default' : o.payment_status === 'partial' ? 'secondary' : 'destructive'}>{o.payment_status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Patient Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const events: { date: string; title: string; desc: string; icon: any }[] = [];
                orders.forEach(o => events.push({ date: o.created_at, title: `Order ${o.order_code}`, desc: `Rs ${Number(o.net_amount).toLocaleString()} · ${o.payment_status}`, icon: FlaskConical }));
                appointments.forEach(a => events.push({ date: a.appointment_date, title: 'Appointment', desc: `${a.doctor?.full_name ?? 'Any doctor'} · ${a.status}`, icon: CalendarClock }));
                pharmacySales.forEach(s => events.push({ date: s.created_at, title: `Pharmacy ${s.sale_code}`, desc: `Rs ${Number(s.total_amount).toLocaleString()}`, icon: Pill }));
                events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (events.length === 0) return <p className="text-center text-muted-foreground py-8">No activity yet</p>;
                return (
                  <div className="space-y-2">
                    {events.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="rounded-lg bg-primary/10 p-2"><e.icon className="h-4 w-4 text-primary" /></div>
                        <div className="flex-1"><p className="font-medium text-sm">{e.title}</p><p className="text-xs text-muted-foreground">{e.desc}</p></div>
                        <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
