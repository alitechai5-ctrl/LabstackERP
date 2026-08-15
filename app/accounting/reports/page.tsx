'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileBarChart, TrendingUp, Scale, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { ChartOfAccount } from '@/lib/types';

type LedgerRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

export default function AccountingReportsPage() {
  const supabase = getSupabaseClient();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('trial-balance');

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, lRes] = await Promise.all([
      supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('code'),
      supabase.from('journal_lines').select('debit, credit, account:chart_of_accounts(id, code, name, type)'),
    ]);
    if (aRes.error) toast.error(aRes.error.message);
    setAccounts((aRes.data as ChartOfAccount[]) || []);

    const lines = (lRes.data as any) || [];
    const byAccount: Record<string, LedgerRow> = {};
    for (const line of lines) {
      const acc = line.account;
      if (!acc) continue;
      if (!byAccount[acc.id]) {
        byAccount[acc.id] = {
          account_id: acc.id,
          account_code: acc.code,
          account_name: acc.name,
          account_type: acc.type,
          total_debit: 0,
          total_credit: 0,
          balance: 0,
        };
      }
      byAccount[acc.id].total_debit += Number(line.debit) || 0;
      byAccount[acc.id].total_credit += Number(line.credit) || 0;
    }
    for (const key of Object.keys(byAccount)) {
      byAccount[key].balance = byAccount[key].total_debit - byAccount[key].total_credit;
    }
    setLedger(Object.values(byAccount).sort((a, b) => a.account_code.localeCompare(b.account_code)));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalDebit = ledger.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = ledger.reduce((s, r) => s + r.total_credit, 0);
  const totalBalance = ledger.reduce((s, r) => s + r.balance, 0);

  const assetAccounts = ledger.filter(r => r.account_type === 'asset');
  const liabilityAccounts = ledger.filter(r => r.account_type === 'liability');
  const equityAccounts = ledger.filter(r => r.account_type === 'equity');
  const revenueAccounts = ledger.filter(r => r.account_type === 'revenue');
  const expenseAccounts = ledger.filter(r => r.account_type === 'expense');

  const totalAssets = assetAccounts.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((s, r) => s + Math.abs(r.balance), 0);
  const totalEquity = equityAccounts.reduce((s, r) => s + Math.abs(r.balance), 0);
  const totalRevenue = revenueAccounts.reduce((s, r) => s + Math.abs(r.balance), 0);
  const totalExpenses = expenseAccounts.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">View trial balance, ledger, and financial statements</p>
        </div>
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="trial-balance">Trial Balance</SelectItem>
            <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
            <SelectItem value="income-statement">Income Statement</SelectItem>
            <SelectItem value="ledger">General Ledger</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : ledger.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileBarChart className="mx-auto h-12 w-12 mb-3 opacity-50" />
          <p>No journal entries posted yet</p>
        </CardContent></Card>
      ) : (
        <>
          {reportType === 'trial-balance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Trial Balance</CardTitle>
                <CardDescription>As of {new Date().toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="border-b-2">
                    <tr>
                      <th className="py-2 text-left font-semibold">Code</th>
                      <th className="py-2 text-left font-semibold">Account</th>
                      <th className="py-2 text-right font-semibold">Debit</th>
                      <th className="py-2 text-right font-semibold">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map(r => (
                      <tr key={r.account_id} className="border-b">
                        <td className="py-2 font-mono text-xs">{r.account_code}</td>
                        <td className="py-2">{r.account_name}</td>
                        <td className="py-2 text-right">{r.balance >= 0 ? `Rs ${Number(r.total_debit).toLocaleString()}` : '-'}</td>
                        <td className="py-2 text-right">{r.balance < 0 ? `Rs ${Number(r.total_credit).toLocaleString()}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 font-bold">
                    <tr>
                      <td className="py-2" colSpan={2}>Total</td>
                      <td className="py-2 text-right">Rs {totalDebit.toLocaleString()}</td>
                      <td className="py-2 text-right">Rs {totalCredit.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}

          {reportType === 'balance-sheet' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Assets</CardTitle></CardHeader>
                <CardContent>
                  {assetAccounts.length === 0 ? <p className="text-muted-foreground text-sm">No asset accounts</p> : (
                    <div className="space-y-2">
                      {assetAccounts.map(r => (
                        <div key={r.account_id} className="flex justify-between text-sm border-b pb-1">
                          <span>{r.account_name}</span>
                          <span className="font-medium">Rs {Number(r.balance).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-2"><span>Total Assets</span><span>Rs {totalAssets.toLocaleString()}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Liabilities & Equity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-muted-foreground">Liabilities</p>
                      {liabilityAccounts.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1">
                          {liabilityAccounts.map(r => (
                            <div key={r.account_id} className="flex justify-between text-sm border-b pb-1">
                              <span>{r.account_name}</span>
                              <span className="font-medium">Rs {Math.abs(Number(r.balance)).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-muted-foreground">Equity</p>
                      {equityAccounts.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1">
                          {equityAccounts.map(r => (
                            <div key={r.account_id} className="flex justify-between text-sm border-b pb-1">
                              <span>{r.account_name}</span>
                              <span className="font-medium">Rs {Math.abs(Number(r.balance)).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total L&E</span>
                      <span>Rs {(totalLiabilities + totalEquity).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === 'income-statement' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Revenue</CardTitle></CardHeader>
                <CardContent>
                  {revenueAccounts.length === 0 ? <p className="text-muted-foreground text-sm">No revenue accounts</p> : (
                    <div className="space-y-2">
                      {revenueAccounts.map(r => (
                        <div key={r.account_id} className="flex justify-between text-sm border-b pb-1">
                          <span>{r.account_name}</span>
                          <span className="font-medium">Rs {Math.abs(Number(r.balance)).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-2"><span>Total Revenue</span><span>Rs {totalRevenue.toLocaleString()}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Expenses</CardTitle></CardHeader>
                <CardContent>
                  {expenseAccounts.length === 0 ? <p className="text-muted-foreground text-sm">No expense accounts</p> : (
                    <div className="space-y-2">
                      {expenseAccounts.map(r => (
                        <div key={r.account_id} className="flex justify-between text-sm border-b pb-1">
                          <span>{r.account_name}</span>
                          <span className="font-medium">Rs {Number(r.balance).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-2"><span>Total Expenses</span><span>Rs {totalExpenses.toLocaleString()}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Net Income (Revenue - Expenses)</span>
                    <span className={totalRevenue - totalExpenses >= 0 ? 'text-[hsl(var(--chart-1))]' : 'text-destructive'}>
                      Rs {(totalRevenue - totalExpenses).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === 'ledger' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> General Ledger</CardTitle>
                <CardDescription>All account balances</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="border-b-2">
                    <tr>
                      <th className="py-2 text-left font-semibold">Code</th>
                      <th className="py-2 text-left font-semibold">Account</th>
                      <th className="py-2 text-left font-semibold">Type</th>
                      <th className="py-2 text-right font-semibold">Debit</th>
                      <th className="py-2 text-right font-semibold">Credit</th>
                      <th className="py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map(r => (
                      <tr key={r.account_id} className="border-b">
                        <td className="py-2 font-mono text-xs">{r.account_code}</td>
                        <td className="py-2">{r.account_name}</td>
                        <td className="py-2"><Badge variant="secondary">{r.account_type}</Badge></td>
                        <td className="py-2 text-right">Rs {Number(r.total_debit).toLocaleString()}</td>
                        <td className="py-2 text-right">Rs {Number(r.total_credit).toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">{r.balance >= 0 ? `Rs ${Number(r.balance).toLocaleString()} Dr` : `Rs ${Math.abs(Number(r.balance)).toLocaleString()} Cr`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
