export type AcademyRole = 'student' | 'team';
export type VerifiedUser = { id: string; email: string | null; confirmed: boolean };
export type SessionIdentity = { userId: string };
export type AuthSnapshot = {
  status: 'unconfigured' | 'loading' | 'signed-out' | 'signed-in' | 'error';
  user: VerifiedUser | null;
  role: AcademyRole | null;
  error: 'verification_failed' | 'session_unavailable' | 'signout_failed' | null;
};
export type AuthPort = {
  getSession: () => Promise<SessionIdentity | null>;
  getVerifiedUser: () => Promise<VerifiedUser>;
  getRole: () => Promise<unknown>;
  onSession: (listener: (session: SessionIdentity | null) => void) => () => void;
  signOut: () => Promise<void>;
};

export function createAuthStore(port: AuthPort | null) {
  let snapshot: AuthSnapshot = {
    status: port ? 'loading' : 'unconfigured',
    user: null,
    role: null,
    error: null,
  };
  let active = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const set = (
    status: AuthSnapshot['status'],
    user: VerifiedUser | null = null,
    role: AcademyRole | null = null,
    error: AuthSnapshot['error'] = null,
  ) => {
    snapshot = { status, user, role, error };
    listeners.forEach((listener) => listener());
  };
  async function verify(session: SessionIdentity | null, ticket: number) {
    if (!active || ticket !== generation || !port) return;
    if (!session) {
      set('signed-out');
      return;
    }
    try {
      const user = await port.getVerifiedUser();
      if (!active || ticket !== generation) return;
      if (!user.confirmed || user.id !== session.userId) throw new Error('Verification failed');
      const role = await port.getRole();
      if (!active || ticket !== generation) return;
      if (role !== 'student' && role !== 'team') throw new Error('Role unavailable');
      set('signed-in', user, role);
    } catch {
      if (active && ticket === generation) set('error', null, null, 'verification_failed');
    }
  }
  async function refresh() {
    if (!active || !port) return;
    const ticket = ++generation;
    set('loading');
    try {
      await verify(await port.getSession(), ticket);
    } catch {
      if (active && ticket === generation) set('error', null, null, 'session_unavailable');
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (!port) return () => {};
      active = true;
      let unsubscribe = () => {};
      try {
        unsubscribe = port.onSession((session) => {
          if (!active) return;
          const ticket = ++generation;
          set(session ? 'loading' : 'signed-out');
          // Never await another SDK call inside onAuthStateChange's callback.
          if (session)
            queueMicrotask(() => {
              void verify(session, ticket);
            });
        });
        void refresh();
      } catch {
        set('error', null, null, 'session_unavailable');
      }
      return () => {
        active = false;
        generation++;
        unsubscribe();
      };
    },
    refresh,
    async signOut() {
      generation++;
      set(port ? 'signed-out' : 'unconfigured');
      try {
        await port?.signOut();
      } catch {
        set('error', null, null, 'signout_failed');
      }
    },
  };
}
export type AuthStore = ReturnType<typeof createAuthStore>;

export function permitsRole(snapshot: AuthSnapshot, allowedRoles: readonly AcademyRole[]) {
  return (
    snapshot.status === 'signed-in' &&
    snapshot.role !== null &&
    allowedRoles.includes(snapshot.role)
  );
}
