'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface Webinar {
  id: string;
  title: string;
  slug: string;
  status: string;
  scheduledAt: string;
  mode: string;
  _count: {
    registrations: number;
  };
}

export default function WebinarsPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWebinars();
  }, []);

  const loadWebinars = async () => {
    try {
      const { webinars } = await api.getAdminWebinars();
      setWebinars(webinars);
    } catch (error) {
      console.error('Failed to load webinars:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE': return 'bg-green-100 text-green-700';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-700';
      case 'ENDED': return 'bg-gray-100 text-gray-700';
      case 'DRAFT': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Webinars</h1>
        <Link href="/admin/webinars/new">
          <Button>Create Webinar</Button>
        </Link>
      </div>

      {webinars.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No webinars yet</p>
            <Link href="/admin/webinars/new">
              <Button>Create Your First Webinar</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webinars.map((webinar) => (
            <Card key={webinar.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link 
                      href={`/admin/webinars/${webinar.id}`}
                      className="text-lg font-medium hover:text-primary"
                    >
                      {webinar.title}
                    </Link>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span>{formatDate(webinar.scheduledAt)}</span>
                      <span>{webinar._count.registrations} registrations</span>
                      <span className="uppercase text-xs">{webinar.mode}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(webinar.status)}`}>
                      {webinar.status}
                    </span>
                    <Link href={`/admin/webinars/${webinar.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
