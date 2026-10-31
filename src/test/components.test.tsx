import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SetupRequiredBanner } from '@/components/SetupRequiredBanner';
import { RecentSessionsList } from '@/components/RecentSessionsList';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';
import { RoomProvider } from '@/context/RoomContext';

describe('DuoCinema UI Components', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders SetupRequiredBanner when Supabase is not configured', () => {
    render(<SetupRequiredBanner />);
    expect(screen.getByText(/Supabase Configuration Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Environment Variables/i)).toBeInTheDocument();
  });

  it('renders and manages RecentSessionsList from localStorage', () => {
    const mockSessions = [
      {
        roomCode: 'ABCD1234',
        roomName: 'Movie Night Test',
        lastVisited: new Date().toISOString(),
        mediaTitle: 'TestMovie.mp4',
      },
    ];
    localStorage.setItem('duocinema_recent_sessions_v1', JSON.stringify(mockSessions));

    const onSelect = vi.fn();
    render(<RecentSessionsList onSelectRoom={onSelect} />);

    expect(screen.getByText('Movie Night Test')).toBeInTheDocument();
    expect(screen.getByText(/ABCD1234/)).toBeInTheDocument();

    // Click room card
    fireEvent.click(screen.getByText('Movie Night Test'));
    expect(onSelect).toHaveBeenCalledWith('ABCD1234');
  });

  it('renders Navbar with brand and navigation links', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <RoomProvider>
            <Navbar />
          </RoomProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('DuoCinema')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});
