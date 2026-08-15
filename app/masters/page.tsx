'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Building2, Network, Stethoscope, UserPlus, FlaskConical, Briefcase,
  Shield, Package, Truck, Factory, Ruler, FolderTree, BookOpen, Users,
} from 'lucide-react';

const items = [
  { label: 'Companies', href: '/masters/companies', icon: Building2, desc: 'Manage organization' },
  { label: 'Branches', href: '/masters/branches', icon: Network, desc: 'Branch offices' },
  { label: 'Departments', href: '/masters/departments', icon: FolderTree, desc: 'Lab, Radiology, OPD' },
  { label: 'Doctors', href: '/masters/doctors', icon: Stethoscope, desc: 'Doctor master with shares' },
  { label: 'Referral Sources', href: '/masters/referrals', icon: UserPlus, desc: 'Doctors, clinics, agents' },
  { label: 'Services / Tests', href: '/masters/services', icon: FlaskConical, desc: 'Lab, radiology, OPD tests' },
  { label: 'Corporate Clients', href: '/masters/corporates', icon: Briefcase, desc: 'Corporate contracts' },
  { label: 'Insurance Companies', href: '/masters/insurance', icon: Shield, desc: 'Insurance providers' },
  { label: 'Suppliers', href: '/masters/suppliers', icon: Truck, desc: 'Inventory suppliers' },
  { label: 'Manufacturers', href: '/masters/manufacturers', icon: Factory, desc: 'Medicine manufacturers' },
  { label: 'Units & Categories', href: '/masters/units-categories', icon: Ruler, desc: 'Measurement & item categories' },
  { label: 'Chart of Accounts', href: '/masters/coa', icon: BookOpen, desc: 'Accounting COA' },
  { label: 'Designations', href: '/masters/designations', icon: Users, desc: 'Job titles' },
];

export default function MastersPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Master Data</h1>
        <p className="text-sm text-muted-foreground">Manage all master records for your organization</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold font-display">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
