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
import { generateSlug, getVideoUrl } from '@/lib/utils';
import { useRef } from 'react';

export default function NewWebinarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      toast.error('File too large (max 500MB)');
      return;
    }

    setUploading(true);
    try {
      const { url } = await api.uploadFile(file);
      setFormData({ ...formData, videoUrl: url });
      toast.success('Video uploaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadLibrary = async () => {
    try {
      const { files } = await api.getUploadedFiles();
      setLibraryFiles(files);
      setShowLibrary(true);
    } catch (error: any) {
      toast.error('Failed to load library');
    }
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
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label="Video Source"
                      placeholder="https://example.com/video.mp4 or /uploads/..."
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="video/mp4,video/webm,video/ogg"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    Upload MP4
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadLibrary}
                  >
                    Library
                  </Button>
                </div>

                {showLibrary && (
                  <div className="p-4 border rounded bg-gray-50 max-h-48 overflow-y-auto space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold uppercase text-gray-500">Select from Server Library</p>
                      <button onClick={() => setShowLibrary(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
                    </div>
                    {libraryFiles.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No files in library</p>
                    ) : (
                      libraryFiles.map(file => (
                        <div 
                          key={file} 
                          className="flex justify-between items-center p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer text-sm"
                          onClick={() => {
                            setFormData({ ...formData, videoUrl: file });
                            setShowLibrary(false);
                          }}
                        >
                          <span className="truncate">{file.split('/').pop()}</span>
                          <span className="text-xs text-blue-500">Select</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {formData.videoUrl && (
                  <div className="mt-2 text-sm">
                    <p className="text-gray-500 mb-1">Preview:</p>
                    <video
                      src={getVideoUrl(formData.videoUrl)}
                      className="w-full aspect-video bg-black rounded border"
                      controls
                    />
                  </div>
                )}
              </div>
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
