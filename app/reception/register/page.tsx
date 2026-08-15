'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function ReceptionRegisterPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '', gender: 'male', phone: '', cnic: '', age: '', date_of_birth: '',
    address: '', city: '', email: '', blood_group: '',
  });

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { toast.error('Patient name is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone number is required'); return; }
    setSubmitting(true);

    // Generate patient code
    const prefix = 'PT';
    const { count } = await supabase.from('patients').select('id', { count: 'exact', head: true });
    const patientCode = `${prefix}${String((count || 0) + 1).padStart(5, '0')}`;

    const { data, error } = await supabase.from('patients').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      patient_code: patientCode,
      full_name: form.full_name,
      gender: form.gender,
      phone: form.phone || null,
      cnic: form.cnic || null,
      age: form.age ? parseInt(form.age) : null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      city: form.city || null,
      email: form.email || null,
      blood_group: form.blood_group || null,
    }).select().single();

    if (error) { toast.error('Failed: ' + error.message); setSubmitting(false); return; }
    toast.success(`Patient registered: ${patientCode}`);
    setSubmitting(false);
    router.push(`/reception/billing?patient=${data.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">Quick Patient Registration</h1><p className="text-muted-foreground">Register a new patient and proceed to billing</p></div>
      </div>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Patient Details</CardTitle><CardDescription>Fill in the patient information</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Enter patient name" /></div>
            <div className="space-y-2"><Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Age</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Age" /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile number" /></div>
            <div className="space-y-2"><Label>CNIC</Label><Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" /></div>
            <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div className="space-y-2"><Label>Blood Group</Label>
              <Select value={form.blood_group} onValueChange={(v) => setForm({ ...form, blood_group: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></div>
            <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...</> : <><UserPlus className="mr-2 h-4 w-4" /> Register & Bill</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
