import api from './api';
import type { AuthResponse, LoginRequest, User } from '@/types';

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async register(data: { email: string; password: string; firstName: string; lastName: string; role: string }): Promise<User> {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  async refresh(): Promise<{ accessToken: string }> {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};
