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
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
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
  // Sign up user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed');

  // Create profile (peran akan default ke 'masyarakat' dari database)
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      nama,
      peran: 'masyarakat',
    });

  if (profileError) throw profileError;

  return authData;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
