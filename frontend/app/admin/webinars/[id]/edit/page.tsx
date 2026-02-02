'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Webinar {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  slug: string;
  scheduledAt: string;
  timezone: string;
  duration: number;
  mode: string;
  accentColor: string;
}

export default function EditWebinarPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    videoUrl: '',
    slug: '',
    scheduledAt: '',
    timezone: 'UTC',
    duration: 60,
    mode: 'RECORDED',
    accentColor: '#6366f1',
  });

  useEffect(() => {
    loadWebinar();
  }, [params.id]);

  const loadWebinar = async () => {
    try {
      const { webinar } = await api.getWebinar(params.id as string);
      setFormData({
        title: webinar.title,
        description: webinar.description || '',
        videoUrl: webinar.videoUrl || '',
        slug: webinar.slug,
        scheduledAt: webinar.scheduledAt,
        timezone: webinar.timezone,
        duration: webinar.duration,
        mode: webinar.mode,
        accentColor: webinar.accentColor,
      });
    } catch (error: any) {
      toast.error('Failed to load webinar');
      router.push('/admin/webinars');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateWebinar(params.id as string, formData);
      toast.success('Webinar updated successfully!');
      router.push(`/admin/webinars/${params.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update webinar');
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
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Webinar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <Input
              label="URL Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
            />

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />

            <Input
              label="Video URL"
              placeholder="https://example.com/video.mp4 or YouTube URL"
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date & Time"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                required
              />

              <Input
                label="Duration (minutes)"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit">Update Webinar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}