'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface Webinar {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  host: { name: string };
  accentColor: string;
}

export default function WebinarRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [uniqueLink, setUniqueLink] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    consent: true,
  });

  useEffect(() => {
    loadWebinar();
  }, [params.slug]);

  const loadWebinar = async () => {
    try {
      const { webinar } = await api.getWebinarBySlug(params.slug as string);
      setWebinar(webinar);
    } catch (error) {
      console.error('Failed to load webinar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { registration } = await api.registerForWebinar(webinar!.id, formData);
      setRegistered(true);
      setUniqueLink(registration.uniqueLink);
      toast.success('Successfully registered!');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Webinar not found</h2>
            <p className="text-gray-600 mt-2">This webinar may have been removed or the link is incorrect.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">You&apos;re Registered!</h2>
            <p className="text-gray-600">
              We&apos;ve saved your spot for <strong>{webinar.title}</strong>
            </p>
            <p className="text-sm text-gray-500">
              {formatDate(webinar.scheduledAt)}
            </p>
            <div className="pt-4">
              <Button 
                className="w-full"
                style={{ backgroundColor: webinar.accentColor }}
                onClick={() => router.push(`/waiting-room/${uniqueLink}`)}
              >
                Go to Waiting Room
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              A confirmation email has been sent with your unique join link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: webinar.accentColor }}
            >
              <span className="text-white font-bold text-2xl">W</span>
            </div>
            <CardTitle className="text-2xl">{webinar.title}</CardTitle>
            <CardDescription>
              {formatDate(webinar.scheduledAt)}
              {webinar.host?.name && ` • Hosted by ${webinar.host.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {webinar.description && (
              <p className="text-gray-600 mb-6 text-center">{webinar.description}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="Email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              <Input
                label="Phone (Optional)"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-1"
                />
                <label htmlFor="consent" className="text-sm text-gray-600">
                  I agree to receive communications about this webinar and related content.
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                style={{ backgroundColor: webinar.accentColor }}
                loading={submitting}
              >
                Reserve My Spot
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
