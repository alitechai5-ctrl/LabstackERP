'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, ShoppingCart, Search, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem } from '@/lib/types';

type CartItem = {
  item: InventoryItem;
  quantity: number;
  discount: number;
};

export default function PharmacySalePage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [overallDiscount, setOverallDiscount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('0');
  const [saving, setSaving] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, salesRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      supabase.from('pharmacy_sales').select('*, items:pharmacy_sale_items(*)').order('sale_date', { ascending: false }).limit(10),
    ]);
    if (itemsRes.error) toast.error(itemsRes.error.message);
    setItems((itemsRes.data as InventoryItem[]) || []);
    setRecentSales((salesRes.data as any[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filteredItems = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || (i.item_code ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const addToCart = (item: InventoryItem) => {
    const existing = cart.find((c) => c.item.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item, quantity: 1, discount: 0 }]);
    }
  };

  const updateQty = (itemId: string, qty: number) => {
    if (qty < 1) return;
    setCart(cart.map((c) => c.item.id === itemId ? { ...c, quantity: qty } : c));
  };

  const updateDiscount = (itemId: string, disc: number) => {
    setCart(cart.map((c) => c.item.id === itemId ? { ...c, discount: Math.max(0, disc) } : c));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.id !== itemId));
  };

  const lineTotal = (c: CartItem) => {
    const gross = Number(c.item.sale_price) * c.quantity;
    return Math.max(0, gross - c.discount);
  };

  const subtotal = cart.reduce((sum, c) => sum + lineTotal(c), 0);
  const discountTotal = parseFloat(overallDiscount) || 0;
  const netAmount = Math.max(0, subtotal - discountTotal);
  const change = Math.max(0, (parseFloat(paidAmount) || 0) - netAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    for (const c of cart) {
      if (c.quantity > c.item.current_stock) {
        toast.error(`Insufficient stock for ${c.item.name} (available: ${c.item.current_stock})`);
        return;
      }
    }
    setSaving(true);
    const saleNum = `SALE-${Date.now().toString().slice(-6)}`;
    const { data: saleData, error: saleError } = await supabase.from('pharmacy_sales').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      sale_number: saleNum,
      sale_date: new Date().toISOString(),
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      subtotal,
      discount_amount: discountTotal,
      tax_amount: 0,
      net_amount: netAmount,
      paid_amount: parseFloat(paidAmount) || netAmount,
      payment_mode: paymentMode,
      payment_status: (parseFloat(paidAmount) || 0) >= netAmount ? 'paid' : 'partial',
      created_by: appUser?.id ?? null,
    }).select().single();
    if (saleError) { toast.error(saleError.message); setSaving(false); return; }

    const saleId = saleData.id;
    const lineItems = cart.map((c) => ({
      sale_id: saleId,
      item_id: c.item.id,
      item_name: c.item.name,
      quantity: c.quantity,
      unit_price: Number(c.item.sale_price),
      discount_amount: c.discount,
      line_total: lineTotal(c),
    }));
    const { error: itemsError } = await supabase.from('pharmacy_sale_items').insert(lineItems);
    if (itemsError) { toast.error(itemsError.message); setSaving(false); return; }

    for (const c of cart) {
      await supabase.from('inventory_items')
        .update({ current_stock: c.item.current_stock - c.quantity })
        .eq('id', c.item.id);
    }

    toast.success(`Sale ${saleNum} completed`);
    setLastSaleId(saleId);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setOverallDiscount('0');
    setPaidAmount('0');
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pharmacy Sale (POS)</h1>
        <p className="text-muted-foreground">Sell medicine to walk-in customers or patients</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Item Search & Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-20">Stock</TableHead>
                    <TableHead className="w-24">Price</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No items found</TableCell></TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant={item.current_stock <= 0 ? 'destructive' : item.current_stock <= (item.reorder_level ?? 0) ? 'secondary' : 'outline'}>
                            {Number(item.current_stock)}
                          </Badge>
                        </TableCell>
                        <TableCell>Rs {Number(item.sale_price).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={item.current_stock <= 0}
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Cart & Checkout */}
        <Card>
          <CardHeader>
            <CardTitle>Cart ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingCart className="mb-2 h-8 w-8" />
                <p>Cart is empty. Add items from the list.</p>
              </div>
            ) : (
              <>
                <div className="max-h-[300px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-24">Disc</TableHead>
                        <TableHead className="w-24">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((c) => (
                        <TableRow key={c.item.id}>
                          <TableCell className="font-medium text-sm">{c.item.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={c.quantity}
                              onChange={(e) => updateQty(c.item.id, parseInt(e.target.value) || 1)}
                              className="h-8 w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={c.discount}
                              onChange={(e) => updateDiscount(c.item.id, parseFloat(e.target.value) || 0)}
                              className="h-8 w-20"
                            />
                          </TableCell>
                          <TableCell className="font-medium">Rs {lineTotal(c).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => removeFromCart(c.item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Customer Name</Label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Overall Discount (Rs)</Label>
                    <Input type="number" value={overallDiscount} onChange={(e) => setOverallDiscount(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Paid Amount (Rs)</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={netAmount.toString()} />
                </div>

                <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>Rs {discountTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Net Amount</span><span>Rs {netAmount.toLocaleString()}</span></div>
                  {change > 0 && <div className="flex justify-between text-[hsl(var(--chart-1))]"><span>Change</span><span>Rs {change.toLocaleString()}</span></div>}
                </div>

                <Button className="w-full" onClick={handleCheckout} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Complete Sale
                </Button>

                {lastSaleId && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(`/pharmacy/sale/receipt/${lastSaleId}`, '_blank')}>
                    <Printer className="mr-2 h-4 w-4" /> Print Last Receipt
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No sales yet</TableCell></TableRow>
              ) : (
                recentSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="data-mono text-sm">{s.sale_number}</TableCell>
                    <TableCell className="text-sm">{new Date(s.sale_date).toLocaleString()}</TableCell>
                    <TableCell>{s.customer_name ?? 'Walk-in'}</TableCell>
                    <TableCell>{s.items?.length ?? 0}</TableCell>
                    <TableCell className="font-medium">Rs {Number(s.net_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_status === 'paid' ? 'default' : 'secondary'}>{s.payment_mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => window.open(`/pharmacy/sale/receipt/${s.id}`, '_blank')}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
