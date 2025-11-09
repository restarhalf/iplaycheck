// 用户状态管理
import { defineStore } from 'pinia';
import { supabase } from '@/services/supabase';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    profile: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    error: null
  }),

  getters: {
    userId: (state) => state.user?.id || null,
    userEmail: (state) => state.user?.email || null,
    userName: (state) => state.profile?.name || state.user?.email || 'Unknown',
    userRole: (state) => state.profile?.role || 'user'
  },

  actions: {
    // 初始化认证监听
    initAuth() {
  return new Promise(async (resolve) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error fetching session:', error);
        this.user = null;
        this.profile = null;
        this.isAuthenticated = false;
        this.isAdmin = false;
        resolve(null);
        return;
      }

      if (session?.user) {
        this.user = session.user;
        this.isAuthenticated = true;
        console.log('User authenticated:', session.user);
        await this.loadUserProfile(session.user.id);
        resolve(session.user);
      } else {
        console.warn('No active session. Clearing user state.');
        this.user = null;
        this.profile = null;
        this.isAuthenticated = false;
        this.isAdmin = false;
        resolve(null);
      }
    } catch (error) {
      console.error('Error during auth initialization:', error);
      this.error = '认证状态初始化失败，请稍后重试';
      resolve(null);
    }
  });

    },

    // 加载用户资料
    async loadUserProfile(userId) {
      try {
        if (!userId) {
          throw new Error('用户 ID 不能为空');
        }

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // 未找到用户资料
            console.warn('用户资料未找到，尝试创建默认资料');
          } else {
            console.error('Error loading user profile:', error);
            throw new Error('加载用户资料失败，请稍后重试');
          }
        }

        if (data) {
          console.log('Loaded user profile:', data);
          this.profile = {
            ...data,
            created_at: data.created_at || new Date().toISOString()
          };
          this.isAdmin = data.role === 'admin';
        } else {
          // 检查是否已存在相同的用户 ID
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id, created_at')
            .eq('id', userId)
            .maybeSingle();

          if (fetchError) {
            console.error('Error checking existing user:', fetchError);
            throw new Error('检查用户资料时出错，请稍后重试');
          }

          if (!existingUser) {
            try {
              // 创建默认用户资料
              this.profile = {
                name: this.user.email,
                role: 'user',
                created_at: new Date().toISOString()
              };
              const { error: insertError } = await supabase
                .from('users')
                .insert([
                  {
                    id: userId,
                    email: this.user.email,
                    name: this.user.email,
                    role: 'user',
                    created_at: new Date().toISOString()
                  }
                ]);

              if (insertError) {
                if (insertError.code === '23505') {
                  console.warn('用户资料已存在，未重复插入');
                } else {
                  console.error('Error inserting user profile:', insertError);
                  throw new Error('创建用户资料失败，请稍后重试');
                }
              }
            } catch (creationError) {
              console.error('Failed to create default profile, logging out:', creationError);
              await this.logout(); // 触发退出登录逻辑
              return;
            }
          } else {
            console.warn('用户资料已存在，未重复插入');
          }
        }
      } catch (error) {
        console.error('Load profile error:', error);
        this.error = error.message || '加载用户资料失败，请稍后重试';
      }
    },

    // 登录
    async login(email, password) {
      this.loading = true;
      this.error = null;

      try {
        if (!email || !password) {
          throw new Error('邮箱和密码不能为空');
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('邮箱或密码错误，请重试');
          }
          console.error('Unexpected login error:', error);
          throw new Error('登录失败，请稍后重试');
        }

        // 等待认证状态同步
        return new Promise((resolve, reject) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            subscription.unsubscribe(); // 只监听一次

            if (session?.user) {
              this.user = session.user;
              this.isAuthenticated = true;
              console.log('User authenticated:', session.user);
              await this.loadUserProfile(session.user.id);
              resolve(session.user);
            } else {
              console.warn('Authentication state sync failed.');
              reject(new Error('认证状态同步失败'));
            }
          });
        });
      } catch (error) {
        console.error('Login error:', error);
        this.error = error.message || '登录失败，请稍后重试';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 修复注销逻辑，确保未注册用户不会报错
    async logout() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error && error.message !== 'No user signed in') {
          console.error('Supabase signOut error:', error);
          throw error;
        }

        // 清理本地存储中的会话数据
        localStorage.clear();
        sessionStorage.clear();

        // 清理状态
        this.user = null;
        this.profile = null;
        this.isAuthenticated = false;
        this.isAdmin = false;

        console.log('User successfully logged out.');

        // 重新初始化认证状态以确保同步
        await this.initAuth();
      } catch (error) {
        console.error('Logout error:', error);
        this.error = error.message || '注销失败，请稍后重试';
      }
    },

    // 更新用户资料
    async updateProfile(updates) {
      if (!this.userId) return;

      try {
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', this.userId);

        if (error) throw error;

        // 重新加载用户资料
        await this.loadUserProfile(this.userId);
      } catch (error) {
        console.error('Update profile error:', error);
        this.error = error.message || '更新用户资料失败，请稍后重试';
        throw error;
      }
    },

    // 通用错误信息处理
    getErrorMessage(message) {
      if (message.includes('email')) {
        return '邮箱格式不正确';
      } else if (message.includes('password')) {
        return '密码必须至少包含 8 个字符，且必须包含字母和数字';
      } else if (message.includes('User already registered')) {
        return '该邮箱已被注册，请直接登录';
      } else if (message.includes('Invalid login credentials')) {
        return '邮箱或密码错误，请重试';
      } else {
        return '发生未知错误，请稍后重试';
      }
    }
  }
});
