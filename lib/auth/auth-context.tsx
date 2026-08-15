'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { AppUser, Permission } from '@/lib/types';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  const loadUserData = useCallback(async (uid: string) => {
    const { data: au, error } = await supabase
      .from('app_users')
      .select('*, role:roles(*)')
      .eq('auth_user_id', uid)
      .maybeSingle();

    if (error || !au) {
      setAppUser(null);
      setPermissions([]);
      return;
    }

    setAppUser(au as AppUser);

    const { data: rp } = await supabase
      .from('role_permissions')
      .select('permission:permissions(*)')
      .eq('role_id', au.role_id);

    const perms = (rp || [])
      .map((r: any) => r.permission)
      .filter(Boolean) as Permission[];
    setPermissions(perms);
  }, [supabase]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      await loadUserData(data.session.user.id);
    }
  }, [supabase, loadUserData]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadUserData(data.session.user.id);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadUserData(sess.user.id);
        } else {
          setAppUser(null);
          setPermissions([]);
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAppUser(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, appUser, permissions, loading, signIn, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useHasPermission(module: string, action: string): boolean {
  const { permissions, appUser } = useAuth();
  if (appUser?.role?.name === 'super_admin') return true;
  return permissions.some((p) => p.module === module && p.action === action);
}
