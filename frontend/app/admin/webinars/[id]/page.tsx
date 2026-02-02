'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface Webinar {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  scheduledAt: string;
  mode: string;
  videoUrl: string;
  host: { name: string; email: string };
  state: { isLive: boolean; viewerCount: number };
  _count: { registrations: number; chatMessages: number };
}

export default function WebinarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadWebinar();
  }, [params.id]);

  const loadWebinar = async () => {
    try {
      const { webinar } = await api.getWebinar(params.id as string);
      setWebinar(webinar);
    } catch (error) {
      console.error('Failed to load webinar:', error);
      toast.error('Failed to load webinar');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.startWebinar(params.id as string);
      toast.success('Webinar started!');
      loadWebinar();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start webinar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await api.stopWebinar(params.id as string);
      toast.success('Webinar ended');
      loadWebinar();
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop webinar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this webinar?')) return;
    
    try {
      await api.deleteWebinar(params.id as string);
      toast.success('Webinar deleted');
      router.push('/admin/webinars');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete webinar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Webinar not found</h2>
        <Link href="/admin/webinars">
          <Button className="mt-4">Back to Webinars</Button>
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE': return 'bg-green-100 text-green-700';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-700';
      case 'ENDED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{webinar.title}</h1>
          <p className="text-gray-600">{formatDate(webinar.scheduledAt)}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(webinar.status)}`}>
            {webinar.status}
          </span>
          {webinar.status === 'SCHEDULED' && (
            <Button onClick={handleStart} loading={actionLoading}>
              Start Webinar
            </Button>
          )}
          {webinar.status === 'LIVE' && (
            <>
              <Link href={`/admin/webinars/${webinar.id}/live`}>
                <Button variant="outline">Control Panel</Button>
              </Link>
              <Button variant="destructive" onClick={handleStop} loading={actionLoading}>
                End Webinar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{webinar._count.registrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Chat Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{webinar._count.chatMessages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Current Viewers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{webinar.state?.viewerCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Mode</label>
              <p className="font-medium">{webinar.mode}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Public URL</label>
              <p className="font-medium text-primary">/webinar/{webinar.slug}/register</p>
            </div>
            {webinar.videoUrl && (
              <div>
                <label className="text-sm text-gray-600">Video URL</label>
                <p className="font-medium truncate">{webinar.videoUrl}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600">Description</label>
              <p className="text-gray-700">{webinar.description || 'No description'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
           <Link href={`/admin/webinars/${webinar.id}/edit`} className="block">
  <Button variant="outline" className="w-full">Edit Webinar</Button>
</Link>
            <Link href={`/admin/webinars/${webinar.id}/automations`} className="block">
              <Button variant="outline" className="w-full">Manage Automations</Button>
            </Link>
            <Link href={`/admin/webinars/${webinar.id}/chat`} className="block">
  <Button variant="outline" className="w-full">View & Moderate Chat</Button>
</Link>
            <Link href={`/webinar/${webinar.slug}/register`} target="_blank" className="block">
              <Button variant="outline" className="w-full">Preview Registration Page</Button>
            </Link>
            <Button variant="destructive" className="w-full" onClick={handleDelete}>
              Delete Webinar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
