'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVideoUrl, isYouTubeUrl } from '@/lib/utils';
import { useRef } from 'react';

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
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
                  {formData.videoUrl.includes('drive.google.com') && (
                    <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      ⚠️ <strong>Google Drive Notice:</strong> Ensure the file is set to "Anyone with the link can view" for it to work. 
                      For best results, consider uploading the video directly or using a dedicated video hosting service.
                    </div>
                  )}
                  {isYouTubeUrl(formData.videoUrl) ? (
                    <iframe
                      src={getVideoUrl(formData.videoUrl)}
                      className="w-full aspect-video bg-black rounded border"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={getVideoUrl(formData.videoUrl)}
                      className="w-full aspect-video bg-black rounded border"
                      controls
                      onError={(e) => {
                        const target = e.target as HTMLVideoElement;
                        console.error('Video load error:', target.error);
                      }}
                    />
                  )}
                </div>
              )}
            </div>

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