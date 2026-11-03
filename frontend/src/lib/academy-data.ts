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
  if (error) throw error;
  if (!identity.user) throw new Error('Authentication required');
  return client.from('profiles').select('*').eq('id', identity.user.id).single();
}
export async function updateOwnProfile(client: AcademyClient, patch: ProfilePatch) {
  const { data: identity, error } = await client.auth.getUser();
  if (error) throw error;
  if (!identity.user) throw new Error('Authentication required');
  return client.from('profiles').update(patch).eq('id', identity.user.id).select('*').single();
}

// Keep the existing Auth session and role. Only confirmed own-profile data is returned.
export async function saveAcademyProfile(
  client: AcademyClient,
  patch: ProfilePatch,
  registering: boolean,
) {
  const updated = await updateOwnProfile(client, patch);
  if (updated.error) throw updated.error;
  if (!updated.data) throw new Error('Profile unavailable');
  if (registering) {
    const completed = await client.rpc('complete_registration', {
      p_consent_version: 'registration-v1',
    });
    if (completed.error) throw completed.error;
  }
  const persisted = await loadOwnProfile(client);
  if (persisted.error) throw persisted.error;
  if (
    !persisted.data ||
    persisted.data.id !== updated.data.id ||
    (registering && !persisted.data.registered_at)
  )
    throw new Error('Registration persistence could not be verified');
  return persisted.data;
}
