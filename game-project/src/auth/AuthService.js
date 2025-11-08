import { API_CONFIG } from '../config/ApiConfig.js';
import logger from '../utils/Logger.js';

/**
 * Servicio de autenticación con el backend
 * Maneja todas las peticiones HTTP relacionadas con autenticación y usuarios
 */
class AuthService {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.token = null;
    this.loadToken();
  }

  /**
   * Cargar token del localStorage
   */
  loadToken() {
    try {
      this.token = localStorage.getItem('jwt_token');
    } catch (error) {
      logger.error('Error al cargar token:', error);
    }
  }

  /**
   * Guardar token en localStorage
   */
  saveToken(token) {
    try {
      this.token = token;
      localStorage.setItem('jwt_token', token);
    } catch (error) {
      logger.error('Error al guardar token:', error);
    }
  }

  /**
   * Eliminar token
   */
  removeToken() {
    this.token = null;
    try {
      localStorage.removeItem('jwt_token');
    } catch (error) {
      logger.error('Error al eliminar token:', error);
    }
  }

  /**
   * Obtener headers con autenticación
   */
  getHeaders(includeAuth = false) {
    const headers = { ...API_CONFIG.headers };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Realizar petición HTTP
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: this.getHeaders(options.auth),
    };

    try {
      logger.debug('🌐 Request:', url, config.method || 'GET');

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      logger.error('❌ Error en petición:', error);
      throw error;
    }
  }

  /**
   * Registrar nuevo usuario
   * @param {string} username - Nombre de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Datos del usuario y token
   */
  async register(username, email, password) {
    try {
      logger.info('📝 Registrando usuario:', username);

      const response = await this.request(API_CONFIG.endpoints.auth.register, {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });

      if (response.success && response.data.token) {
        this.saveToken(response.data.token);
        logger.info('✅ Usuario registrado exitosamente');
        return response.data;
      }

      throw new Error(response.message || 'Error al registrar usuario');
    } catch (error) {
      logger.error('❌ Error en registro:', error);
      throw error;
    }
  }

  /**
   * Iniciar sesión
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Datos del usuario y token
   */
  async login(email, password) {
    try {
      logger.info('🔐 Iniciando sesión:', email);

      const response = await this.request(API_CONFIG.endpoints.auth.login, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success && response.data.token) {
        this.saveToken(response.data.token);
        logger.info('✅ Login exitoso');
        return response.data;
      }

      throw new Error(response.message || 'Error al iniciar sesión');
    } catch (error) {
      logger.error('❌ Error en login:', error);
      throw error;
    }
  }

  /**
   * Obtener perfil del usuario autenticado
   * @returns {Promise<Object>} Datos del usuario
   */
  async getProfile() {
    try {
      logger.debug('👤 Obteniendo perfil...');

      const response = await this.request(API_CONFIG.endpoints.auth.profile, {
        method: 'GET',
        auth: true
      });

      if (response.success) {
        return response.data.user;
      }

      throw new Error(response.message || 'Error al obtener perfil');
    } catch (error) {
      logger.error('❌ Error al obtener perfil:', error);
      throw error;
    }
  }

  /**
   * Verificar si el token es válido
   * @returns {Promise<boolean>} True si el token es válido
   */
  async verifyToken() {
    try {
      if (!this.token) return false;

      const response = await this.request(API_CONFIG.endpoints.auth.verify, {
        method: 'GET',
        auth: true
      });

      return response.success;
    } catch (error) {
      logger.error('❌ Token inválido:', error);
      this.removeToken();
      return false;
    }
  }

  /**
   * Actualizar estadísticas del juego
   * @param {Object} stats - Estadísticas a actualizar
   * @param {number} stats.highScore - Puntaje máximo
   * @param {number} stats.level - Nivel actual
   * @param {number} stats.totalGamesPlayed - Total de partidas jugadas
   * @param {number} stats.totalPlayTime - Tiempo total de juego (segundos)
   * @returns {Promise<Object>} Estadísticas actualizadas
   */
  async updateGameStats(stats) {
    try {
      logger.debug('📊 Actualizando estadísticas:', stats);

      const response = await this.request(API_CONFIG.endpoints.auth.updateStats, {
        method: 'PUT',
        body: JSON.stringify(stats),
        auth: true
      });

      if (response.success) {
        logger.info('✅ Estadísticas actualizadas');
        return response.data.gameStats;
      }

      throw new Error(response.message || 'Error al actualizar estadísticas');
    } catch (error) {
      logger.error('❌ Error al actualizar estadísticas:', error);
      throw error;
    }
  }

  /**
   * Cerrar sesión
   */
  logout() {
    logger.info('🚪 Cerrando sesión');
    this.removeToken();
  }

  /**
   * Verificar si el usuario está autenticado
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.token !== null;
  }
}

// Exportar instancia única (Singleton)
export default new AuthService();
