'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Plus, Trash2, Search, X, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import type { Patient, Service, Doctor, ReferralSource, CorporateClient, PanelRate } from '@/lib/types';
import { computeShareForCart, netPricePerService, type ShareRule } from '@/lib/utils/shares';

type CartItem = { service: Service; price: number };

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [referrals, setReferrals] = useState<ReferralSource[]>([]);
  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [shareRules, setShareRules] = useState<ShareRule[]>([]);
  const [panelRates, setPanelRates] = useState<Record<string, number>>({});
  const [selectedCorporate, setSelectedCorporate] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedReferral, setSelectedReferral] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'rs' | 'percent'>('rs');
  const [discountValue, setDiscountValue] = useState('0');
  const [paid, setPaid] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [invoiceFormat, setInvoiceFormat] = useState<'a5' | 'thermal'>('a5');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [pRes, sRes, dRes, rRes, cRes, srRes] = await Promise.all([
        supabase.from('patients').select('*').order('full_name'),
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
        supabase.from('referral_sources').select('*').eq('is_active', true).order('name'),
        supabase.from('corporate_clients').select('*').eq('is_active', true).order('name'),
        supabase.from('share_rules').select('*').eq('is_active', true).order('priority', { ascending: false }),
      ]);
      setPatients((pRes.data as Patient[]) || []);
      setServices((sRes.data as Service[]) || []);
      setDoctors((dRes.data as Doctor[]) || []);
      setReferrals((rRes.data as ReferralSource[]) || []);
      setCorporates((cRes.data as CorporateClient[]) || []);
      setShareRules((srRes.data as ShareRule[]) || []);

      const patientParam = searchParams.get('patient');
      if (patientParam) setSelectedPatient(patientParam);
    })();
  }, [supabase, searchParams]);

  useEffect(() => {
    if (!selectedCorporate) { setPanelRates({}); return; }
    (async () => {
      const { data } = await supabase.from('panel_rates').select('service_id, panel_price').eq('corporate_client_id', selectedCorporate);
      const map: Record<string, number> = {};
      for (const r of (data as PanelRate[]) || []) map[r.service_id] = Number(r.panel_price);
      setPanelRates(map);
    })();
  }, [supabase, selectedCorporate]);

  const priceFor = (s: Service) => selectedCorporate && panelRates[s.id] != null ? panelRates[s.id] : Number(s.price);
  const total = cart.reduce((sum, c) => sum + c.price, 0);
  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'percent' ? Math.round(total * discountNum) / 100 : discountNum;
  const net = Math.max(0, total - discountAmount);
  const paidNum = parseFloat(paid) || 0;
  const balance = net - paidNum;

  const filteredServices = services.filter((s) => {
    const q = serviceSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.short_name ?? '').toLowerCase().includes(q);
  });

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true;
    const q = patientSearch.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.patient_code.toLowerCase().includes(q) || (p.phone ?? '').includes(q);
  });

  const addToCart = (svc: Service) => {
    setCart((prev) => {
      if (prev.some((c) => c.service.id === svc.id)) return prev;
      return [...prev, { service: svc, price: priceFor(svc) }];
    });
    setServiceSearch('');
    searchRef.current?.focus();
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.service.id !== id));

  const updateCartItemPrice = (id: string, price: number) => setCart((prev) => prev.map((c) => c.service.id === id ? { ...c, price } : c));

  // Auto-populate doctor/referral based on share rules when a service is added
  const findMatchingRule = (shareFor: string, service: Service): ShareRule | null => {
    const rules = shareRules.filter((r) => r.share_for === shareFor);
    // Already sorted by priority desc; find first match
    for (const r of rules) {
      const doctorMatch = !r.doctor_id || r.doctor_id === selectedDoctor;
      const serviceMatch = !r.service_id || r.service_id === service.id;
      const categoryMatch = !r.service_category || r.service_category === service.category;
      if (doctorMatch && serviceMatch && categoryMatch) return r;
    }
    return null;
  };

  const handleAddService = (svc: Service) => {
    addToCart(svc);
    // Auto-populate doctor if not set and a share rule references this service
    if (!selectedDoctor) {
      const rule = shareRules.find((r) => r.share_for === 'performing_doctor' && r.doctor_id && (r.service_id === svc.id || r.service_category === svc.category));
      if (rule?.doctor_id) setSelectedDoctor(rule.doctor_id);
    }
    if (!selectedReferral) {
      const rule = shareRules.find((r) => (r.share_for === 'referral_doctor' || r.share_for === 'referral_person') && r.doctor_id && (r.service_id === svc.id || r.service_category === svc.category));
      // If the referral rule points to a doctor, try to match it to a referral source
      if (rule) {
        const matchingReferral = referrals.find((rf) => rf.name.toLowerCase().includes(doctors.find((d) => d.id === rule.doctor_id)?.full_name?.toLowerCase() ?? ''));
        if (matchingReferral) setSelectedReferral(matchingReferral.id);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return; }
    if (cart.length === 0) { toast.error('Add at least one test'); return; }
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
    const items = cart.map((c) => ({
      lab_order_id: order.id,
      service_id: c.service.id,
      service_name: c.service.name,
      price: c.price,
      status: 'pending',
    }));
    await supabase.from('lab_order_items').insert(items);

    const svcObjs = cart.map((c) => c.service);
    const cartPrices = new Map(svcObjs.map((s) => [s.id, cart.find((c) => c.service.id === s.id)?.price ?? Number(s.price)]));
    const cashAmount = parseFloat(paid) || 0;

    const { doctorShares, referralInSourceShares, referralOutSourceShares } = computeShareForCart(
      svcObjs, cartPrices, discountAmount, cashAmount, shareRules,
      { doctorId: selectedDoctor || null, referralSourceId: selectedReferral || null, corporateClientId: selectedCorporate || null }
    );

    if (doctorShares.length > 0) {
      await supabase.from('doctor_settlements').insert(doctorShares.map(r => ({
        company_id: appUser?.company_id,
        doctor_id: selectedDoctor,
        lab_order_id: order.id,
        service_name: r.service_name,
        service_id: r.service_id,
        share_type: r.share_type,
        share_amount: r.share_amount,
        share_percentage: r.share_percentage ?? null,
        calculation_basis: r.calculation_basis,
        share_rule_id: r.rule_id ?? null,
        doctor_type: 'performing_doctor',
        settled: false,
      })));
    }

    const allReferralShares = [
      ...referralInSourceShares.map(r => ({ ...r, source_type: 'in_source' })),
      ...referralOutSourceShares.map(r => ({ ...r, source_type: 'out_source' })),
    ];
    if (allReferralShares.length > 0) {
      await supabase.from('referral_settlements').insert(allReferralShares.map(r => ({
        company_id: appUser?.company_id,
        referral_source_id: selectedReferral,
        lab_order_id: order.id,
        service_name: r.service_name,
        service_id: r.service_id,
        commission_type: r.share_type,
        commission_amount: r.share_amount,
        share_percentage: r.share_percentage ?? null,
        calculation_basis: r.calculation_basis,
        share_rule_id: r.rule_id ?? null,
        source_type: r.source_type,
        settled: false,
      })));
    }

    toast.success(`Invoice created: ${code}`);
    setSubmitting(false);
    router.push(`/reception/receipt/${order.id}?format=${invoiceFormat}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">New Invoice</h1><p className="text-muted-foreground">Create a new billing invoice</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Patient + Service Search */}
        <div className="space-y-4 lg:col-span-2">
          {/* Patient Selection */}
          <Card>
            <CardHeader><CardTitle>Patient & Billing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Patient *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by name, MRN, or phone..."
                    className="pl-10"
                  />
                </div>
                {patientSearch && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {filteredPatients.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPatient(p.id); setPatientSearch(''); }}
                        className="flex w-full items-center justify-between border-b p-2 text-left text-sm hover:bg-muted/50"
                      >
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-muted-foreground"><span className="data-mono">{p.patient_code}</span> | {p.phone ?? '-'}</span>
                      </button>
                    ))}
                    {filteredPatients.length === 0 && <p className="p-2 text-center text-sm text-muted-foreground">No patients found</p>}
                  </div>
                )}
                {selectedPatient && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2">
                    <Badge variant="default">{patients.find((p) => p.id === selectedPatient)?.patient_code}</Badge>
                    <span className="text-sm font-medium">{patients.find((p) => p.id === selectedPatient)?.full_name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedPatient('')}><X className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Doctor</Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}{d.specialization ? ` · ${d.specialization}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Referral Source</Label>
                  <Select value={selectedReferral} onValueChange={setSelectedReferral}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {referrals.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bill To (Panel)</Label>
                  <Select value={selectedCorporate} onValueChange={setSelectedCorporate}>
                    <SelectTrigger><SelectValue placeholder="Self-pay" /></SelectTrigger>
                    <SelectContent>
                      {corporates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Search + Cart */}
          <Card>
            <CardHeader>
              <CardTitle>Tests & Services</CardTitle>
              <CardDescription>Search and add tests to the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search tests by name or code..."
                  className="pl-10"
                />
              </div>

              {serviceSearch && (
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {filteredServices.slice(0, 12).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAddService(s)}
                      disabled={cart.some((c) => c.service.id === s.id)}
                      className="flex w-full items-center justify-between border-b p-2.5 text-left text-sm hover:bg-muted/50 disabled:opacity-40"
                    >
                      <div>
                        <span className="font-medium">{s.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{s.category}</Badge>
                      </div>
                      <span className="text-muted-foreground">Rs {priceFor(s).toLocaleString()}</span>
                    </button>
                  ))}
                  {filteredServices.length === 0 && <p className="p-2 text-center text-sm text-muted-foreground">No services found</p>}
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Selected Tests ({cart.length})</Label>
                    <Button size="sm" variant="ghost" onClick={() => setCart([])}>Clear All</Button>
                  </div>
                  <div className="space-y-1.5">
                    {cart.map((c) => (
                      <div key={c.service.id} className="flex items-center gap-2 rounded-md border p-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.service.name}</p>
                          <p className="text-xs text-muted-foreground">{c.service.category}</p>
                        </div>
                        <Input
                          type="number"
                          value={c.price}
                          onChange={(e) => updateCartItemPrice(c.service.id, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right text-sm"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(c.service.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary + Submit */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal:</span><span>Rs {total.toLocaleString()}</span></div>

                {/* Discount with Rs / % toggle */}
                <div className="space-y-1.5">
                  <Label>Discount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'rs' | 'percent')}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rs">Rs</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Discount: Rs {discountAmount.toLocaleString()}</p>
                </div>

                <div className="flex justify-between font-medium border-t pt-2"><span>Net:</span><span>Rs {net.toLocaleString()}</span></div>

                <div className="space-y-1.5">
                  <Label>Paid Amount (Rs)</Label>
                  <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>

                <div className="flex justify-between text-sm"><span>Balance:</span><span className={balance > 0 ? 'text-destructive font-medium' : 'text-[hsl(var(--chart-1))] font-medium'}>Rs {balance.toLocaleString()}</span></div>
              </div>

              {/* Invoice Format */}
              <div className="space-y-1.5">
                <Label>Invoice Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setInvoiceFormat('a5')}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${invoiceFormat === 'a5' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>A5</span>
                  </button>
                  <button
                    onClick={() => setInvoiceFormat('thermal')}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${invoiceFormat === 'thermal' ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Thermal</span>
                  </button>
                </div>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="mr-2 h-4 w-4" /> Create Invoice</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
