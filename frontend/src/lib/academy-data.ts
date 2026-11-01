import type { AcademyClient } from './supabase';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'whatsapp'
    | 'major'
    | 'academic_year'
    | 'python_experience'
    | 'university_id'
    | 'locale'
  >
>;

// RLS remains authoritative; these helpers never accept another student's ID.
export async function loadOwnProfile(client: AcademyClient) {
  const { data: identity, error } = await client.auth.getUser();
  if (error || !identity.user) throw new Error('Authentication required');
  return client.from('profiles').select('*').eq('id', identity.user.id).single();
}
export async function updateOwnProfile(client: AcademyClient, patch: ProfilePatch) {
  const { data: identity, error } = await client.auth.getUser();
  if (error || !identity.user) throw new Error('Authentication required');
  return client.from('profiles').update(patch).eq('id', identity.user.id).select('*').single();
}
