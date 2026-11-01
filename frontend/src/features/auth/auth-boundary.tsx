import type { ReactNode } from 'react';
import { permitsRole, type AcademyRole } from './auth-store';
import { useAuth } from './use-auth';

// Presentation primitive only. RLS independently authorizes every data request.
export function AuthBoundary({
  allowedRoles,
  children,
  pending = null,
  denied = null,
}: {
  allowedRoles: readonly AcademyRole[];
  children: ReactNode;
  pending?: ReactNode;
  denied?: ReactNode;
}) {
  const state = useAuth();
  if (state.status === 'loading') return pending;
  return permitsRole(state, allowedRoles) ? children : denied;
}
