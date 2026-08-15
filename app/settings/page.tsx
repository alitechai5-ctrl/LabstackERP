'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, ShieldCheck, ScrollText } from 'lucide-react';

const MODULES = [
  { href: '/settings/users', title: 'Users', desc: 'Manage system users', icon: Users },
  { href: '/settings/roles', title: 'Roles & Permissions', desc: 'Manage roles and permissions', icon: ShieldCheck },
  { href: '/settings/audit', title: 'Audit Logs', desc: 'View system audit logs', icon: ScrollText },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold font-display">Settings</h1><p className="text-sm text-muted-foreground">System configuration and administration</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <m.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div><CardTitle className="text-sm font-display">{m.title}</CardTitle><CardDescription className="text-xs">{m.desc}</CardDescription></div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
