'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { session, appUser, loading } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('system_status')
        .select('setup_complete')
        .eq('id', 1)
        .maybeSingle();

      setSetupComplete(data?.setup_complete ?? false);
      setCheckingSetup(false);
    })();
  }, []);

  useEffect(() => {
    if (checkingSetup || loading) return;
    if (!setupComplete) {
      router.replace('/setup');
    } else if (!session) {
      router.replace('/login');
    } else if (appUser) {
      router.replace('/dashboard');
    }
  }, [checkingSetup, loading, setupComplete, session, appUser, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
