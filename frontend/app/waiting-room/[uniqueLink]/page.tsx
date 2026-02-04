'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { getTimeUntil, formatDate } from '@/lib/utils';

interface Registration {
  id: string;
  name: string;
  webinar: {
    id: string;
    title: string;
    description: string;
    scheduledAt: string;
    status: string;
    accentColor: string;
    host: { name: string };
    state: { isLive: boolean };
  };
}

export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Disable right-click and F12
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    loadRegistration();
  }, [params.uniqueLink]);

  useEffect(() => {
    if (!registration) return;

    const interval = setInterval(() => {
      const time = getTimeUntil(registration.webinar.scheduledAt);
      setCountdown(time);

      // Check if webinar has started
      if (registration.webinar.status === 'LIVE' || registration.webinar.state?.isLive) {
        router.push(`/live/${registration.webinar.id}?link=${params.uniqueLink}`);
      }

      // Redirect when countdown reaches zero
      if (time.days === 0 && time.hours === 0 && time.minutes === 0 && time.seconds === 0) {
        checkStatus();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [registration, router, params.uniqueLink]);

  const loadRegistration = async () => {
    try {
      const { registration } = await api.getRegistration(params.uniqueLink as string);
      setRegistration(registration);

      // Redirect if webinar is already live
      if (registration.webinar.status === 'LIVE') {
        router.push(`/live/${registration.webinar.id}?link=${params.uniqueLink}`);
      }
    } catch (error) {
      console.error('Failed to load registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const { status, canJoin } = await api.getRegistrationStatus(params.uniqueLink as string);
      if (status === 'LIVE' || canJoin) {
        router.push(`/live/${registration?.webinar.id}?link=${params.uniqueLink}`);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <Card className="max-w-md bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold text-white">Invalid Link</h2>
            <p className="text-gray-400 mt-2">This registration link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { webinar } = registration;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#0f0f0f' }}
    >
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div 
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ backgroundColor: webinar.accentColor }}
        >
          <span className="text-white font-bold text-3xl">W</span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <p className="text-gray-400 text-sm uppercase tracking-wider">Starting Soon</p>
          <h1 className="text-4xl font-bold text-white">{webinar.title}</h1>
          {webinar.host?.name && (
            <p className="text-gray-400">Hosted by {webinar.host.name}</p>
          )}
        </div>

        {/* Countdown */}
        <div className="grid grid-cols-4 gap-4 max-w-md mx-auto">
          <CountdownUnit value={countdown.days} label="Days" color={webinar.accentColor} />
          <CountdownUnit value={countdown.hours} label="Hours" color={webinar.accentColor} />
          <CountdownUnit value={countdown.minutes} label="Minutes" color={webinar.accentColor} />
          <CountdownUnit value={countdown.seconds} label="Seconds" color={webinar.accentColor} />
        </div>

        {/* Info */}
        <div className="text-gray-400 space-y-2">
          <p>{formatDate(webinar.scheduledAt)}</p>
          <p className="text-sm">
            Welcome, <span className="text-white">{registration.name}</span>
          </p>
        </div>

        {/* Description */}
        {webinar.description && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <p className="text-gray-300">{webinar.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <div className="text-gray-500 text-sm">
          <p>Stay on this page. You&apos;ll be automatically redirected when the webinar starts.</p>
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div 
        className="text-4xl font-bold mb-1"
        style={{ color }}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-gray-500 text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
