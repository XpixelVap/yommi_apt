import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };

  return (
    <div className={`fixed bottom-4 right-4 ${bgColors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-fade-in-up`}>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
