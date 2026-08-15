import type { Service } from '@/lib/types';

export type ShareType = 'percentage' | 'fixed';
export type CalculationBasis = 'total_amount' | 'net_amount' | 'total_minus_discount' | 'cash' | 'total_minus_share';
export type DoctorType = 'opd_doctor' | 'performing_doctor';
export type ShareFor = 'performing_doctor' | 'opd_doctor' | 'referral_doctor' | 'referral_person';

export type ShareRule = {
  id: string;
  share_for: string;
  doctor_id: string | null;
  doctor_type: string | null;
  referral_source_id: string | null;
  corporate_client_id: string | null;
  department_id: string | null;
  service_id: string | null;
  service_category: string | null;
  share_type: string;
  share_value: number;
  calculation_basis: string;
  effective_date: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  in_source_share_type: string | null;
  in_source_share_value: number | null;
  in_source_calculation_basis: string | null;
  out_source_share_type: string | null;
  out_source_share_value: number | null;
  out_source_calculation_basis: string | null;
};

export type PanelShareRule = {
  id: string;
  corporate_client_id: string;
  department_id: string | null;
  section_id: string | null;
  service_id: string | null;
  share_type: string;
  share_value: number;
  calculation_basis: string;
  effective_date: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
};

export type TransactionContext = {
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  cash_amount: number;
  doctor_share_amount: number;
  referral_share_amount: number;
};

export type ShareResult = {
  service_id: string;
  service_name: string;
  share_type: ShareType;
  share_amount: number;
  calculation_basis: CalculationBasis;
  share_percentage?: number;
  rule_id?: string;
};

export type ReferralShareResult = {
  service_id: string;
  service_name: string;
  in_source: ShareResult;
  out_source: ShareResult;
  total_referral_share: number;
};

export const BASIS_OPTIONS: { value: CalculationBasis; label: string }[] = [
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'net_amount', label: 'Net Amount' },
  { value: 'total_minus_discount', label: 'Total minus Discount' },
  { value: 'cash', label: 'Cash Collected' },
  { value: 'total_minus_share', label: 'Total minus Share' },
];

export function getBasisAmount(basis: string, ctx: TransactionContext): number {
  switch (basis) {
    case 'total_amount': return ctx.gross_amount;
    case 'net_amount': return ctx.net_amount;
    case 'total_minus_discount': return Math.max(0, ctx.gross_amount - ctx.discount_amount);
    case 'cash': return ctx.cash_amount;
    case 'total_minus_share': return Math.max(0, ctx.gross_amount - ctx.doctor_share_amount - ctx.referral_share_amount);
    default: return ctx.net_amount;
  }
}

export function calculateShareAmount(
  shareType: string,
  shareValue: number,
  basis: string,
  ctx: TransactionContext,
): { amount: number; percentage: number | undefined } {
  if (shareType === 'fixed') {
    return { amount: Math.max(0, Number(shareValue) || 0), percentage: undefined };
  }
  const base = getBasisAmount(basis, ctx);
  const pct = Number(shareValue) || 0;
  const amount = Math.round((base * pct) / 100 * 100) / 100;
  return { amount, percentage: pct };
}

export function findMatchingRule(
  rules: ShareRule[],
  shareFor: string,
  opts: {
    doctorId?: string | null;
    referralSourceId?: string | null;
    serviceId?: string;
    serviceCategory?: string;
    departmentId?: string | null;
    corporateClientId?: string | null;
    doctorType?: string | null;
  },
): ShareRule | null {
  const filtered = rules.filter((r) => {
    if (r.share_for !== shareFor) return false;
    if (!r.is_active) return false;
    if (opts.doctorId && r.doctor_id && r.doctor_id !== opts.doctorId) return false;
    if (opts.referralSourceId && r.referral_source_id && r.referral_source_id !== opts.referralSourceId) return false;
    if (opts.corporateClientId && r.corporate_client_id && r.corporate_client_id !== opts.corporateClientId) return false;
    if (opts.doctorType && r.doctor_type && r.doctor_type !== opts.doctorType) return false;
    if (opts.serviceId && r.service_id && r.service_id !== opts.serviceId) return false;
    if (opts.serviceCategory && r.service_category && r.service_category !== opts.serviceCategory) return false;
    if (opts.departmentId && r.department_id && r.department_id !== opts.departmentId) return false;
    return true;
  });
  filtered.sort((a, b) => b.priority - a.priority);
  return filtered[0] ?? null;
}

export function findMatchingPanelRule(
  rules: PanelShareRule[],
  corporateClientId: string,
  opts: {
    serviceId?: string;
    departmentId?: string | null;
    sectionId?: string | null;
  },
): PanelShareRule | null {
  const filtered = rules.filter((r) => {
    if (!r.is_active) return false;
    if (r.corporate_client_id !== corporateClientId) return false;
    if (opts.serviceId && r.service_id && r.service_id !== opts.serviceId) return false;
    if (opts.departmentId && r.department_id && r.department_id !== opts.departmentId) return false;
    if (opts.sectionId && r.section_id && r.section_id !== opts.sectionId) return false;
    return true;
  });
  filtered.sort((a, b) => b.priority - a.priority);
  return filtered[0] ?? null;
}

