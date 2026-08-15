'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, ArrowLeft } from 'lucide-react';
import type { LabOrder, LabOrderItem, Patient, Company } from '@/lib/types';

type OrderWithRelations = LabOrder & {
  patient?: Patient;
  lab_order_items?: LabOrderItem[];
};

export default function BarcodePrintPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const supabase = getSupabaseClient();

  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lab_orders')
      .select('*, patient:patients(*), lab_order_items:lab_order_items(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (data) {
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

  if (loading) return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground">Order not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => router.push('/reception')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Barcodes</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 print:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
        {(order.lab_order_items || []).map((item, idx) => {
          const barcode = `${order.order_code}-${String(idx + 1).padStart(3, '0')}`;
          return (
            <Card key={item.id} className="p-3 print:border-0 print:shadow-none">
              <div className="text-center">
                <p className="text-xs font-bold">{company?.name ?? 'Lab'}</p>
                <p className="text-[10px] text-muted-foreground data-mono">{order.patient?.patient_code}</p>
                <div className="my-2 border border-dashed border-border p-2">
                  <div className="font-mono text-xs tracking-widest">{barcode}</div>
                  <div className="mt-1 flex justify-center">
                    <div className="flex gap-px">
                      {barcode.split('').map((ch, i) => (
                        <div
                          key={i}
                          className={ch.charCodeAt(0) % 2 === 0 ? 'bg-black' : 'bg-white'}
                          style={{ width: `${ch.charCodeAt(0) % 3 + 1}px`, height: '24px' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-medium">{item.service_name}</p>
                <p className="text-[10px] text-muted-foreground">{order.patient?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {(order.lab_order_items || []).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No tests in this order</Card>
      )}
    </div>
  );
}
