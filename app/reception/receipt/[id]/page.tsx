'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, ArrowLeft, FileText, Receipt } from 'lucide-react';
import type { LabOrder, LabOrderItem, Patient, Company, Doctor } from '@/lib/types';

type OrderWithRelations = LabOrder & {
  patient?: Patient;
  doctor?: Doctor | null;
  lab_order_items?: LabOrderItem[];
};

export default function PrintableReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const supabase = getSupabaseClient();

  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<'a5' | 'thermal'>(searchParams.get('format') === 'thermal' ? 'thermal' : 'a5');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_orders')
      .select('*, patient:patients(*), doctor:doctors(*), lab_order_items:lab_order_items(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (error) { console.error(error); }
    else if (data) {
      setOrder(data as any);
      if ((data as any).company_id) {
        const { data: co } = await supabase.from('companies').select('*').eq('id', (data as any).company_id).maybeSingle();
        if (co) setCompany(co as Company);
      }
    }
    setLoading(false);
  }, [supabase, orderId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePrint = () => { window.print(); };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading receipt...</div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;

  const balance = Number(order.net_amount) - Number(order.paid_amount);

  const thermalWidth = 'max-w-[80mm]';
  const a5Width = 'max-w-md';

  return (
    <div className="space-y-4">
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => router.push('/reception')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <button
              onClick={() => setFormat('a5')}
              className={`flex items-center gap-1.5 rounded-l-md px-3 py-2 text-sm ${format === 'a5' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}
            ><FileText className="h-4 w-4" /> A5</button>
            <button
              onClick={() => setFormat('thermal')}
              className={`flex items-center gap-1.5 rounded-r-md px-3 py-2 text-sm ${format === 'thermal' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}
            ><Receipt className="h-4 w-4" /> Thermal</button>
          </div>
          <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      <Card className={`mx-auto p-6 print:border-0 print:shadow-none print:max-w-none ${format === 'thermal' ? thermalWidth : a5Width}`}>
        {/* Header */}
        <div className="text-center border-b-2 pb-3">
          <h1 className={`font-bold ${format === 'thermal' ? 'text-base' : 'text-xl'}`}>{company?.name ?? 'Healthcare ERP'}</h1>
          {company?.address && <p className="text-xs text-muted-foreground">{company.address}</p>}
          <p className="text-xs text-muted-foreground">{company?.city ?? ''} {company?.phone ? `| ${company.phone}` : ''}</p>
        </div>

        {/* Invoice Info */}
        <div className="mt-3 flex justify-between text-sm">
          <div>
            <p className="font-bold">INVOICE</p>
            <p className="text-xs text-muted-foreground">{order.order_code}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
          </div>
        </div>

        {/* Patient Info */}
        <div className="mt-3 border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Patient:</span><span className="font-medium">{order.patient?.full_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">MRN:</span><span className="data-mono">{order.patient?.patient_code}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span>{order.patient?.phone ?? '-'}</span></div>
          {order.doctor && <div className="flex justify-between"><span className="text-muted-foreground">Doctor:</span><span>{order.doctor.full_name}</span></div>}
        </div>

        {/* Items */}
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2">
              <th className="py-1 text-left">Test</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(order.lab_order_items || []).map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-1">{item.service_name}</td>
                <td className="py-1 text-right">Rs {Number(item.price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 space-y-1 text-sm border-t pt-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span>Rs {Number(order.total_amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount:</span><span>Rs {Number(order.discount_amount).toLocaleString()}</span></div>
          <div className="flex justify-between font-bold"><span>Net Amount:</span><span>Rs {Number(order.net_amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span>Rs {Number(order.paid_amount).toLocaleString()}</span></div>
          {balance > 0 && <div className="flex justify-between font-bold text-destructive"><span>Balance:</span><span>Rs {balance.toLocaleString()}</span></div>}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t pt-2 text-center text-xs text-muted-foreground">
          <p>Thank you for choosing {company?.name ?? 'our facility'}</p>
          <p className="mt-1">This is a computer-generated receipt.</p>
        </div>
      </Card>
    </div>
  );
}
