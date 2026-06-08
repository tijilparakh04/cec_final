import React from 'react';
import { useAdminAuth } from './adminAuth.js';

// Shared fetch helper for admin dashboard.
export function createAdminApi(getToken) {
  async function request(method, path, body) {
    const token = getToken?.();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || res.statusText || 'Request failed';
      throw new Error(msg);
    }

    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
  };
}

export function useAdminApi() {
  const { api } = useAdminAuth();
  return api;
}


