'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateSlug } from '@/lib/utils';

export default function NewWebinarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    scheduledAt: '',
    timezone: 'UTC',
    duration: '60',
    mode: 'RECORDED',
    videoUrl: '',
    accentColor: '#6366f1',
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { webinar } = await api.createWebinar({
        ...formData,
        duration: parseInt(formData.duration),
      });
      toast.success('Webinar created successfully!');
      router.push(`/admin/webinars/${webinar.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create webinar');
    } finally {
      setLoading(false);
    }
  };

  const timezones = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  ];

  const modes = [
    { value: 'RECORDED', label: 'Pre-recorded (Simulated Live)' },
    { value: 'LIVE', label: 'Live Streaming' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Webinar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Title"
              placeholder="My Amazing Webinar"
              value={formData.title}
              onChange={handleTitleChange}
              required
            />

            <Input
              label="URL Slug"
              placeholder="my-amazing-webinar"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
            />

            <Textarea
              label="Description"
              placeholder="What is this webinar about?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date & Time"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                required
              />

              <Select
                label="Timezone"
                options={timezones}
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Duration (minutes)"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              />

              <Select
                label="Webinar Mode"
                options={modes}
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
              />
            </div>

            {formData.mode !== 'LIVE' && (
              <Input
                label="Video URL"
                placeholder="https://example.com/video.mp4"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              />
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Accent Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Webinar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
