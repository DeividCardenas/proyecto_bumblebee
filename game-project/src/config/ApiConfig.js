/**
 * Configuración de la API del backend
 */

// URL base de la API (cambiar según el entorno)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  endpoints: {
    auth: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      profile: '/api/auth/profile',
      verify: '/api/auth/verify',
      updateStats: '/api/auth/game-stats'
    }
  },
  timeout: 10000, // 10 segundos
  headers: {
    'Content-Type': 'application/json'
  }
};

export default API_CONFIG;
