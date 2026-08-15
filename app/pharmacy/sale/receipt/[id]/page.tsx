'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, ArrowLeft } from 'lucide-react';
import type { PharmacySale, PharmacySaleItem, Company } from '@/lib/types';

type SaleWithItems = PharmacySale & { items?: PharmacySaleItem[] };

export default function PharmacySaleReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;
  const supabase = getSupabaseClient();

  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pharmacy_sales')
      .select('*, items:pharmacy_sale_items(*)')
      .eq('id', saleId)
      .maybeSingle();
    if (error) { console.error(error); }
    else if (data) {
      setSale(data as any);
      if ((data as any).company_id) {
        const { data: co } = await supabase.from('companies').select('*').eq('id', (data as any).company_id).maybeSingle();
        if (co) setCompany(co as Company);
      }
    }
    setLoading(false);
  }, [supabase, saleId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePrint = () => { window.print(); };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading receipt...</div>;
  if (!sale) return <div className="p-8 text-center text-muted-foreground">Sale not found</div>;

  const balance = Number(sale.net_amount) - Number(sale.paid_amount);

  return (
    <div className="space-y-4">
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => router.push('/pharmacy/sale')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
      </div>

      <Card className="mx-auto max-w-md p-6 print:border-0 print:shadow-none print:max-w-none">
        <div className="text-center border-b-2 pb-3">
          <h1 className="text-xl font-bold">{company?.name ?? 'Healthcare ERP'}</h1>
          {company?.address && <p className="text-xs text-muted-foreground">{company.address}</p>}
          <p className="text-xs text-muted-foreground">{company?.city ?? ''} {company?.phone ? `| ${company.phone}` : ''}</p>
        </div>

        <div className="mt-3 flex justify-between text-sm">
          <div>
            <p className="font-bold">PHARMACY SALE</p>
            <p className="text-xs text-muted-foreground data-mono">{sale.sale_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{formatDate(sale.sale_date)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(sale.sale_date)}</p>
          </div>
        </div>

        <div className="mt-3 border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="font-medium">{sale.customer_name ?? 'Walk-in Customer'}</span></div>
          {sale.customer_phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span>{sale.customer_phone}</span></div>}
        </div>

        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2">
              <th className="py-1 text-left">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Price</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items || []).map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-1">{item.item_name}</td>
                <td className="py-1 text-center">{Number(item.quantity)}</td>
                <td className="py-1 text-right">Rs {Number(item.unit_price).toLocaleString()}</td>
                <td className="py-1 text-right">Rs {Number(item.line_total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-sm border-t pt-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>Rs {Number(sale.subtotal).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount:</span><span>Rs {Number(sale.discount_amount).toLocaleString()}</span></div>
          <div className="flex justify-between font-bold"><span>Net Amount:</span><span>Rs {Number(sale.net_amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid ({sale.payment_mode}):</span><span>Rs {Number(sale.paid_amount).toLocaleString()}</span></div>
          {balance > 0 && <div className="flex justify-between font-bold text-destructive"><span>Balance:</span><span>Rs {balance.toLocaleString()}</span></div>}
        </div>

        <div className="mt-6 border-t pt-2 text-center text-xs text-muted-foreground">
          <p>Thank you for your purchase</p>
          <p className="mt-1">This is a computer-generated receipt.</p>
        </div>
      </Card>
    </div>
  );
}
