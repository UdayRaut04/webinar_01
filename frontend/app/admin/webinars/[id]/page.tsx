'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { socketClient } from '@/lib/socket';
import { toast } from 'sonner';
import Link from 'next/link';

interface Message {
  id: string;
  content: string;
  senderName: string;
  timestamp: number;
  createdAt: string;
  isPinned: boolean;
  isAutomated: boolean;
}

export default function WebinarChatPage() {
  const params = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [showAutomated, setShowAutomated] = useState(false); // Show legitimate only by default
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChat();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadChat, 5000);
    
    return () => {
      clearInterval(interval);
      socketClient.disconnect();
    };
  }, [params.id]);

  useEffect(() => {
    if (showAutomated) {
      setFilteredMessages(messages);
    } else {
      // Filter out automated messages (legitimate chats only)
      setFilteredMessages(messages.filter(msg => !msg.isAutomated));
    }
  }, [messages, showAutomated]);

  const loadChat = async () => {
    try {
      const { messages } = await api.getWebinarChat(params.id as string);
      setMessages(messages);
    } catch (error) {
      console.error('Failed to load chat:', error);
      toast.error('Failed to load chat messages');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    // Store listener functions to remove them later
    const handleMessage = (message: any) => {
      setMessages(prev => [...prev, message]);
    };
    
    const handleViewers = (data: any) => {
      setViewerCount(data.count);
    };
    
    socketClient.connect({});
    socketClient.joinWebinar(params.id as string);
    
    // Add listeners
    socketClient.on('chat:message', handleMessage);
    socketClient.on('webinar:viewers', handleViewers);
    
    // Return cleanup function
    return () => {
      socketClient.off('chat:message', handleMessage);
      socketClient.off('webinar:viewers', handleViewers);
    };
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
    } catch (error) {
      console.error('Failed to pin message:', error);
      toast.error('Failed to pin message');
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    try {
      await api.unpinMessage(messageId);
      loadChat(); // Refresh to get updated pinned status
      toast.success('Message unpinned');
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

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/webinars/${params.id}`}>
            <Button variant="outline">← Back to Webinar</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Chat Management</h1>
            <p className="text-gray-600">Moderate and export chat messages</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={!showAutomated ? "default" : "outline"}
            onClick={() => setShowAutomated(false)}
          >
            Show Legitimate Only
          </Button>
          <Button
            variant={showAutomated ? "default" : "outline"}
            onClick={() => setShowAutomated(true)}
          >
            Show All Messages
          </Button>
          <Button
            variant="secondary"
            onClick={downloadFilteredChats}
            disabled={filteredMessages.filter(msg => !msg.isAutomated).length === 0}
          >
            Download Legitimate Chats ({filteredMessages.filter(msg => !msg.isAutomated).length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Messages */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Chat Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={chatContainerRef}
                className="h-96 overflow-y-auto space-y-3 p-4 border rounded-lg bg-gray-50"
              >
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {showAutomated 
                      ? "No messages found" 
                      : "No legitimate chat messages found"}
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`p-3 rounded border mb-2 ${
                        message.isAutomated 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium">{message.senderName}</div>
                            {message.isAutomated && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Automated
                              </span>
                            )}
                            {message.isPinned && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Pinned
                              </span>
                            )}
                          </div>
                          <div className="text-gray-800 mt-1">{message.content}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(message.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          {!message.isAutomated && !message.isPinned && (
                            <button 
                              onClick={() => handlePinMessage(message.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Pin message"
                            >
                              📌 Pin
                            </button>
                          )}
                          {!message.isAutomated && message.isPinned && (
                            <button 
                              onClick={() => handleUnpinMessage(message.id)}
                              className="text-green-600 hover:text-green-800 text-sm"
                              title="Unpin message"
                            >
                              📎 Unpin
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteMessage(message.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            title="Delete message"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Viewer Count */}
          <Card>
            <CardHeader>
              <CardTitle>Viewers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-center">
                {viewerCount}
              </div>
              <p className="text-center text-sm text-gray-500 mt-1">Currently Watching</p>
            </CardContent>
          </Card>

          {/* Moderation Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Moderation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  if (confirm('Clear all chat messages?')) {
                    setMessages([]);
                    toast.success('Chat cleared');
                  }
                }}
              >
                Clear Chat
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => loadChat()}
              >
                Refresh Chat
              </Button>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Messages:</span>
                  <span className="font-medium">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Legitimate Chats:</span>
                  <span className="font-medium">{messages.filter(msg => !msg.isAutomated).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Automated Messages:</span>
                  <span className="font-medium">{messages.filter(msg => msg.isAutomated).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Viewers:</span>
                  <span className="font-medium">{viewerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Showing:</span>
                  <span className="font-medium">
                    {showAutomated ? 'All Messages' : 'Legitimate Only'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}