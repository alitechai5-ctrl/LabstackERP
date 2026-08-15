'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TestTube, FlaskConical, FileEdit, CheckCircle2, Printer } from 'lucide-react';

const modules = [
  { href: '/lab/collection', title: 'Sample Collection', desc: 'Collect pending samples', icon: TestTube },
  { href: '/lab/processing', title: 'Processing', desc: 'Samples being processed', icon: FlaskConical },
  { href: '/lab/results', title: 'Result Entry', desc: 'Enter test results', icon: FileEdit },
  { href: '/lab/verification', title: 'Verification', desc: 'Verify entered results', icon: CheckCircle2 },
  { href: '/lab/approval', title: 'Approval', desc: 'Approve verified results', icon: CheckCircle2 },
  { href: '/lab/reports', title: 'Reports', desc: 'Track status and print reports', icon: Printer },
];

export default function LabPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Laboratory</h1>
        <p className="text-sm text-muted-foreground">Lab workflow from sample collection to report printing</p>
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
