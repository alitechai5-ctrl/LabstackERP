'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Stethoscope, Building2, User, Settings, CheckCircle2, Loader2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const STEPS = ['Company', 'Branch', 'Super Admin', 'Settings', 'Confirm'] as const;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState({
    name: '',
    legal_name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    currency: 'PKR',
    currency_symbol: 'Rs',
    tax_percentage: '0',
  });

  const [branch, setBranch] = useState({
    name: '',
    code: 'HO',
    address: '',
    city: '',
    phone: '',
  });

  const [admin, setAdmin] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
  });

  const [settings, setSettings] = useState({
    fiscal_year_start: '1',
    invoice_prefix: 'INV',
    lab_sample_prefix: 'S',
    opd_token_prefix: 'OPD',
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, branch, admin, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');

      router.replace('/login');
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return company.name.trim() && company.currency.trim();
      case 1:
        return branch.name.trim() && branch.code.trim();
      case 2:
        return (
          admin.full_name.trim() &&
          admin.email.trim() &&
          admin.password.length >= 6 &&
          admin.password === admin.confirm
        );
      case 3:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Stethoscope className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">First Time Setup</h1>
          <p className="mt-2 text-muted-foreground">
            Configure your Healthcare ERP before first use
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-muted-foreground">
            <span>
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 0 && <><Building2 className="h-5 w-5" /> Company Information</>}
              {step === 1 && <><Building2 className="h-5 w-5" /> Main Branch</>}
              {step === 2 && <><User className="h-5 w-5" /> Super Admin Account</>}
              {step === 3 && <><Settings className="h-5 w-5" /> Default Settings</>}
              {step === 4 && <><CheckCircle2 className="h-5 w-5" /> Review & Confirm</>}
            </CardTitle>
            <CardDescription>
              {step === 0 && 'Enter your organization details'}
              {step === 1 && 'Set up your primary branch office'}
              {step === 2 && 'Create the super administrator account'}
              {step === 3 && 'Review default configuration'}
              {step === 4 && 'Confirm and complete setup'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0: Company */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    placeholder="e.g. City Diagnostic Center"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input
                    value={company.legal_name}
                    onChange={(e) => setCompany({ ...company, legal_name: e.target.value })}
                    placeholder="e.g. City Diagnostic Center (Pvt) Ltd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input
                      value={company.currency}
                      onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency Symbol</Label>
                    <Input
                      value={company.currency_symbol}
                      onChange={(e) => setCompany({ ...company, currency_symbol: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={company.phone}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax %</Label>
                    <Input
                      type="number"
                      value={company.tax_percentage}
                      onChange={(e) => setCompany({ ...company, tax_percentage: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Branch */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input
                    value={branch.name}
                    onChange={(e) => setBranch({ ...branch, name: e.target.value })}
                    placeholder="e.g. Main Branch"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch Code *</Label>
                  <Input
                    value={branch.code}
                    onChange={(e) => setBranch({ ...branch, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. HO"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={branch.address}
                    onChange={(e) => setBranch({ ...branch, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={branch.city}
                      onChange={(e) => setBranch({ ...branch, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={branch.phone}
                      onChange={(e) => setBranch({ ...branch, phone: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  This branch will be marked as Head Office. You can add more branches later.
                </p>
              </>
            )}

            {/* Step 2: Super Admin */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={admin.full_name}
                    onChange={(e) => setAdmin({ ...admin, full_name: e.target.value })}
                    placeholder="Administrator name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={admin.email}
                    onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                    placeholder="admin@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={admin.phone}
                    onChange={(e) => setAdmin({ ...admin, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password * (min 6 characters)</Label>
                  <Input
                    type="password"
                    value={admin.password}
                    onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <Input
                    type="password"
                    value={admin.confirm}
                    onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
                  />
                  {admin.password && admin.confirm && admin.password !== admin.confirm && (
                    <p className="text-sm text-destructive">Passwords do not match</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  This account will have full Super Admin privileges. After setup, public
                  registration is disabled and only the Super Admin can create new users.
                </p>
              </>
            )}

            {/* Step 3: Settings */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Fiscal Year Start Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={settings.fiscal_year_start}
                    onChange={(e) => setSettings({ ...settings, fiscal_year_start: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">Month number (1=January, 7=July)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Prefix</Label>
                    <Input
                      value={settings.invoice_prefix}
                      onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sample Prefix</Label>
                    <Input
                      value={settings.lab_sample_prefix}
                      onChange={(e) => setSettings({ ...settings, lab_sample_prefix: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>OPD Token Prefix</Label>
                  <Input
                    value={settings.opd_token_prefix}
                    onChange={(e) => setSettings({ ...settings, opd_token_prefix: e.target.value })}
                  />
                </div>
                <div className="rounded-md bg-muted p-4 text-sm">
                  <p className="mb-2 font-medium">The following will be created automatically:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>11 default departments (Clinical Chemistry, Hematology, Microbiology, etc.)</li>
                    <li>14 default designations</li>
                    <li>29 default Chart of Accounts entries</li>
                    <li>Current financial year</li>
                    <li>17 default system settings (inventory, OPD, lab, pharmacy, billing, accounting)</li>
                    <li>13 system roles with permissions</li>
                  </ul>
                </div>
              </>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="rounded-md bg-muted p-4">
                  <p className="mb-2 font-medium">Company</p>
                  <p className="text-sm text-muted-foreground">
                    {company.name} ({company.currency}) — {company.city}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <p className="mb-2 font-medium">Main Branch</p>
                  <p className="text-sm text-muted-foreground">
                    {branch.name} ({branch.code}) — {branch.city}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <p className="mb-2 font-medium">Super Admin</p>
                  <p className="text-sm text-muted-foreground">
                    {admin.full_name} — {admin.email}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <p className="mb-2 font-medium">Auto-created</p>
                  <p className="text-sm text-muted-foreground">
                    11 departments, 14 designations, 29 COA entries, financial year, 17 settings, 13 roles
                  </p>
                </div>
                <p className="text-sm font-medium text-center">
                  Click Complete Setup to initialize your system.
                </p>
              </div>
            )}
          </CardContent>
          <div className="flex justify-between p-6 pt-0">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
