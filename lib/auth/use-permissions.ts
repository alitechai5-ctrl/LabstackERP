'use client';

import { useAuth } from '@/lib/auth/auth-context';

export function usePermissions() {
  const { permissions, appUser } = useAuth();

  const has = (module: string, action: string): boolean => {
    if (appUser?.role?.name === 'super_admin') return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const hasAny = (module: string, actions: string[]): boolean => {
    return actions.some((a) => has(module, a));
  };

  const hasModule = (module: string): boolean => {
    if (appUser?.role?.name === 'super_admin') return true;
    return permissions.some((p) => p.module === module);
  };

  return { has, hasAny, hasModule, permissions };
}
