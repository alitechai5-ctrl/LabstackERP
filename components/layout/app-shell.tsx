'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/use-permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  LayoutDashboard,
  Users,
  FileText,
  FlaskConical,
  Scan,
  Pill,
  Package,
  Calculator,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Building2,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
  icon: any;
  module?: string;
  action?: string;
  children?: { label: string; href: string; module?: string; action?: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  {
    label: 'Reception',
    href: '/reception',
    icon: Users,
    module: 'reception',
    children: [
      { label: 'Patients', href: '/patients', module: 'reception', action: 'search' },
      { label: 'New Registration', href: '/reception/register', module: 'reception', action: 'register' },
      { label: 'Appointments', href: '/reception/appointments', module: 'reception', action: 'appointments' },
      { label: 'Billing', href: '/reception/billing', module: 'reception', action: 'billing' },
      { label: 'Payment Collection', href: '/reception/payments', module: 'reception', action: 'payment' },
      { label: 'Report Center', href: '/reception/reports', module: 'reception', action: 'reports' },
    ],
  },
  {
    label: 'Clinical',
    href: '/lab',
    icon: Stethoscope,
    children: [
      { label: 'OPD', href: '/opd', module: 'patients', action: 'view' },
      { label: 'Laboratory', href: '/lab', module: 'lab', action: 'view' },
      { label: 'Sample Collection', href: '/lab/collection', module: 'lab', action: 'collect' },
      { label: 'Processing', href: '/lab/processing', module: 'lab', action: 'process' },
      { label: 'Result Entry', href: '/lab/results', module: 'lab', action: 'result_entry' },
      { label: 'Verification', href: '/lab/verification', module: 'lab', action: 'verify' },
      { label: 'Approval', href: '/lab/approval', module: 'lab', action: 'approve' },
      { label: 'Lab Reports', href: '/lab/reports', module: 'lab', action: 'view' },
      { label: 'Radiology', href: '/radiology', module: 'radiology', action: 'view' },
      { label: 'Radiology Reporting', href: '/radiology/reporting', module: 'radiology', action: 'report' },
      { label: 'Radiology Approval', href: '/radiology/approval', module: 'radiology', action: 'approve' },
    ],
  },
  {
    label: 'Finance',
    href: '/billing',
    icon: Receipt,
    children: [
      { label: 'Billing', href: '/billing', module: 'billing', action: 'view' },
      { label: 'New Invoice', href: '/billing/new', module: 'billing', action: 'create' },
      { label: 'Accounts', href: '/accounting', module: 'accounting', action: 'view' },
      { label: 'Journal Entry', href: '/accounting/journal', module: 'accounting', action: 'journal' },
      { label: 'Chart of Accounts', href: '/accounting/coa', module: 'accounting', action: 'view' },
      { label: 'Accounting Reports', href: '/accounting/reports', module: 'accounting', action: 'reports' },
    ],
  },
  {
    label: 'Pharmacy',
    href: '/pharmacy',
    icon: Pill,
    module: 'pharmacy',
    children: [
      { label: 'Sales', href: '/pharmacy/sale', module: 'pharmacy', action: 'sale' },
      { label: 'Purchase', href: '/pharmacy/purchase', module: 'pharmacy', action: 'purchase' },
      { label: 'Returns', href: '/pharmacy/returns', module: 'pharmacy', action: 'return' },
    ],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    module: 'inventory',
    children: [
      { label: 'Items', href: '/inventory/items', module: 'inventory', action: 'view' },
      { label: 'Purchase Orders', href: '/inventory/purchase-orders', module: 'inventory', action: 'view' },
      { label: 'Goods Receipt', href: '/inventory/goods-receipt', module: 'inventory', action: 'view' },
      { label: 'Issues', href: '/inventory/issues', module: 'inventory', action: 'view' },
      { label: 'Transfers', href: '/inventory/transfers', module: 'inventory', action: 'transfer' },
      { label: 'Adjustments', href: '/inventory/adjustments', module: 'inventory', action: 'adjust' },
    ],
  },
  {
    label: 'Doctors',
    href: '/masters/doctors',
    icon: Stethoscope,
    module: 'masters',
    children: [
      { label: 'Doctor Master', href: '/masters/doctors', module: 'masters', action: 'view' },
      { label: 'Schedules', href: '/masters/doctors/schedules', module: 'masters', action: 'view' },
      { label: 'Doctor Share Config', href: '/masters/doctors/shares', module: 'masters', action: 'view' },
      { label: 'Doctor Share Report', href: '/masters/doctors/share-report', module: 'masters', action: 'view' },
      { label: 'Doctor Statements', href: '/masters/doctors/settlements', module: 'masters', action: 'view' },
    ],
  },
  {
    label: 'Referrals',
    href: '/masters/referrals',
    icon: FileText,
    module: 'masters',
    children: [
      { label: 'Referral Sources', href: '/masters/referrals', module: 'masters', action: 'view' },
      { label: 'Referral Share Config', href: '/masters/referrals/share-config', module: 'masters', action: 'view' },
      { label: 'Referral Share Report', href: '/masters/referrals/share-report', module: 'masters', action: 'view' },
      { label: 'Referral Statements', href: '/masters/referrals/settlements', module: 'masters', action: 'view' },
      { label: 'Referral Partner Statement', href: '/masters/referrals/statement', module: 'masters', action: 'view' },
      { label: 'Corporate Clients', href: '/masters/corporates', module: 'masters', action: 'view' },
      { label: 'Panel Rates', href: '/masters/corporates/rates', module: 'masters', action: 'view' },
      { label: 'Panel Share Config', href: '/masters/corporates/shares', module: 'masters', action: 'view' },
      { label: 'Insurance Companies', href: '/masters/insurance', module: 'masters', action: 'view' },
    ],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    module: 'reports',
    children: [
      { label: 'Reports Dashboard', href: '/reports', module: 'reports', action: 'view' },
      { label: 'Daily Billing', href: '/reports/billing/daily', module: 'reports', action: 'view' },
      { label: 'Sales Report', href: '/reports/sales', module: 'reports', action: 'view' },
      { label: 'Daily Collection', href: '/reports/collection/daily', module: 'reports', action: 'view' },
      { label: 'Payment Methods', href: '/reports/collection/payment-methods', module: 'reports', action: 'view' },
      { label: 'Outstanding', href: '/reports/outstanding', module: 'reports', action: 'view' },
      { label: 'Patient Billing', href: '/reports/patients/billing', module: 'reports', action: 'view' },
      { label: 'Discount Report', href: '/reports/discount', module: 'reports', action: 'view' },
      { label: 'Service-wise Sales', href: '/reports/services/service-wise', module: 'reports', action: 'view' },
      { label: 'Department Revenue', href: '/reports/services/department-wise', module: 'reports', action: 'view' },
      { label: 'Doctor Performance', href: '/reports/doctors/performance', module: 'reports', action: 'view' },
      { label: 'Doctor Share Detail', href: '/reports/doctors/share-detail', module: 'reports', action: 'view' },
      { label: 'Doctor Share Summary', href: '/reports/doctors/share-summary', module: 'reports', action: 'view' },
      { label: 'Referral Performance', href: '/reports/referrals/performance', module: 'reports', action: 'view' },
      { label: 'Referral Share Detail', href: '/reports/referrals/share-detail', module: 'reports', action: 'view' },
      { label: 'Referral Share Summary', href: '/reports/referrals/share-summary', module: 'reports', action: 'view' },
      { label: 'Referral Statement', href: '/reports/referrals/statement', module: 'reports', action: 'view' },
      { label: 'Panel Billing', href: '/reports/panels/billing', module: 'reports', action: 'view' },
      { label: 'Panel Performance', href: '/reports/panels/performance', module: 'reports', action: 'view' },
      { label: 'Panel Share Detail', href: '/reports/panels/share-detail', module: 'reports', action: 'view' },
      { label: 'Panel Outstanding', href: '/reports/panels/outstanding', module: 'reports', action: 'view' },
      { label: 'Share Reports', href: '/reports/shares', module: 'reports', action: 'view' },
      { label: 'Revenue Summary', href: '/reports/management/revenue', module: 'reports', action: 'view' },
      { label: 'Management Summary', href: '/reports/management/summary', module: 'reports', action: 'view' },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: TrendingUp, module: 'reports', action: 'view' },
  {
    label: 'HR',
    href: '/hr',
    icon: UserCog,
    module: 'hr',
    children: [
      { label: 'Employees', href: '/hr', module: 'hr', action: 'view' },
      { label: 'Departments', href: '/masters/departments', module: 'masters', action: 'view' },
      { label: 'Designations', href: '/masters/designations', module: 'masters', action: 'view' },
      { label: 'Attendance', href: '/hr/attendance', module: 'hr', action: 'attendance' },
      { label: 'Biometric Machines', href: '/hr/biometric', module: 'hr', action: 'view' },
      { label: 'Payroll', href: '/hr/payroll', module: 'hr', action: 'payroll' },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    module: 'administration',
    children: [
      { label: 'Company', href: '/masters/companies', module: 'administration', action: 'companies' },
      { label: 'Branches', href: '/masters/branches', module: 'administration', action: 'branches' },
      { label: 'Services & Rates', href: '/masters/services', module: 'masters', action: 'view' },
      { label: 'Units & Categories', href: '/masters/units-categories', module: 'masters', action: 'view' },
      { label: 'Manufacturers', href: '/masters/manufacturers', module: 'masters', action: 'view' },
      { label: 'Suppliers', href: '/masters/suppliers', module: 'masters', action: 'view' },
      { label: 'Users', href: '/settings/users', module: 'administration', action: 'users' },
      { label: 'Roles & Permissions', href: '/settings/roles', module: 'administration', action: 'roles' },
      { label: 'Financial Years', href: '/administration/financial-years', module: 'administration', action: 'financial_years' },
      { label: 'Audit Logs', href: '/settings/audit', module: 'administration', action: 'audit' },
      { label: 'System Settings', href: '/settings', module: 'administration', action: 'settings' },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { appUser, signOut, loading } = useAuth();
  const { hasModule, has } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const saved = window.localStorage.getItem('nav-expanded');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const toggleModule = (href: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nav-expanded', JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  useEffect(() => {
    if (!pathname) return;
    const matching = NAV_ITEMS.filter(
      (item) => item.children && (pathname === item.href || pathname.startsWith(item.href + '/'))
    );
    if (matching.length > 0) {
      setExpandedModules((prev) => {
        const next = new Set(prev);
        matching.forEach((m) => next.add(m.href));
        return next;
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (!loading && !appUser) {
      router.replace('/login');
    }
  }, [loading, appUser, router]);

  useEffect(() => {
    (async () => {
      if (appUser?.company_id) {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('companies')
          .select('name')
          .eq('id', appUser.company_id)
          .maybeSingle();
        if (data) setCompanyName(data.name);
      }
    })();
  }, [appUser?.company_id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Stethoscope className="h-10 w-10 text-primary" />
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!appUser) return null;

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!item.module) return true;
    return hasModule(item.module);
  });

  const currentSection = (() => {
    const match = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
    return match?.label || 'Dashboard';
  })();

  const currentSubsection = (() => {
    for (const item of NAV_ITEMS) {
      if (item.children) {
        const child = item.children.find((c) => pathname === c.href || pathname.startsWith(c.href + '/'));
        if (child) return child.label;
      }
    }
    return null;
  })();

  const initials = appUser.full_name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Stethoscope className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight font-display tracking-wide">LABSTACK</p>
          {companyName && (
            <p className="truncate text-xs text-muted-foreground leading-tight">{companyName}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1">
        <nav className="px-3 py-3">
          {filteredNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const hasChildren = item.children && item.children.length > 0;
            const visibleChildren = hasChildren
              ? item.children!.filter((c) => !c.module || has(c.module!, c.action || 'view'))
              : [];

            if (hasChildren && visibleChildren.length === 0) return null;

            return (
              <div key={item.href} className="mb-0.5">
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleModule(item.href)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'group-hover:text-foreground')} />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                          expandedModules.has(item.href) ? 'rotate-180' : ''
                        )}
                      />
                    </button>
                    {expandedModules.has(item.href) && (
                      <div className="mt-0.5 space-y-0.5 pl-4">
                        {visibleChildren.map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-all',
                                childActive
                                  ? 'bg-primary/10 font-medium text-primary'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )}
                            >
                              <span className={cn('h-1 w-1 rounded-full transition-colors', childActive ? 'bg-primary' : 'bg-muted-foreground/40')} />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'group-hover:text-foreground')} />
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{appUser.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {appUser.role?.display_name || appUser.role?.name}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r bg-card md:block">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-sm md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden font-medium text-foreground sm:inline">{currentSection}</span>
            {currentSubsection && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-muted-foreground">{currentSubsection}</span>
              </>
            )}
          </div>
          <div className="flex-1" />
          {appUser.branch && (
            <div className="hidden items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm text-muted-foreground sm:flex">
              <Building2 className="h-3.5 w-3.5" />
              {appUser.branch.name}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
