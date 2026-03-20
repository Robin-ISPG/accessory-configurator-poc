import { useRef, useEffect, useState, useCallback } from 'react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'action' | 'api' | 'error' | 'info';
  message: string;
  details?: string;
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export default function LogBox({ logs, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: window.innerHeight - 320 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).closest('.logbox-container')?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 384, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - (isMinimized ? 40 : 280), e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, isMinimized]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'action': return 'text-yellow-400';
      case 'api': return 'text-blue-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getTypeBg = (type: LogEntry['type']) => {
    switch (type) {
      case 'action': return 'bg-yellow-400/10';
      case 'api': return 'bg-blue-400/10';
      case 'error': return 'bg-red-400/10';
      case 'info': return 'bg-green-400/10';
      default: return 'bg-gray-400/10';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  return (
    <div 
      className="logbox-container fixed w-96 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg overflow-hidden z-50"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-[#2a2a2a] cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Activity Log</span>
          {!isMinimized && (
            <span className="text-xs text-gray-500 ml-2">{logs.length} entries</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isMinimized && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#3a3a3a]"
            >
              Clear
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#3a3a3a]"
          >
            {isMinimized ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <div 
          ref={scrollRef}
          className="h-64 overflow-y-auto p-2 space-y-1"
        >
          {logs.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-8">
              No activity yet...
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id}
                className={`flex flex-col gap-1 p-2 rounded ${getTypeBg(log.type)} hover:bg-opacity-20 transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${getTypeColor(log.type)}`}>
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-gray-300 pl-14">
                  {log.message}
                </div>
                {log.details && (
                  <div className="text-xs text-gray-500 pl-14 font-mono break-all">
                    {log.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
