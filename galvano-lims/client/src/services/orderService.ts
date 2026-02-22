import api from './api';
import type { Order, OrderStatus, PaginatedResponse } from '@/types';

export interface CreateOrderPayload {
  clientId: string;
  sampleIds?: string[];
  notes?: string;
  currency?: string;
  manualAdjustmentNet?: number;
  manualAdjustmentVatRate?: number;
}

export interface UpdateOrderPayload {
  sampleIds?: string[];
  notes?: string | null;
  manualAdjustmentNet?: number;
  manualAdjustmentVatRate?: number;
}

export interface AddManualOrderItemPayload {
  description: string;
  quantity?: number;
  unitPriceNet: number;
  vatRate?: number;
  sampleId?: string;
  priceListId?: string;
}

export const orderService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    clientId?: string;
    search?: string;
    sortBy?: 'orderCode' | 'createdAt' | 'updatedAt' | 'status' | 'totalGross';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  async getById(id: string): Promise<Order> {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  async create(payload: CreateOrderPayload): Promise<Order> {
    const response = await api.post('/orders', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateOrderPayload): Promise<Order> {
    const response = await api.put(`/orders/${id}`, payload);
    return response.data;
  },

  async changeStatus(id: string, status: OrderStatus): Promise<Order> {
    const response = await api.patch(`/orders/${id}/status`, { status });
    return response.data;
  },

  async recalculate(id: string): Promise<Order> {
    const response = await api.post(`/orders/${id}/recalculate`);
    return response.data;
  },

  async addManualItem(id: string, payload: AddManualOrderItemPayload): Promise<Order> {
    const response = await api.post(`/orders/${id}/items/manual`, payload);
    return response.data;
  },

  async removeManualItem(orderId: string, itemId: string): Promise<Order> {
    const response = await api.delete(`/orders/${orderId}/items/${itemId}`);
    return response.data;
  },
};
