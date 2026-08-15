'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Search, FileText, Wallet, Printer, CalendarClock } from 'lucide-react';

const modules = [
  { href: '/reception/register', title: 'Patient Registration', desc: 'Register a new patient', icon: Users },
  { href: '/reception/search', title: 'Patient Search', desc: 'Find patient or order', icon: Search },
  { href: '/reception/billing', title: 'Billing', desc: 'Create invoice', icon: FileText },
  { href: '/reception/payments', title: 'Payment Collection', desc: 'Collect payment', icon: Wallet },
  { href: '/reception/reports', title: 'Report Center', desc: 'Print reports', icon: Printer },
  { href: '/reception/appointments', title: 'Appointments', desc: 'Schedule visits', icon: CalendarClock },
];

export default function ReceptionPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Reception</h1>
        <p className="text-sm text-muted-foreground">Patient registration, billing, and payments</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <m.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-display">{m.title}</CardTitle>
                    <CardDescription className="text-xs">{m.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
