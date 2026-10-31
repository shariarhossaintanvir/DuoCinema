import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RoomProvider } from '@/context/RoomContext';
import { Navbar } from '@/components/Navbar';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WatchRoomPage } from '@/pages/WatchRoomPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { isSupabaseConfigured } from '@/lib/supabase';

// Protected Route Guard
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAllowed, isLoading } = useAuth();

  // If Supabase is not configured yet, allow viewing the dashboard in setup-required preview mode
  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Checking authorization...</div>
      </div>
    );
  }

  if (!user || !isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1 }}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/room/:code"
                  element={
                    <RequireAuth>
                      <WatchRoomPage />
                    </RequireAuth>
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