export function computeDoctorShareFromRule(
  rule: ShareRule,
  service: Service,
  ctx: TransactionContext,
): ShareResult {
  const { amount, percentage } = calculateShareAmount(rule.share_type, rule.share_value, rule.calculation_basis, ctx);
  return {
    service_id: service.id,
    service_name: service.name,
    share_type: rule.share_type as ShareType,
    share_amount: amount,
    calculation_basis: rule.calculation_basis as CalculationBasis,
    share_percentage: percentage,
    rule_id: rule.id,
  };
}

export function computeReferralShareFromRule(
  rule: ShareRule,
  service: Service,
  ctx: TransactionContext,
  sourceType: 'in_source' | 'out_source',
): ShareResult {
  const stype = sourceType === 'in_source' ? rule.in_source_share_type : rule.out_source_share_type;
  const sval = sourceType === 'in_source' ? (rule.in_source_share_value ?? 0) : (rule.out_source_share_value ?? 0);
  const sbasis = sourceType === 'in_source' ? (rule.in_source_calculation_basis ?? 'net_amount') : (rule.out_source_calculation_basis ?? 'net_amount');
  const effectiveType = stype || rule.share_type;
  const effectiveVal = (stype != null && sval != null) ? sval : rule.share_value;
  const effectiveBasis = sbasis || rule.calculation_basis;
  const { amount, percentage } = calculateShareAmount(effectiveType, effectiveVal, effectiveBasis, ctx);
  return {
    service_id: service.id,
    service_name: service.name,
    share_type: effectiveType as ShareType,
    share_amount: amount,
    calculation_basis: effectiveBasis as CalculationBasis,
    share_percentage: percentage,
    rule_id: rule.id,
  };
}

export function computePanelShareFromRule(
  rule: PanelShareRule,
  service: Service,
  ctx: TransactionContext,
): ShareResult {
  const { amount, percentage } = calculateShareAmount(rule.share_type, rule.share_value, rule.calculation_basis, ctx);
  return {
    service_id: service.id,
    service_name: service.name,
    share_type: rule.share_type as ShareType,
    share_amount: amount,
    calculation_basis: rule.calculation_basis as CalculationBasis,
    share_percentage: percentage,
    rule_id: rule.id,
  };
}

// Legacy helpers (still used by billing page until fully migrated)
export function computeDoctorShare(
  service: Service,
  netPrice: number,
): ShareResult {
  if (service.doctor_share_type === 'fixed') {
    return {
      service_id: service.id,
      service_name: service.name,
      share_type: 'fixed',
      share_amount: Number(service.doctor_share) || 0,
      calculation_basis: 'net_amount',
    };
  }
  const pct = Number(service.doctor_share) || 0;
  return {
    service_id: service.id,
    service_name: service.name,
    share_type: 'percentage',
    share_amount: Math.round((netPrice * pct) / 100 * 100) / 100,
    calculation_basis: 'net_amount',
    share_percentage: pct,
  };
}

export function computeReferralShare(
  service: Service,
  netPrice: number,
): ShareResult {
  if (service.referral_share_type === 'fixed') {
    return {
      service_id: service.id,
      service_name: service.name,
      share_type: 'fixed',
      share_amount: Number(service.referral_share) || 0,
      calculation_basis: 'net_amount',
    };
  }
  const pct = Number(service.referral_share) || 0;
  return {
    service_id: service.id,
    service_name: service.name,
    share_type: 'percentage',
    share_amount: Math.round((netPrice * pct) / 100 * 100) / 100,
    calculation_basis: 'net_amount',
    share_percentage: pct,
  };
}

export function netPricePerService(
  services: Service[],
  totalDiscount: number,
  priceFor?: (s: Service) => number,
): Map<string, number> {
  const pf = priceFor ?? ((s: Service) => Number(s.price));
  const total = services.reduce((sum, s) => sum + pf(s), 0);
  const map = new Map<string, number>();
  for (const s of services) {
    const price = pf(s);
    const proportion = total > 0 ? price / total : 0;
    const lineDiscount = totalDiscount * proportion;
    map.set(s.id, Math.max(0, price - lineDiscount));
  }
  return map;
}

