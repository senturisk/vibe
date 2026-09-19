import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Smile } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
}

const EMOJIS = ['👍', '❤️', '👏', '🎉', '🔥', '😂', '👋', '✨'];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleSendEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  return (
    <div className="fixed top-16 right-0 bottom-20 sm:bottom-24 w-full sm:w-80 md:w-96 bg-[#FEF7FF]/95 dark:bg-[#1D1B20]/95 backdrop-blur-xl border-l border-[#EADDFF] dark:border-[#49454F]/70 shadow-2xl z-40 flex flex-col transition-colors">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#EADDFF] dark:border-[#49454F]/60 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#21005D] dark:text-[#E6E0E9]">In-Call Messages</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#79747E] dark:text-[#938F99] text-center p-4">
            <p className="font-medium">No messages yet</p>
            <p className="text-[11px] mt-1 text-[#49454F] dark:text-[#CAC4D0]">
              Messages sent here are visible to all participants in this room.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId || msg.senderName === 'You';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-[#49454F] dark:text-[#CAC4D0] mb-0.5 px-1 font-medium">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <div
                  className={`px-3.5 py-2 rounded-2xl max-w-[85%] break-words ${
                    isMe
                      ? 'bg-[#6750A4] text-white rounded-br-none'
                      : 'bg-[#EADDFF] dark:bg-[#4F378B] text-[#21005D] dark:text-[#EADDFF] rounded-bl-none'
                  }`}
                >
                  <p className="text-xs leading-relaxed">{msg.text}</p>
                </div>
                <span className="text-[9px] text-[#79747E] dark:text-[#938F99] mt-0.5 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-3 py-1.5 border-t border-[#EADDFF]/70 dark:border-[#49454F]/50 flex items-center gap-1.5 overflow-x-auto">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendEmoji(emoji)}
            className="p-1 hover:bg-[#EADDFF] dark:hover:bg-[#2B2831] rounded-lg transition-transform active:scale-125 text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#EADDFF] dark:border-[#49454F]/60 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 px-3.5 py-2 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] border border-[#CAC4D0]/50 dark:border-[#49454F] text-xs text-[#1D1B20] dark:text-[#E6E0E9] focus:outline-none focus:ring-2 focus:ring-[#6750A4] dark:focus:ring-[#D0BCFF]"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-full bg-[#6750A4] dark:bg-[#7429B6] text-white disabled:opacity-40 hover:bg-[#523e85] dark:hover:bg-[#62219c] transition-all shrink-0 active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
