'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatContextMenuProps {
  message: any;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  isPinned: boolean;
  children: React.ReactNode;
}

export default function ChatContextMenu({
  message,
  onPin,
  onUnpin,
  onDelete,
  isPinned,
  children
}: ChatContextMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  const rect = e.currentTarget.getBoundingClientRect();
  
  // Account for scroll position
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  
  setPosition({ 
    x: rect.left + rect.width / 2,
    y: rect.top + scrollY - 10  // Subtract 10px and add scroll offset
  });
  setShowMenu(true);
};

  const handlePin = () => {
    onPin(message.id);
    setShowMenu(false);
  };

  const handleUnpin = () => {
    onUnpin(message.id);
    setShowMenu(false);
  };

  const handleDelete = () => {
    onDelete(message.id);
    setShowMenu(false);
  };

  return (
    <div onContextMenu={handleContextMenu} className="relative">
      {children}
      {showMenu && (
        <div
  ref={menuRef}
  className="fixed z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[120px]"
  style={{
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translate(-50%, -100%)'
  }}
        >
          {!isPinned && (
            <button
              onClick={handlePin}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            >
              📌 Pin Message
            </button>
          )}
          {isPinned && (
            <button
              onClick={handleUnpin}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            >
              📎 Unpin Message
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            🗑️ Delete Message
          </button>
        </div>
      )}
    </div>
  );
}