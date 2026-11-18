import { api } from './client.js';

export const requestCode = (email) => api.post('/auth/request-code', { email });

export const verifyCode = (email, code) => api.post('/auth/verify-code', { email, code });

export const logout = () => api.post('/auth/logout');

export const getMe = (options) => api.get('/auth/me', options);

export const updateMe = (name) => api.patch('/auth/me', { name });
