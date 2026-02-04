const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = this.getToken();

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(data.token);
    return data;
  }

  async register(email: string, password: string, name?: string) {
    const data = await this.request<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    this.setToken(data.token);
    return data;
  }

  async requestMagicLink(email: string) {
    return this.request<{ message: string; token?: string; link?: string }>('/api/auth/magic-link', {
      method: 'POST',
      body: { email },
    });
  }

  async verifyMagicLink(token: string) {
    const data = await this.request<{ user: any; token: string }>('/api/auth/magic-link/verify', {
      method: 'POST',
      body: { token },
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<{ user: any }>('/api/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Webinars
  async getWebinars() {
    return this.request<{ webinars: any[] }>('/api/webinars');
  }

  async getWebinar(id: string) {
    return this.request<{ webinar: any }>(`/api/webinars/${id}`);
  }

  async getWebinarBySlug(slug: string) {
    return this.request<{ webinar: any }>(`/api/webinars/slug/${slug}`);
  }

  async createWebinar(data: any) {
    return this.request<{ webinar: any }>('/api/webinars', {
      method: 'POST',
      body: data,
    });
  }

  async updateWebinar(id: string, data: any) {
    return this.request<{ webinar: any }>(`/api/webinars/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteWebinar(id: string) {
    return this.request<{ success: boolean }>(`/api/webinars/${id}`, {
      method: 'DELETE',
    });
  }

  async registerForWebinar(webinarId: string, data: { name: string; email: string; phone?: string }) {
    return this.request<{ registration: any }>(`/api/webinars/${webinarId}/register`, {
      method: 'POST',
      body: data,
    });
  }

  async joinWebinar(uniqueLink: string) {
    return this.request<{ registration: any }>(`/api/webinars/join/${uniqueLink}`);
  }

  // Registrations
  async getRegistration(uniqueLink: string) {
    return this.request<{ registration: any }>(`/api/registrations/${uniqueLink}`);
  }

  async getRegistrationStatus(uniqueLink: string) {
    return this.request<{ status: string; scheduledAt: string; timeUntilStart: number; canJoin: boolean }>(
      `/api/registrations/${uniqueLink}/status`
    );
  }

  // Admin
  async getAdminWebinars() {
    return this.request<{ webinars: any[] }>('/api/admin/webinars');
  }

  async getWebinarRegistrations(webinarId: string) {
    return this.request<{ registrations: any[] }>(`/api/admin/webinars/${webinarId}/registrations`);
  }

  async startWebinar(webinarId: string) {
    return this.request<{ webinar: any }>(`/api/admin/webinars/${webinarId}/start`, {
      method: 'POST',
    });
  }

  async stopWebinar(webinarId: string) {
    return this.request<{ webinar: any }>(`/api/admin/webinars/${webinarId}/stop`, {
      method: 'POST',
    });
  }

  async syncWebinar(webinarId: string, currentTimestamp: number) {
    return this.request<{ success: boolean }>(`/api/admin/webinars/${webinarId}/sync`, {
      method: 'POST',
      body: { currentTimestamp },
    });
  }

  async getWebinarChat(webinarId: string) {
    return this.request<{ messages: any[] }>(`/api/admin/webinars/${webinarId}/chat`);
  }

  async pinMessage(messageId: string) {
    return this.request<{ message: any }>(`/api/admin/chat/${messageId}/pin`, {
      method: 'POST',
    });
  }

  async unpinMessage(messageId: string) {
    return this.request<{ message: any }>(`/api/admin/chat/${messageId}/unpin`, {
      method: 'POST',
    });
  }

  async deleteMessage(messageId: string) {
    return this.request<{ success: boolean }>(`/api/admin/chat/${messageId}`, {
      method: 'DELETE',
    });
  }

  async getAutomations(webinarId: string) {
    return this.request<{ automations: any[] }>(`/api/admin/webinars/${webinarId}/automations`);
  }

  async createAutomation(webinarId: string, data: any) {
    return this.request<{ automation: any }>(`/api/admin/webinars/${webinarId}/automations`, {
      method: 'POST',
      body: data,
    });
  }

  async updateAutomation(automationId: string, data: any) {
    return this.request<{ automation: any }>(`/api/admin/automations/${automationId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteAutomation(automationId: string) {
    return this.request<{ success: boolean }>(`/api/admin/automations/${automationId}`, {
      method: 'DELETE',
    });
  }

  async broadcastCTA(webinarId: string, data: any) {
    return this.request<{ success: boolean }>(`/api/admin/webinars/${webinarId}/cta`, {
      method: 'POST',
      body: data,
    });
  }

  async getAdminLogs(webinarId?: string) {
    const query = webinarId ? `?webinarId=${webinarId}` : '';
    return this.request<{ logs: any[] }>(`/api/admin/logs${query}`);
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data as { url: string; filename: string; mimetype: string; size: number };
  }

  async getUploadedFiles() {
    return this.request<{ files: string[] }>('/api/upload/files');
  }

  async addFakeViewers(webinarId: string, count: number) {
    return this.request<{ success: boolean; totalViewers: number }>(`/api/admin/webinars/${webinarId}/add-viewers`, {
      method: 'POST',
      body: { count },
    });
  }
}

export const api = new ApiClient();
