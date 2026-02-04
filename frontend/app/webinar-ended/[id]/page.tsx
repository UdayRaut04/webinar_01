'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Webinar {
  id: string;
  title: string;
  description: string;
  host: { name: string };
}

export default function WebinarEndedPage() {
  const params = useParams();
  const router = useRouter();
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [endTimeReason, setEndTimeReason] = useState<string>('');

  useEffect(() => {
    loadWebinar();
    
    // Get end reason from URL params or localStorage
    const reason = new URLSearchParams(window.location.search).get('reason') || 
                   localStorage.getItem('webinarEndReason') || 
                   'Webinar has ended';
    setEndTimeReason(reason);
    
    // Clean up localStorage
    localStorage.removeItem('webinarEndReason');
  }, [params.id]);

  const loadWebinar = async () => {
    try {
      const { webinar } = await api.getWebinar(params.id as string);
      setWebinar(webinar);
    } catch (error) {
      console.error('Failed to load webinar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleViewOtherWebinars = () => {
    router.push('/'); // or to a webinars listing page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg 
              className="w-10 h-10 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Webinar Ended</h1>
        </div>

        {/* Webinar Info */}
        {webinar && (
          <div className="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">{webinar.title}</h2>
            <p className="text-gray-400 text-sm mb-4">
              Hosted by {webinar.host?.name || 'Admin'}
            </p>
            <div className="text-gray-500 text-sm">
              {endTimeReason}
            </div>
          </div>
        )}

        {/* Thank You Message */}
        <div className="mb-8">
          <p className="text-gray-300 text-lg mb-2">Thank you for attending!</p>
          <p className="text-gray-500 text-sm">
            We hope you enjoyed the session
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleGoHome}
            className="w-full bg-white text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Go to Homepage
          </button>
          <button
            onClick={handleViewOtherWebinars}
            className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors border border-gray-700"
          >
            View Other Webinars
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Webinar Platform
          </p>
        </div>
      </div>
    </div>
  );
}