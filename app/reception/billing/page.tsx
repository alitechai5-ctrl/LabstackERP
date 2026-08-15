'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, FileText, User, Stethoscope, FileCheck, Wallet, Printer, Check, Search, Receipt, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import type { Patient, Doctor, ReferralSource, Service, CorporateClient, PanelRate } from '@/lib/types';
import { computeDoctorShare, computeReferralShare, netPricePerService } from '@/lib/utils/shares';

type ShareRule = {
  id: string;
  share_for: string;
  doctor_id: string | null;
  service_id: string | null;
  service_category: string | null;
  share_type: string;
  share_value: number;
  priority: number;
};

export default function ReceptionBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectPatient = searchParams.get('patient');
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();

  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [referrals, setReferrals] = useState<ReferralSource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [shareRules, setShareRules] = useState<ShareRule[]>([]);
  const [panelRates, setPanelRates] = useState<Record<string, number>>({});
  const [selectedCorporate, setSelectedCorporate] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedReferral, setSelectedReferral] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<'rs' | 'percent'>('rs');
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'card'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [invoiceFormat, setInvoiceFormat] = useState<'a5' | 'thermal'>('a5');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [pRes, dRes, rRes, sRes, cRes, srRes] = await Promise.all([
      supabase.from('patients').select('*').order('full_name'),
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
      supabase.from('referral_sources').select('*').eq('is_active', true).order('name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('corporate_clients').select('*').eq('is_active', true).order('name'),
      supabase.from('share_rules').select('*').eq('is_active', true).order('priority', { ascending: false }),
    ]);
    setPatients((pRes.data as Patient[]) || []);
    setDoctors((dRes.data as Doctor[]) || []);
    setReferrals((rRes.data as ReferralSource[]) || []);
    setServices((sRes.data as Service[]) || []);
    setCorporates((cRes.data as CorporateClient[]) || []);
    setShareRules((srRes.data as ShareRule[]) || []);
    if (preselectPatient) setSelectedPatient(preselectPatient);
  }, [supabase, preselectPatient]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPatients = patients.filter(p => {
    if (!patientSearch) return true;
    const q = patientSearch.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.patient_code.toLowerCase().includes(q) || (p.phone ?? '').includes(q);
  });

  useEffect(() => {
    if (!selectedCorporate) { setPanelRates({}); return; }
    (async () => {
      const { data } = await supabase.from('panel_rates').select('service_id, panel_price').eq('corporate_client_id', selectedCorporate);
      const map: Record<string, number> = {};
      for (const r of (data as PanelRate[]) || []) map[r.service_id] = Number(r.panel_price);
      setPanelRates(map);
    })();
  }, [supabase, selectedCorporate]);

  const selected = services.filter(s => selectedServices.includes(s.id));
  const priceFor = (s: Service) => selectedCorporate && panelRates[s.id] != null ? panelRates[s.id] : Number(s.price);
  const total = selected.reduce((sum, s) => sum + priceFor(s), 0);
  const discountNum = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percent' ? Math.round(total * discountNum) / 100 : discountNum;
  const net = Math.max(0, total - discountAmount);
  const paidNum = parseFloat(paid) || 0;
  const balance = net - paidNum;

  const filteredServices = services.filter(s => {
    if (!serviceSearch) return true;
    const q = serviceSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.short_name ?? '').toLowerCase().includes(q);
  });

  const toggleService = (svc: Service) => {
    setSelectedServices(prev => {
      if (prev.includes(svc.id)) return prev.filter(x => x !== svc.id);
      // Auto-populate doctor from share rules
      if (!selectedDoctor) {
        const rule = shareRules.find(r => r.share_for === 'performing_doctor' && r.doctor_id && (r.service_id === svc.id || r.service_category === svc.category));
        if (rule?.doctor_id) setSelectedDoctor(rule.doctor_id);
      }
      // Auto-populate referral from share rules
      if (!selectedReferral) {
        const rule = shareRules.find(r => (r.share_for === 'referral_doctor' || r.share_for === 'referral_person') && r.doctor_id && (r.service_id === svc.id || r.service_category === svc.category));
        if (rule) {
          const doc = doctors.find(d => d.id === rule.doctor_id);
          if (doc) {
            const match = referrals.find(rf => rf.name.toLowerCase().includes(doc.full_name.toLowerCase()));
            if (match) setSelectedReferral(match.id);
          }
        }
      }
      return [...prev, svc.id];
    });
  };

  const steps = [
    { num: 1, label: 'Patient', icon: User },
    { num: 2, label: 'Doctor', icon: Stethoscope },
    { num: 3, label: 'Services', icon: FileText },
    { num: 4, label: 'Payment', icon: Wallet },
    { num: 5, label: 'Invoice', icon: Printer },
  ];

  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return; }
    if (selectedServices.length === 0) { toast.error('Select at least one test'); return; }
    setSubmitting(true);
    const code = `INV-${Date.now().toString().slice(-6)}`;
    const { data: order, error } = await supabase.from('lab_orders').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      patient_id: selectedPatient,
      doctor_id: selectedDoctor || null,
      referral_source_id: selectedReferral || null,
      corporate_client_id: selectedCorporate || null,
      order_code: code,
      status: 'pending',
      total_amount: total,
      discount_amount: discountAmount,
      net_amount: net,
      paid_amount: paidNum,
      payment_status: paidNum >= net ? 'paid' : paidNum > 0 ? 'partial' : 'unpaid',
    }).select().single();

    if (error) { toast.error('Failed: ' + error.message); setSubmitting(false); return; }

    if (paidNum > 0) {
      await supabase.from('lab_order_payments').insert({
        company_id: appUser?.company_id,
        branch_id: appUser?.branch_id,
        lab_order_id: order.id,
        amount: paidNum,
        payment_method: paymentMethod,
        transaction_reference: paymentRef || null,
        received_by: appUser?.id || null,
      });
    }

    const items = selected.map(s => ({
      lab_order_id: order.id,
      service_id: s.id,
      service_name: s.name,
      price: priceFor(s),
      status: 'pending',
    }));
    await supabase.from('lab_order_items').insert(items);

    const netPrices = netPricePerService(selected, discountAmount, priceFor);

    if (selectedDoctor) {
      const doctorShares = selected.map(s => {
        const netPrice = netPrices.get(s.id) ?? Number(s.price);
        return computeDoctorShare(s, netPrice);
      }).filter(r => r.share_amount > 0);

      if (doctorShares.length > 0) {
        await supabase.from('doctor_settlements').insert(doctorShares.map(r => ({
          company_id: appUser?.company_id,
          doctor_id: selectedDoctor,
          lab_order_id: order.id,
          service_name: r.service_name,
          share_type: r.share_type,
          share_amount: r.share_amount,
          settled: false,
        })));
      }
    }

    if (selectedReferral) {
      const referralShares = selected.map(s => {
        const netPrice = netPrices.get(s.id) ?? Number(s.price);
        return computeReferralShare(s, netPrice);
      }).filter(r => r.share_amount > 0);

      if (referralShares.length > 0) {
        await supabase.from('referral_settlements').insert(referralShares.map(r => ({
          company_id: appUser?.company_id,
          referral_source_id: selectedReferral,
          lab_order_id: order.id,
          service_name: r.service_name,
          commission_type: r.share_type,
          commission_amount: r.share_amount,
          settled: false,
        })));
      }
    }

    setCreatedOrderId(order.id);
    setStep(5);
    setSubmitting(false);
    toast.success(`Invoice created: ${code}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">New Invoice</h1><p className="text-muted-foreground">Guided billing workflow</p></div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center justify-between max-w-3xl">
        {steps.map((s, idx) => (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`rounded-full p-2 transition-colors ${step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className={`text-xs ${step >= s.num ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Patient Selection */}
      {step === 1 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Select Patient</CardTitle><CardDescription>Search and select the patient for this visit</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, MR number, or phone..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {filteredPatients.map(p => (
                <div key={p.id} onClick={() => setSelectedPatient(p.id)} className={`flex items-center justify-between rounded p-2 cursor-pointer transition-colors ${selectedPatient === p.id ? 'bg-primary/10 border border-primary' : 'hover:bg-muted/50'}`}>
                  <div><p className="font-medium text-sm">{p.full_name}</p><p className="text-xs text-muted-foreground"><span className="data-mono">{p.patient_code}</span> · {p.phone ?? 'No phone'}</p></div>
                  {selectedPatient === p.id && <Check className="h-4 w-4 text-primary" />}
                </div>
              ))}
              {filteredPatients.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No patients found. <Link href="/reception/register" className="text-primary underline">Register new patient</Link></p>}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => router.push('/reception/register')}><User className="mr-2 h-4 w-4" /> New Patient</Button>
              <Button onClick={() => setStep(2)} disabled={!selectedPatient}>Next <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Doctor & Referral */}
      {step === 2 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Doctor & Referral</CardTitle><CardDescription>Select the referring doctor and referral source (optional)</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Referring Doctor</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger><SelectValue placeholder="Walk-in (no doctor)" /></SelectTrigger>
                <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name} {d.specialization ? `· ${d.specialization}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              {selectedDoctor && (
                <p className="text-xs text-[hsl(var(--chart-1))] flex items-center gap-1"><Check className="h-3 w-3" /> Auto-suggested from share configuration</p>
              )}
            </div>
            <div className="space-y-2"><Label>Referral Source</Label>
              <Select value={selectedReferral} onValueChange={setSelectedReferral}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{referrals.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.type})</SelectItem>)}</SelectContent>
              </Select>
              {selectedReferral && (
                <p className="text-xs text-[hsl(var(--chart-1))] flex items-center gap-1"><Check className="h-3 w-3" /> Auto-suggested from share configuration</p>
              )}
            </div>
            <div className="space-y-2"><Label>Bill To (Panel / Corporate)</Label>
              <Select value={selectedCorporate} onValueChange={setSelectedCorporate}>
                <SelectTrigger><SelectValue placeholder="Self-pay (walk-in)" /></SelectTrigger>
                <SelectContent>{corporates.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {selectedCorporate && (
                <p className="text-xs text-muted-foreground">Panel rates will be applied automatically</p>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Services Selection with Search */}
      {step === 3 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Select Tests / Services</CardTitle><CardDescription>Search and choose tests to include in this invoice</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input ref={searchRef} placeholder="Search tests by name or code..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
              {services.length === 0 ? <p className="text-sm text-muted-foreground p-2 text-center">No services configured. Add them in Laboratory → Services.</p> :
                filteredServices.map(s => (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded p-2 transition-colors ${selectedServices.includes(s.id) ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                    <input type="checkbox" checked={selectedServices.includes(s.id)} onChange={() => toggleService(s)} className="h-4 w-4" />
                    <div className="flex-1"><span className="text-sm font-medium">{s.name}</span><span className="text-xs text-muted-foreground ml-2">{s.code}</span></div>
                    <Badge variant="outline" className="text-xs">{s.category}</Badge>
                    <span className="text-sm font-medium">Rs {priceFor(s).toLocaleString()}</span>
                  </label>
                ))}
              {filteredServices.length === 0 && serviceSearch && <p className="text-center text-sm text-muted-foreground py-4">No services match "{serviceSearch}"</p>}
            </div>
            {selectedServices.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="default">{selectedServices.length} selected</Badge>
                <span>Subtotal: Rs {total.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={selectedServices.length === 0}>Next <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Payment with Rs/% Discount and Invoice Format */}
      {step === 4 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Discount & Payment</CardTitle><CardDescription>Enter discount and payment details</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Tests ({selected.length}):</span><span>Rs {total.toLocaleString()}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount</Label>
                <div className="flex gap-2">
                  <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="flex-1" />
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'rs' | 'percent')}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rs">Rs</SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Discount amount: Rs {discountAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-2"><Label>Paid Amount (Rs)</Label><Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
            </div>
            {paidNum > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'online' | 'card')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash"><span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash</span></SelectItem>
                      <SelectItem value="online"><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Online</span></SelectItem>
                      <SelectItem value="card"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Card</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(paymentMethod === 'online' || paymentMethod === 'card') && (
                  <div className="space-y-2"><Label>Reference (optional)</Label><Input placeholder="Txn ID / Card last 4" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} /></div>
                )}
              </div>
            )}
            <div className="rounded-md bg-muted p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Total:</span><span>Rs {total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Discount:</span><span>Rs {discountAmount.toLocaleString()}</span></div>
              <div className="flex justify-between font-medium"><span>Net Amount:</span><span>Rs {net.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Paid:</span><span>Rs {paidNum.toLocaleString()}</span></div>
              <div className="flex justify-between font-medium"><span>Balance:</span><span className={balance > 0 ? 'text-destructive' : 'text-[hsl(var(--chart-1))]'}>Rs {balance.toLocaleString()}</span></div>
            </div>
            {/* Invoice Format Selection */}
            <div className="space-y-2">
              <Label>Invoice Format</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceFormat('a5')}
                  className={`flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${invoiceFormat === 'a5' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <FileText className="h-4 w-4" /><span>A5 Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceFormat('thermal')}
                  className={`flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${invoiceFormat === 'thermal' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <Receipt className="h-4 w-4" /><span>Thermal</span>
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Check className="mr-2 h-4 w-4" /> Create Invoice</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle className="text-[hsl(var(--chart-1))]">Invoice Created</CardTitle><CardDescription>The invoice has been created successfully</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-[hsl(var(--chart-1))]/10 p-4"><Check className="h-12 w-12 text-[hsl(var(--chart-1))]" /></div>
              <p className="text-lg font-medium">Invoice created successfully!</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href={`/reception/receipt/${createdOrderId}?format=${invoiceFormat}`}><Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Receipt ({invoiceFormat === 'a5' ? 'A5' : 'Thermal'})</Button></Link>
                <Link href={`/reception/barcode/${createdOrderId}`}><Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Barcodes</Button></Link>
                <Link href={`/reception/search?id=${createdOrderId}`}><Button><Search className="mr-2 h-4 w-4" /> Track Status</Button></Link>
                <Link href="/reception/billing"><Button><FileText className="mr-2 h-4 w-4" /> New Invoice</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
