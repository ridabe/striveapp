import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Tables } from '@/types/database';

type Student = Tables<'students'>;

export function useStudent() {
  const { profile } = useAuthStore();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) { setStudent(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('students')
      .select('*')
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => { setStudent(data ?? null); setLoading(false); });
  }, [profile?.id]);

  return { student, loading };
}
