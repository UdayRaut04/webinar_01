import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getTimeUntil(date: Date | string): { days: number; hours: number; minutes: number; seconds: number } {
  const target = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getVideoUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Handle YouTube links - convert to embed format
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Extract video ID from various YouTube URL formats
    let videoId = '';
    let existingParams = '';
    
    if (url.includes('youtube.com/watch')) {
      const parts = url.split('?');
      const urlParams = new URLSearchParams(parts[1]);
      videoId = urlParams.get('v') || '';
      // Preserve existing parameters
      urlParams.delete('v');
      existingParams = urlParams.toString();
    } else if (url.includes('youtube.com/embed/')) {
      const parts = url.split('youtube.com/embed/')[1]?.split('?');
      videoId = parts?.[0] || '';
      existingParams = parts?.[1] || '';
    } else if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/')[1]?.split('?');
      videoId = parts?.[0] || '';
      existingParams = parts?.[1] || '';
    }
    
    if (videoId) {
      // Build embed URL with parameters
      const params = new URLSearchParams(existingParams);
      
      // Only add if not already present
      if (!params.has('hl')) params.set('hl', 'original');
      if (!params.has('cc_load_policy')) params.set('cc_load_policy', '0');
      
      const paramString = params.toString();
      return `https://www.youtube.com/embed/${videoId}${paramString ? '?' + paramString : ''}`;
    }
  }
  
  // Handle Google Drive links
  if (url.includes('drive.google.com')) {
    // Extract file ID from various Google Drive URL formats
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                        url.match(/id=([a-zA-Z0-9_-]+)/) ||
                        url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
    
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // Convert to direct download link
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  
  // Handle local absolute paths (Windows C:\ or Unix /)
  if (/^[a-zA-Z]:\\/.test(url) || /^[a-zA-Z]:\//.test(url) || (url.startsWith('/') && !url.startsWith('/uploads'))) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return `${baseUrl}/api/upload/local?path=${encodeURIComponent(url)}${token ? `&token=${token}` : ''}`;
  }

  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Check if URL is a YouTube video
export function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}
