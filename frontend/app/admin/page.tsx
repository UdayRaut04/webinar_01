'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    chatMessages: number;
  };
}

export default function AdminDashboard() {
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

  const stats = {
    total: webinars.length,
    live: webinars.filter(w => w.status === 'LIVE').length,
    scheduled: webinars.filter(w => w.status === 'SCHEDULED').length,
    registrations: webinars.reduce((acc, w) => acc + w._count.registrations, 0),
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/admin/webinars/new">
          <Button>Create Webinar</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Webinars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Live Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.live}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.registrations}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Webinars */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webinars</CardTitle>
        </CardHeader>
        <CardContent>
          {webinars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No webinars yet. Create your first webinar!</p>
              <Link href="/admin/webinars/new">
                <Button className="mt-4">Create Webinar</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {webinars.slice(0, 5).map((webinar) => (
                <div key={webinar.id} className="py-4 flex items-center justify-between">
                  <div>
                    <Link 
                      href={`/admin/webinars/${webinar.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {webinar.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {formatDate(webinar.scheduledAt)} • {webinar._count.registrations} registrations
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webinar.status)}`}>
                      {webinar.status}
                    </span>
                    <Link href={`/admin/webinars/${webinar.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
