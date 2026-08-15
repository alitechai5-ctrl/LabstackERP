'use client';

import { useAuth } from '@/lib/auth/auth-context';

export function useCompanyId() {
  const { appUser } = useAuth();
  return appUser?.company_id;
}

export function useBranchId() {
  const { appUser } = useAuth();
  return appUser?.branch_id;
}
