<template>
  <div v-if="showPrompt" class="push-notification-prompt">
    <AppleCard class="prompt-card" hoverable>
      <div class="prompt-content">
        <div class="prompt-icon">
          🔔
        </div>
        <div class="prompt-text">
          <h4>开启推送通知</h4>
          <p>接收重要公告和系统通知，随时了解最新动态</p>
        </div>
        <div class="prompt-actions">
          <AppleButton
            variant="secondary"
            size="small"
            @click="dismissPrompt"
          >
            稍后
          </AppleButton>
          <AppleButton
            variant="primary"
            size="small"
            :loading="requesting"
            @click="enableNotifications"
          >
            开启通知
          </AppleButton>
        </div>
      </div>
    </AppleCard>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { requestNotificationPermission, pushSubscriptionService } from '@/services/supabase';
import AppleCard from './AppleCard.vue';
import AppleButton from './AppleButton.vue';

export default {
  name: 'PushNotificationPrompt',
  components: {
    AppleCard,
    AppleButton
  },
  setup() {
    const showPrompt = ref(false);
    const requesting = ref(false);

    const checkNotificationStatus = async () => {
      // 检查是否已经显示过提示
      const dismissed = localStorage.getItem('push-notification-dismissed');
      if (dismissed) return;

      // 检查通知权限和订阅状态
      if ('Notification' in window) {
        const permission = Notification.permission;

        if (permission === 'default') {
          // 还未请求过权限，显示提示
          showPrompt.value = true;
        } else if (permission === 'granted') {
          // 已授权，检查是否有订阅
          try {
            const { hasSubscription } = await pushSubscriptionService.getSubscriptionStatus();
            if (!hasSubscription) {
              // 有权限但没有订阅，显示提示
              showPrompt.value = true;
            }
          } catch (error) {
            console.error('检查订阅状态失败:', error);
          }
        }
      }
    };

    const enableNotifications = async () => {
      requesting.value = true;
      try {
        const result = await requestNotificationPermission();

        if (result.status === 'granted') {
          showPrompt.value = false;
          // 推送通知已开启 - removed console.log for production
        } else {
          // 用户拒绝了推送通知权限 - removed console.log for production
        }
      } catch (error) {
        // 开启推送通知失败 - removed console.error for production
      } finally {
        requesting.value = false;
      }
    };

    const dismissPrompt = () => {
      showPrompt.value = false;
      localStorage.setItem('push-notification-dismissed', 'true');
    };

    onMounted(() => {
      // 延迟检查，避免页面加载时的干扰
      setTimeout(checkNotificationStatus, 3000);
    });

    return {
      showPrompt,
      requesting,
      enableNotifications,
      dismissPrompt
    };
  }
};
</script>

<style scoped>
.push-notification-prompt {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 350px;
  animation: slideIn 0.3s ease-out;
}

.prompt-card {
  padding: 16px;
  margin: 0;
}

.prompt-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.prompt-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.prompt-text {
  flex: 1;
}

.prompt-text h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.prompt-text p {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.prompt-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .push-notification-prompt {
    left: 20px;
    right: 20px;
    bottom: 20px;
    max-width: none;
  }

  .prompt-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }

  .prompt-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>