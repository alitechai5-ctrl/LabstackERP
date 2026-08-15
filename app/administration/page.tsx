'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, GitBranch, Users, ShieldCheck, Calendar, ScrollText, Settings } from 'lucide-react';
import { usePermissions } from '@/lib/auth/use-permissions';

export default function AdministrationPage() {
  const { has } = usePermissions();

  const sections = [
    { label: 'Company', href: '/masters/companies', icon: Building2, desc: 'Manage company details', perm: has('administration', 'companies') },
    { label: 'Branches', href: '/masters/branches', icon: GitBranch, desc: 'Manage branch offices', perm: has('administration', 'branches') },
    { label: 'Users', href: '/settings/users', icon: Users, desc: 'Manage system users', perm: has('administration', 'users') },
    { label: 'Roles & Permissions', href: '/settings/roles', icon: ShieldCheck, desc: 'Manage access control', perm: has('administration', 'roles') },
    { label: 'Financial Years', href: '/administration/financial-years', icon: Calendar, desc: 'Manage accounting periods', perm: has('administration', 'financial_years') },
    { label: 'Audit Logs', href: '/settings/audit', icon: ScrollText, desc: 'View system audit trail', perm: has('administration', 'audit') },
    { label: 'System Settings', href: '/settings', icon: Settings, desc: 'Configure system-wide options', perm: has('administration', 'settings') },
  ];

  const visible = sections.filter(s => s.perm);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Administration</h1>
        <p className="text-sm text-muted-foreground">System-wide configuration and management</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold font-display">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            You do not have permission to access administration features.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
