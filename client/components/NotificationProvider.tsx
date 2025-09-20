"use client";

import React, { useEffect, useState } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'error' | 'success';
}

export function NotificationProvider() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const handleShowNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, description, type } = customEvent.detail;
      
      const newNotification: Notification = {
        id: Date.now().toString(),
        title,
        description,
        type,
      };
      
      setNotifications(prev => [...prev, newNotification]);
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 5000);
    };

    window.addEventListener('show-notification', handleShowNotification);
    return () => {
      window.removeEventListener('show-notification', handleShowNotification);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {notifications.map((notification) => (
        <Toast.Root
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${
            notification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
          duration={5000}
          onOpenChange={() => removeNotification(notification.id)}
        >
          <div className="flex-shrink-0">
            {notification.type === 'error' ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
          
          <div className="flex-1">
            <Toast.Title className="font-medium text-sm">
              {notification.title}
            </Toast.Title>
            <Toast.Description className="text-sm mt-1">
              {notification.description}
            </Toast.Description>
          </div>
          
          <Toast.Close className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors">
            <X className="h-4 w-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
    </>
  );
} 