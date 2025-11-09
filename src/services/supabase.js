// Supabase配置和初始化
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 导出认证和数据库实例以保持兼容性
export const auth = supabase.auth;
export const db = supabase;

// 初始化消息服务 (Supabase没有内置推送，需要使用Web Push API)

// 初始化推送通知服务 (使用原生Web Push API)
export const initMessaging = async () => {
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // 注册service worker用于推送
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      return registration;
    }
  } catch (error) {
    console.error('Messaging initialization error:', error);
  }
  return null;
};

// 请求通知权限并获取推送订阅 (使用Web Push API)
export const requestNotificationPermission = async () => {
  try {
    // 检查权限状态
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      return { status: 'denied', subscription: null };
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await initMessaging();
      if (registration) {
        // 获取推送订阅 (需要VAPID key)
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          });
          return { status: 'granted', subscription };
        }
        return { status: 'granted', subscription: null };
      }
      return { status: 'granted', subscription: null };
    }

    return { status: permission, subscription: null };
  } catch (error) {
    console.error('Notification permission error:', error);
    return { status: 'error', error, subscription: null };
  }
};

// 监听前台推送消息
export const onForegroundMessage = (callback) => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'push') {
        callback(event.data.payload);
      }
    });
  }
};

export default supabase;