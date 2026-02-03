'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { useAuth } from '@/context/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime, getVideoUrl } from '@/lib/utils';
import { useMemo } from 'react';

interface Message {
  id: string;
  senderName: string;
  content: string;
  isPinned: boolean;
  isAutomated: boolean;
}

export default function AdminLiveControlPage() {
  const params = useParams();
  const { user } = useAuth();
  const [webinar, setWebinar] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ctaForm, setCtaForm] = useState({
    title: 'Special Offer!',
    description: 'Get 20% off when you sign up today.',
    buttonText: 'Claim Offer',
    buttonUrl: '',
    duration: 30,
  });
  const [chatMessage, setChatMessage] = useState('');
    
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = useMemo(() => getVideoUrl(webinar?.videoUrl), [webinar?.videoUrl]);
  
  useEffect(() => {
    loadData();
    
    return () => {
      socketClient.disconnect();
    };
  }, [params.id]);

  const loadData = async () => {
    try {
      const [webinarRes, chatRes] = await Promise.all([
        api.getWebinar(params.id as string),
        api.getWebinarChat(params.id as string),
      ]);
      
      setWebinar(webinarRes.webinar);
      setMessages(chatRes.messages);

      // Connect as admin
      const token = api.getToken();
      socketClient.connect({ token });
      socketClient.joinWebinar(params.id as string);
      setupSocketListeners();
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load webinar data');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketClient.on('webinar:state', (data) => {
      if (data.viewerCount) setViewerCount(data.viewerCount);
      if (data.currentTimestamp) setCurrentTime(data.currentTimestamp);
    });

    socketClient.on('webinar:viewers', (data) => {
      setViewerCount(data.count);
    });

    socketClient.on('webinar:sync', (data) => {
      setCurrentTime(data.currentTimestamp);
    });

    socketClient.on('chat:message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketClient.on('chat:deleted', (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });
  };

  const handleSendCTA = async () => {
    try {
      await api.broadcastCTA(params.id as string, ctaForm);
      toast.success('CTA broadcasted to all viewers');
    } catch (error: any) {
      toast.error(error.message || 'Failed to broadcast CTA');
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      await api.pinMessage(messageId);
      toast.success('Message pinned');
      setMessages((prev) =>
        prev.map((m) => ({ ...m, isPinned: m.id === messageId }))
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to pin message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      toast.success('Message deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete message');
    }
  };

  const handleSendAdminMessage = () => {
    if (!chatMessage.trim()) return;
    socketClient.sendMessage(chatMessage.trim());
    setChatMessage('');
  };

  const handleStopWebinar = async () => {
    if (!confirm('Are you sure you want to end this webinar?')) return;
    
    try {
      await api.stopWebinar(params.id as string);
      toast.success('Webinar ended');
      setWebinar((prev: any) => ({ ...prev, status: 'ENDED' }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop webinar');
    }
  };

  const syncPlayback = async () => {
    if (videoRef.current) {
      await api.syncWebinar(params.id as string, Math.floor(videoRef.current.currentTime));
      toast.success('Playback synced');
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
    return <div className="text-center py-12">Webinar not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{webinar.title}</h1>
          <p className="text-gray-600">Live Control Panel</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
            LIVE
          </span>
          <span className="text-sm text-gray-600">{viewerCount} viewers</span>
          <Button variant="destructive" onClick={handleStopWebinar}>
            End Webinar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="relative aspect-video bg-black rounded-t-xl overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  src={videoUrl}
                  controls
                />
                <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/50 text-white text-sm rounded">
                  {formatTime(currentTime)}
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Control the video playback. All viewers will be synced.
                </span>
                <Button size="sm" onClick={syncPlayback}>
                  Sync All Viewers
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CTA Broadcast */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Broadcast CTA Popup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Title"
                  value={ctaForm.title}
                  onChange={(e) => setCtaForm({ ...ctaForm, title: e.target.value })}
                />
                <Input
                  label="Button Text"
                  value={ctaForm.buttonText}
                  onChange={(e) => setCtaForm({ ...ctaForm, buttonText: e.target.value })}
                />
              </div>
              <Input
                label="Description"
                value={ctaForm.description}
                onChange={(e) => setCtaForm({ ...ctaForm, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Button URL"
                  value={ctaForm.buttonUrl}
                  onChange={(e) => setCtaForm({ ...ctaForm, buttonUrl: e.target.value })}
                />
                <Input
                  label="Duration (seconds)"
                  type="number"
                  value={ctaForm.duration.toString()}
                  onChange={(e) => setCtaForm({ ...ctaForm, duration: parseInt(e.target.value) || 30 })}
                />
              </div>
              <Button onClick={handleSendCTA} className="w-full">
                Broadcast CTA to All Viewers
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Chat Moderation */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Chat Moderation</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Admin message */}
            <div className="flex space-x-2 mb-4">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Send as admin..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendAdminMessage()}
              />
              <Button onClick={handleSendAdminMessage}>Send</Button>
            </div>

            {/* Messages */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.slice(-50).map((message) => (
                <div
                  key={message.id}
                  className={`p-2 rounded text-sm ${
                    message.isPinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`font-medium ${message.isAutomated ? 'text-yellow-600' : 'text-blue-600'}`}>
                        {message.senderName}
                      </span>
                      <p className="text-gray-700">{message.content}</p>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handlePinMessage(message.id)}
                        className="text-xs text-gray-500 hover:text-yellow-600"
                        title="Pin"
                      >
                        📌
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="text-xs text-gray-500 hover:text-red-600"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
