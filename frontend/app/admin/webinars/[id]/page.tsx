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
  _count: { registrations: number; chatMessages: number; automations: number };
}

interface Message {
  id: string;
  content: string;
  senderName: string;
  timestamp: number;
  createdAt: string;
  isPinned: boolean;
  isAutomated: boolean;
}

export default function WebinarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [showAutomated, setShowAutomated] = useState(false); // Show legitimate only by default
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChatManagement, setShowChatManagement] = useState(false);

  useEffect(() => {
    loadWebinar();
  }, [params.id]);

  useEffect(() => {
    if (showChatManagement) {
      loadChat();
    }
  }, [showChatManagement, params.id]);

  useEffect(() => {
    if (showAutomated) {
      setFilteredMessages(messages);
    } else {
      // Filter out automated messages (legitimate chats only)
      setFilteredMessages(messages.filter(msg => !msg.isAutomated));
    }
  }, [messages, showAutomated]);

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

  const loadChat = async () => {
    try {
      const { messages } = await api.getWebinarChat(params.id as string);
      setMessages(messages);
    } catch (error) {
      console.error('Failed to load chat:', error);
      toast.error('Failed to load chat messages');
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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      // Remove message from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      await api.pinMessage(messageId);
      toast.success('Message pinned');
      loadChat(); // Refresh to get updated pinned status
    } catch (error) {
      console.error('Failed to pin message:', error);
      toast.error('Failed to pin message');
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    try {
      await api.unpinMessage(messageId);
      toast.success('Message unpinned');
      loadChat(); // Refresh to get updated pinned status
    } catch (error) {
      console.error('Failed to unpin message:', error);
      toast.error('Failed to unpin message');
    }
  };

  // Function to download filtered chat data as CSV
  const downloadFilteredChats = () => {
    const legitimateMessages = filteredMessages.filter(msg => !msg.isAutomated);
    if (legitimateMessages.length === 0) {
      toast.error('No legitimate messages to download');
      return;
    }

    const csvContent = [
      ['ID', 'Sender Name', 'Content', 'Created At'],
      ...legitimateMessages.map(msg => [
        msg.id,
        `"${msg.senderName.replace(/"/g, '""')}"`,
        `"${msg.content.replace(/"/g, '""')}"`,
        msg.createdAt,
      ])
    ]
    .map(row => row.join(','))
    .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `legitimate-chats-${params.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Downloaded ${legitimateMessages.length} legitimate messages`);
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
            <CardTitle className="text-sm text-gray-600">Automations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{webinar._count.automations}</div>
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
            
            {/* Chat Management Section in Actions */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Chat Management</h3>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowChatManagement(!showChatManagement)}
              >
                {showChatManagement ? "Hide Chat Management" : "Show Chat Management"}
              </Button>
              
              {showChatManagement && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Chat Controls */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={!showAutomated ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAutomated(false)}
                    >
                      Legitimate Only
                    </Button>
                    <Button
                      variant={showAutomated ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAutomated(true)}
                    >
                      Show All
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={downloadFilteredChats}
                      disabled={filteredMessages.filter(msg => !msg.isAutomated).length === 0}
                    >
                      Download ({filteredMessages.filter(msg => !msg.isAutomated).length})
                    </Button>
                  </div>

                  {/* Chat Preview/Stats */}
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total Messages:</span>
                      <span className="font-medium">{messages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Legitimate Chats:</span>
                      <span className="font-medium">{messages.filter(msg => !msg.isAutomated).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Automated Messages:</span>
                      <span className="font-medium">{messages.filter(msg => msg.isAutomated).length}</span>
                    </div>
                  </div>

                  {/* Recent Messages Preview */}
                  {filteredMessages.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 text-sm space-y-1">
                      {filteredMessages.slice(0, 5).map((message) => (
                        <div key={message.id} className={`p-2 rounded ${message.isAutomated ? 'bg-yellow-50' : 'bg-white'}`}>
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-xs">{message.senderName}</span>
                            {!message.isAutomated && (
                              <button 
                                onClick={() => handleDeleteMessage(message.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                                title="Delete message"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                          <p className="text-gray-700 text-xs truncate">{message.content}</p>
                        </div>
                      ))}
                      {filteredMessages.length > 5 && (
                        <div className="text-center text-xs text-gray-500 py-1">
                          +{filteredMessages.length - 5} more messages
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

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
