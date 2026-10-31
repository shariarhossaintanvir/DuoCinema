import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getErrorMessage } from '@/lib/supabase';
import { AllowedUser } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  allowedUser: AllowedUser | null;
  isLoading: boolean;
  isAllowed: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [allowedUser, setAllowedUser] = useState<AllowedUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const verifyAllowlist = useCallback(async (currentUserId: string): Promise<AllowedUser | null> => {
    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('user_id, display_name, is_active, created_at, updated_at')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Error checking allowlist:', error.message);
        return null;
      }
      return data as AllowedUser | null;
    } catch (err) {
      console.warn('Allowlist query exception:', err);
      return null;
    }
  }, []);

  const handleSession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setUser(null);
      setSession(null);
      setAllowedUser(null);
      setIsLoading(false);
      return;
    }

    setSession(currentSession);
    setUser(currentSession.user);

    // Verify backend allowlist
    const profile = await verifyAllowlist(currentSession.user.id);
    if (!profile) {
      setAllowedUser(null);
      setAuthError('Access Denied: Your account is not on the private DuoCinema allowlist.');
      await supabase.auth.signOut();
    } else {
      setAllowedUser(profile);
      setAuthError(null);
    }
    setIsLoading(false);
  }, [verifyAllowlist]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted) {
        handleSession(initialSession);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        handleSession(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);

    if (!isSupabaseConfigured()) {
      const msg = 'Supabase credentials are not configured. Please see Setup instructions.';
      setAuthError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        const errorMsg = error.message === 'Invalid login credentials'
          ? 'Invalid email or password.'
          : error.message;
        setAuthError(errorMsg);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      if (!data.user) {
        const errorMsg = 'Failed to authenticate user.';
        setAuthError(errorMsg);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      const profile = await verifyAllowlist(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        const errorMsg = 'Access Denied: Your account is not on the private DuoCinema allowlist.';
        setAuthError(errorMsg);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      setUser(data.user);
      setSession(data.session);
      setAllowedUser(profile);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setAllowedUser(null);
      setAuthError(null);
      setIsLoading(false);
    }
  };

  const clearError = () => setAuthError(null);

  const value: AuthContextType = {
    user,
    session,
    allowedUser,
    isLoading,
    isAllowed: !!allowedUser,
    authError,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