export function computeShareForCart(
  services: Service[],
  cartPrices: Map<string, number>,
  totalDiscount: number,
  cashAmount: number,
  shareRules: ShareRule[],
  opts: {
    doctorId?: string | null;
    referralSourceId?: string | null;
    corporateClientId?: string | null;
    doctorType?: string | null;
  },
): {
  doctorShares: ShareResult[];
  referralInSourceShares: ShareResult[];
  referralOutSourceShares: ShareResult[];
  totalDoctorShare: number;
  totalReferralShare: number;
} {
  const netPrices = netPricePerService(services, totalDiscount, (s) => cartPrices.get(s.id) ?? Number(s.price));
  const doctorShares: ShareResult[] = [];
  const referralInSourceShares: ShareResult[] = [];
  const referralOutSourceShares: ShareResult[] = [];

  let totalDoctorShare = 0;
  let totalReferralShare = 0;

  for (const svc of services) {
    const netPrice = netPrices.get(svc.id) ?? Number(svc.price);
    const gross = cartPrices.get(svc.id) ?? Number(svc.price);
    const ctx: TransactionContext = {
      gross_amount: gross,
      discount_amount: totalDiscount,
      net_amount: netPrice,
      cash_amount: cashAmount,
      doctor_share_amount: 0,
      referral_share_amount: 0,
    };

    // Doctor share
    const docRule = findMatchingRule(shareRules, opts.doctorType || 'performing_doctor', {
      doctorId: opts.doctorId,
      serviceId: svc.id,
      serviceCategory: svc.category,
      corporateClientId: opts.corporateClientId,
      doctorType: opts.doctorType,
    });
    if (docRule) {
      const result = computeDoctorShareFromRule(docRule, svc, ctx);
      if (result.share_amount > 0) {
        doctorShares.push(result);
        totalDoctorShare += result.share_amount;
        ctx.doctor_share_amount = result.share_amount;
      }
    } else {
      // Fallback to service-level share
      const legacy = computeDoctorShare(svc, netPrice);
      if (legacy.share_amount > 0) {
        doctorShares.push(legacy);
        totalDoctorShare += legacy.share_amount;
        ctx.doctor_share_amount = legacy.share_amount;
      }
    }

    // Referral share
    if (opts.referralSourceId) {
      const refRule = findMatchingRule(shareRules, 'referral_person', {
        referralSourceId: opts.referralSourceId,
        serviceId: svc.id,
        serviceCategory: svc.category,
        corporateClientId: opts.corporateClientId,
      });
      if (refRule) {
        const inResult = computeReferralShareFromRule(refRule, svc, ctx, 'in_source');
        const outResult = computeReferralShareFromRule(refRule, svc, ctx, 'out_source');
        if (inResult.share_amount > 0) {
          referralInSourceShares.push(inResult);
          totalReferralShare += inResult.share_amount;
          ctx.referral_share_amount += inResult.share_amount;
        }
        if (outResult.share_amount > 0) {
          referralOutSourceShares.push(outResult);
          totalReferralShare += outResult.share_amount;
          ctx.referral_share_amount += outResult.share_amount;
        }
      } else {
        const legacy = computeReferralShare(svc, netPrice);
        if (legacy.share_amount > 0) {
          referralOutSourceShares.push(legacy);
          totalReferralShare += legacy.share_amount;
          ctx.referral_share_amount += legacy.share_amount;
        }
      }
    }
  }

  return {
    doctorShares,
    referralInSourceShares,
    referralOutSourceShares,
    totalDoctorShare: Math.round(totalDoctorShare * 100) / 100,
    totalReferralShare: Math.round(totalReferralShare * 100) / 100,
  };
}

export function computePanelShareForCart(
  services: Service[],
  cartPrices: Map<string, number>,
  totalDiscount: number,
  cashAmount: number,
  panelShareRules: PanelShareRule[],
  corporateClientId: string,
): { panelShares: ShareResult[]; totalPanelShare: number } {
  const netPrices = netPricePerService(services, totalDiscount, (s) => cartPrices.get(s.id) ?? Number(s.price));
  const panelShares: ShareResult[] = [];
  let totalPanelShare = 0;

  for (const svc of services) {
    const netPrice = netPrices.get(svc.id) ?? Number(svc.price);
    const gross = cartPrices.get(svc.id) ?? Number(svc.price);
    const ctx: TransactionContext = {
      gross_amount: gross,
      discount_amount: totalDiscount,
      net_amount: netPrice,
      cash_amount: cashAmount,
      doctor_share_amount: 0,
      referral_share_amount: 0,
    };

    const rule = findMatchingPanelRule(panelShareRules, corporateClientId, {
      serviceId: svc.id,
    });
    if (rule) {
      const result = computePanelShareFromRule(rule, svc, ctx);
      if (result.share_amount > 0) {
        panelShares.push(result);
        totalPanelShare += result.share_amount;
      }
    }
  }

  return { panelShares, totalPanelShare: Math.round(totalPanelShare * 100) / 100 };
}

export function computePriority(
  entityId: string | null,
  serviceId: string | null,
  deptId: string | null,
  sectionId: string | null,
  category: string | null,
): number {
  let p = 0;
  if (entityId) p += 100;
  if (serviceId) p += 10;
  else if (sectionId) p += 7;
  else if (category) p += 5;
  else if (deptId) p += 3;
  return p;
}

export function validateShareValue(shareType: string, value: number): string | null {
  if (isNaN(value) || value < 0) return 'Share value cannot be negative';
  if (shareType === 'percentage' && value > 100) return 'Percentage cannot exceed 100';
  return null;
}
