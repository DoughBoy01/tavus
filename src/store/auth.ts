import { atom } from 'jotai';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

type UserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'public' | 'legal_admin' | 'system_admin';
  created_at: string;
  updated_at: string;
};

export const userSessionAtom = atom<Session | null>(null);
export const userProfileAtom = atom<UserProfile | null>(null);
export const isLoadingAtom = atom<boolean>(false);
export const authErrorAtom = atom<string | null>(null);

// Derived atoms
export const isAuthenticatedAtom = atom((get) => get(userSessionAtom) !== null);
export const isLegalAdminAtom = atom((get) => get(userProfileAtom)?.role === 'legal_admin');
export const isSystemAdminAtom = atom((get) => get(userProfileAtom)?.role === 'system_admin');

// Login atom
export const loginAtom = atom(
  null,
  async (_get, set, { email, password }: { email: string; password: string }) => {
    try {
      logger.debug('Attempting login', { email });
      if (!email || !password) {
        set(authErrorAtom, 'Email and password are required');
        return false;
      }

      set(isLoadingAtom, true);
      set(authErrorAtom, null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('Login error', error);
        set(authErrorAtom, 'Invalid email or password');
        return false;
      }

      logger.info('Login successful');
      set(userSessionAtom, data.session);

      // Fetch user profile
      if (data.session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) {
          logger.error('Error fetching profile after login', profileError);
          set(authErrorAtom, 'Error loading user profile');
          return false;
        }

        logger.debug('User profile loaded after login');
        set(userProfileAtom, profile);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Unexpected login error', error);
      set(authErrorAtom, 'Login failed due to an unexpected error');
      return false;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// Register atom
export const registerAtom = atom(
  null,
  async (
    _get,
    set,
    {
      email,
      password,
      firstName,
      lastName,
      role = 'public',
    }: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: 'public' | 'legal_admin' | 'system_admin';
    }
  ) => {
    try {
      logger.debug('Attempting registration', { email });
      set(isLoadingAtom, true);
      set(authErrorAtom, null);

      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        logger.error('Registration error', error);
        set(authErrorAtom, error.message);
        return false;
      }

      logger.info('Registration successful');

      // Create profile record
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role,
        });

        if (profileError) {
          logger.error('Error creating profile', profileError);
          set(authErrorAtom, profileError.message);
          return false;
        }

        set(userSessionAtom, data.session);
        set(userProfileAtom, {
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return true;
    } catch (error) {
      logger.error('Unexpected registration error', error);
      set(authErrorAtom, 'Registration failed due to an unexpected error');
      return false;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// Logout atom
export const logoutAtom = atom(null, async (_get, set) => {
  try {
    logger.debug('Attempting logout');
    await supabase.auth.signOut();
    logger.info('Logout successful');
    set(userSessionAtom, null);
    set(userProfileAtom, null);
    return true;
  } catch (error) {
    logger.error('Logout error', error);
    return false;
  }
});