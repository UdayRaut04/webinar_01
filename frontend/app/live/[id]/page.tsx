'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTime, getVideoUrl, isYouTubeUrl } from '@/lib/utils';
import { useMemo } from 'react';

interface Message {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
  isAutomated: boolean;
}

interface CTAPopup {
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  duration: number;
}

interface Webinar {
  id: string;
  title: string;
  videoUrl: string;
  accentColor: string;
  host: { name: string };
  state: { isLive: boolean; currentTimestamp: number };
}

export default function LiveStreamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const registrationLink = searchParams.get('link');
  
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [ctaPopup, setCtaPopup] = useState<CTAPopup | null>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false); // Start with unmuted by default

  const videoUrl = useMemo(() => getVideoUrl(webinar?.videoUrl), [webinar?.videoUrl]);
  const isYouTube = useMemo(() => webinar?.videoUrl ? isYouTubeUrl(webinar.videoUrl) : false, [webinar?.videoUrl]);

  // Disable keyboard shortcuts for developer tools and other actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    loadWebinar();
    
    return () => {
      socketClient.disconnect();
    };
  }, [params.id]);

  const loadWebinar = async () => {
    try {
      const { webinar } = await api.getWebinar(params.id as string);
      setWebinar(webinar);
      
      // Check if webinar has already ended
      if (webinar.status === 'ENDED') {
        const title = encodeURIComponent(webinar.title || 'the webinar');
        router.push(`/webinar-ended?title=${title}`);
        return;
      }

      // Get user name from registration
      if (registrationLink) {
        const { registration } = await api.getRegistration(registrationLink);
        setUserName(registration.name);
        
        // Connect socket with registration
        socketClient.connect({ registrationId: registrationLink });
      } else {
        // Guest mode
        const guestName = `Guest_${Math.random().toString(36).slice(2, 8)}`;
        setUserName(guestName);
        socketClient.connect({ guestName });
      }

      // Join webinar room
      socketClient.joinWebinar(params.id as string);
      setupSocketListeners();
    } catch (error) {
      console.error('Failed to load webinar:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update video muted state when isMuted changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const setupSocketListeners = useCallback(() => {
    // Initial state
    socketClient.on('webinar:state', (data) => {
      if (data.messages) {
        // Remove duplicate messages by ID to prevent React key errors
        const uniqueMessages = data.messages.filter((msg, index, self) =>
          index === self.findIndex(m => m.id === msg.id)
        );
        setMessages(uniqueMessages);
      }
      if (data.pinnedMessage) setPinnedMessage(data.pinnedMessage);
      if (data.viewerCount) setViewerCount(data.viewerCount);
      if (data.currentTimestamp && videoRef.current) {
        videoRef.current.currentTime = data.currentTimestamp;
        // Autoplay when webinar state is received
        videoRef.current.play().catch(err => {
          console.log('Autoplay prevented:', err);
        });
      }
    });

    // Sync playback
    socketClient.on('webinar:sync', (data) => {
      setCurrentTime(data.currentTimestamp);
      if (videoRef.current && Math.abs(videoRef.current.currentTime - data.currentTimestamp) > 2) {
        videoRef.current.currentTime = data.currentTimestamp;
        // Ensure video is playing during sync
        if (videoRef.current.paused) {
          videoRef.current.play().catch(err => {
            console.log('Autoplay prevented:', err);
          });
        }
      }
    });

    // Viewer count updates
    socketClient.on('webinar:viewers', (data) => {
      setViewerCount(data.count);
    });

    // Chat messages - FIXED: Removed duplicate listener
    socketClient.on('chat:message', (message) => {
      setMessages((prev) => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(m => m.id === message.id);
        if (exists) {
          return prev; // Don't add if already exists
        }
        return [...prev, message];
      });
    });

    // Pinned message
    socketClient.on('chat:pinned', (data) => {
      setPinnedMessage(data);
    });

    socketClient.on('chat:unpinned', () => {
      setPinnedMessage(null);
    });

    // Deleted messages
    socketClient.on('chat:deleted', (data) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    // CTA Popup
    socketClient.on('automation:cta', (data) => {
      setCtaPopup(data);
      setTimeout(() => setCtaPopup(null), data.duration * 1000);
    });

    // Reactions
    socketClient.on('reaction:received', (data) => {
      const id = Math.random().toString(36);
      const x = Math.random() * 80 + 10;
      setReactions((prev) => [...prev, { id, emoji: data.emoji, x }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2000);
    });

    // Webinar ended
    socketClient.on('webinar:ended', (data) => {
      console.log('Received webinar:ended event', data);
      // Update webinar status to ENDED
      setWebinar(prev => prev ? { ...prev, state: { ...prev.state, isLive: false } } : null);
      // Redirect to thank you page with webinar title
      const title = encodeURIComponent(webinar?.title || 'the webinar');
      router.push(`/webinar-ended?title=${title}`);
    });
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    socketClient.sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleReaction = (emoji: string) => {
    socketClient.sendReaction(emoji);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Webinar not found</p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-900 flex flex-col lg:flex-row select-none"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Video Section */}
      <div className="flex-1 flex flex-col">
        {/* Video Player */}
        <div className="relative aspect-video bg-black">
          {isYouTube ? (
            <div className="relative w-full h-full">
              <iframe
                className="w-full h-full"
                src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&muted=${isMuted ? '1' : '0'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen={false}
              />
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={videoUrl}
              autoPlay
              muted={isMuted}
              playsInline
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
          
          {/* Live indicator */}
          <div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
            <span className="flex items-center px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
              LIVE
            </span>
            <span className="px-2 py-1 bg-black/50 text-white text-xs rounded">
              {viewerCount} watching
            </span>
          </div>
          
          {/* View-only watermark */}
          <div className="absolute top-4 right-4 px-2 py-1 bg-black/50 text-white/70 text-xs rounded z-20 select-none pointer-events-none">
            🔒 View Only
          </div>

          {/* Time */}
          <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/50 text-white text-sm rounded">
            {formatTime(currentTime)}
          </div>

          {/* Mute/Unmute Button */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A4.983 4.983 0 0115 10a4.984 4.984 0 01-1.757 3.536 1 1 0 01-1.415-1.414A2.984 2.984 0 0013 10a2.984 2.984 0 00-1.029-2.122 1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>

          {/* Reactions overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
            {reactions.map((reaction) => (
              <span
                key={reaction.id}
                className="emoji-reaction absolute text-3xl"
                style={{ left: `${reaction.x}%`, bottom: 0 }}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Info bar */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <h1 className="text-xl font-bold text-white">{webinar.title}</h1>
          <p className="text-gray-400 text-sm">Hosted by {webinar.host?.name || 'Admin'}</p>
        </div>

        {/* Reaction buttons (mobile) */}
        <div className="lg:hidden p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex justify-center space-x-4">
            {['👏', '❤️', '🔥', '😮', '😂'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="w-full lg:w-96 flex flex-col bg-gray-800 border-l border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-semibold text-white">Live Chat</h2>
        </div>

        {/* Pinned message */}
        {pinnedMessage && (
          <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20">
            <p className="text-xs text-yellow-500 font-medium mb-1">📌 Pinned</p>
            <p className="text-white text-sm">{pinnedMessage.content}</p>
            <p className="text-gray-400 text-xs mt-1">— {pinnedMessage.senderName}</p>
          </div>
        )}

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
        >
          {messages.map((message) => (
            <div key={message.id} className="chat-message">
              <span 
                className={`font-medium text-sm ${message.isAutomated ? 'text-yellow-400' : 'text-blue-400'}`}
              >
                {message.senderName}
              </span>
              <p className="text-white text-sm">{message.content}</p>
            </div>
          ))}
        </div>

        {/* Reaction buttons (desktop) */}
        <div className="hidden lg:flex p-4 border-t border-gray-700 justify-center space-x-4">
          {['👏', '❤️', '🔥', '😮', '😂'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <Button type="submit" style={{ backgroundColor: webinar.accentColor }}>
              Send
            </Button>
          </div>
        </form>
      </div>

      {/* CTA Popup */}
      {ctaPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in shadow-2xl">
            <h3 className="text-xl font-bold mb-2">{ctaPopup.title}</h3>
            <p className="text-gray-600 mb-4">{ctaPopup.description}</p>
            <div className="flex space-x-3">
              <a 
                href={ctaPopup.buttonUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button 
                  className="w-full"
                  style={{ backgroundColor: webinar.accentColor }}
                >
                  {ctaPopup.buttonText}
                </Button>
              </a>
              <Button variant="outline" onClick={() => setCtaPopup(null)}>
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}