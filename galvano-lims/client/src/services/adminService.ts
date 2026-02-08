import api from './api';
import type { User, CompanySettings, AuditLog, PaginatedResponse, Notification } from '@/types';

export const adminService = {
  // Users
  async getUsers(): Promise<User[]> {
    const response = await api.get('/admin/users');
    return response.data;
  },

  async createUser(data: { email: string; password: string; firstName: string; lastName: string; role: string }): Promise<User> {
    const response = await api.post('/admin/users', data);
    return response.data;
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },

  async deactivateUser(id: string): Promise<void> {
    await api.patch(`/admin/users/${id}/deactivate`);
  },

  // Settings
  async getSettings(): Promise<CompanySettings> {
    const response = await api.get('/admin/settings');
    return response.data;
  },

  async updateSettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
    const response = await api.put('/admin/settings', data);
    return response.data;
  },

  async uploadLogo(file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post('/admin/settings/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async testSmtp(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/admin/settings/test-smtp');
    return response.data;
  },

  // Audit logs
  async getAuditLogs(params?: {
    page?: number; limit?: number; userId?: string;
    action?: string; entityType?: string; dateFrom?: string; dateTo?: string;
  }): Promise<PaginatedResponse<AuditLog>> {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  },
};

export const notificationService = {
  async getAll(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.count;
  },
};
