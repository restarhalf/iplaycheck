// 公告状态管理
import { defineStore } from 'pinia';
import { announcementsService } from '@/services/supabase';

export const useAnnouncementsStore = defineStore('announcements', {
  state: () => ({
    announcements: [],
    loading: false,
    error: null,
    subscription: null
  }),

  getters: {
    // 获取最新公告
    latestAnnouncement: (state) => {
      return state.announcements.length > 0 ? state.announcements[0] : null;
    },

    // 获取活跃公告数量
    activeCount: (state) => {
      return state.announcements.filter(ann => ann.is_active).length;
    },

    // 暴露announcementsService供组件使用
    announcementsService: () => announcementsService
  },

  actions: {
    // 加载公告
    async loadAnnouncements() {
      this.loading = true;
      this.error = null;
      try {
        const data = await announcementsService.getAnnouncements();
        this.announcements = data;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    // 订阅实时更新
    subscribeToUpdates() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }

      this.subscription = announcementsService.subscribeToAnnouncements((payload) => {
        this.handleRealtimeUpdate(payload);
      });
    },

    // 处理实时更新
    handleRealtimeUpdate(payload) {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT':
          if (newRecord.is_active) {
            this.announcements.unshift(newRecord);
            // 发送推送通知
            this.sendNotification(newRecord);
          }
          break;
        case 'UPDATE':
          const index = this.announcements.findIndex(ann => ann.id === newRecord.id);
          if (index !== -1) {
            this.announcements[index] = newRecord;
          }
          break;
        case 'DELETE':
          this.announcements = this.announcements.filter(ann => ann.id !== oldRecord.id);
          break;
      }
    },

    // 发送推送通知 (使用原生Web Push API)
    async sendNotification(announcement) {
      try {
        // 获取所有用户的推送订阅
        const subscriptions = await this.announcementsService.getAllActiveSubscriptions();

        if (subscriptions.length === 0) {
          return;
        }

        // 向每个订阅发送推送
        const pushPromises = subscriptions.map(async (sub) => {
          try {
            const response = await fetch(sub.subscription.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'TTL': '86400' // 24小时
              },
              body: JSON.stringify({
                title: '新公告',
                body: announcement.title,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: `announcement-${announcement.id}`,
                data: {
                  type: 'announcement',
                  announcementId: announcement.id
                }
              })
            });

            return {
              endpoint: sub.subscription.endpoint,
              success: response.ok,
              status: response.status
            };
          } catch (error) {
            return {
              endpoint: sub.subscription.endpoint,
              success: false,
              error: error.message
            };
          }
        });

        const results = await Promise.all(pushPromises);
        const successCount = results.filter(r => r.success).length;

        // 同时显示浏览器原生通知（前台通知）
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('新公告', {
            body: announcement.title,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `announcement-${announcement.id}`,
            requireInteraction: false,
            data: { announcementId: announcement.id }
          });
        }
      } catch (error) {
        // 如果推送失败，至少显示浏览器原生通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('新公告', {
            body: announcement.title,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png'
          });
        }
      }
    },

    // 取消订阅
    unsubscribe() {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = null;
      }
    },

    // 创建公告（管理员）
    async createAnnouncement(announcement) {
      try {
        const newAnn = await announcementsService.createAnnouncement(announcement);
        return newAnn;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // 更新公告
    async updateAnnouncement(id, updates) {
      try {
        const updatedAnn = await announcementsService.updateAnnouncement(id, updates);
        return updatedAnn;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // 删除公告
    async deleteAnnouncement(id) {
      try {
        await announcementsService.deleteAnnouncement(id);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    }
  }
});