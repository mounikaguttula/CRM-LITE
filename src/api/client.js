import { getAuthToken, clearAuthSession } from '../utils/authStorage';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * Universal API Client connecting frontend directly to backend Express server
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const res = await fetch(url, config);

    if (res.status === 401) {
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }

    const contentType = res.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      // Extract clean message from HTML if server returns Express default HTML response
      const preMatch = text.match(/<pre>(.*?)<\/pre>/i);
      const bodyMatch = text.match(/<body>(.*?)<\/body>/i);
      let cleanMsg = preMatch ? preMatch[1] : (bodyMatch ? bodyMatch[1] : text);
      cleanMsg = cleanMsg.replace(/<[^>]+>/g, '').trim();
      data = { message: cleanMsg || `Server error (${res.status})` };
    }

    if (!res.ok) {
      const errorMessage = data?.message || data?.error || `HTTP error! status: ${res.status}`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`API Request Error [${options.method || 'GET'} ${url}]:`, err);
    throw err;
  }
};

const apiGet = (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' });
const apiPost = (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'POST', body });
const apiPut = (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'PUT', body });
const apiPatch = (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'PATCH', body });
const apiDelete = (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'DELETE' });

export { apiFetch, apiGet, apiPost, apiPut, apiPatch, apiDelete };
const apiClient = { get: apiGet, post: apiPost, put: apiPut, patch: apiPatch, delete: apiDelete };
export default apiClient;
