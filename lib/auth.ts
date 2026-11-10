import { supabase } from './supabase';
import { Profile } from '@/types';

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, nama: string) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { nama: nama.trim() } },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Pembuatan akun gagal: Supabase tidak mengembalikan data pengguna.');

  // Email confirmation may mean no authenticated session exists yet. In that
  // case, let the database trigger create the profile from auth user metadata.
  if (!authData.session) return authData;

  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existingProfile) return authData;

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: authData.user.id, nama: nama.trim(), peran: 'masyarakat' });

  if (profileError) throw profileError;
  return authData;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
