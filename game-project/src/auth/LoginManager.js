import logger from '../utils/Logger.js';

/**
 * LoginManager - Sistema de autenticación y progreso del jugador
 * Funcionalidades:
 * - Login con nombre de usuario
 * - Guardar progreso en localStorage
 * - Cerrar sesión (logout)
 * - Tracking de nivel, puntos y tiempo jugado
 */
export default class LoginManager {
  constructor() {
    this.currentUser = null;
    this.storageKey = 'bumblebee_user_data';
    this.logoutButton = null;

    // Verificar si hay sesión existente
    this.checkExistingSession();
  }

  /**
   * Verificar si existe una sesión guardada en localStorage
   */
  checkExistingSession() {
    try {
      const savedData = localStorage.getItem(this.storageKey);
      if (savedData) {
        this.currentUser = JSON.parse(savedData);
        logger.info('👤', `Sesión restaurada: ${this.currentUser.username}`);

        // Crear botón de logout automáticamente
        this.createLogoutButton();
        return true;
      }
    } catch (error) {
      logger.error('Error al restaurar sesión:', error);
      localStorage.removeItem(this.storageKey);
    }
    return false;
  }

  /**
   * Verificar si el usuario está logueado
   */
  isLoggedIn() {
    return this.currentUser !== null;
  }

  /**
   * Obtener nombre de usuario actual
   */
  getUsername() {
    return this.currentUser?.username || 'Invitado';
  }

  /**
   * Mostrar modal de login
   */
  showLoginModal() {
    return new Promise((resolve) => {
      // Crear modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `;

      const container = document.createElement('div');
      container.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
      `;

      container.innerHTML = `
        <h1 style="margin: 0 0 10px 0; color: #333; font-size: 32px;">🤖 Bumblebee</h1>
        <p style="margin: 0 0 30px 0; color: #666; font-size: 16px;">¡Bienvenido al juego!</p>
        <input
          type="text"
          id="username-input"
          placeholder="Ingresa tu nombre"
          maxlength="20"
          style="
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            box-sizing: border-box;
            margin-bottom: 20px;
            transition: border-color 0.3s;
          "
        />
        <button
          id="login-btn"
          style="
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          "
        >
          🚀 Iniciar Juego
        </button>
      `;

      modal.appendChild(container);
      document.body.appendChild(modal);

      const input = document.getElementById('username-input');
      const btn = document.getElementById('login-btn');

      // Foco automático
      setTimeout(() => input.focus(), 100);

      // Hover effect
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });

      // Input focus effect
      input.addEventListener('focus', () => {
        input.style.borderColor = '#667eea';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#e0e0e0';
      });

      const handleLogin = () => {
        const username = input.value.trim();

        if (!username || username.length < 2) {
          input.style.borderColor = '#ff4444';
          input.placeholder = 'Nombre muy corto (mínimo 2 caracteres)';
          input.value = '';
          return;
        }

        // Crear usuario
        this.currentUser = {
          username,
          createdAt: new Date().toISOString(),
          progress: {
            currentLevel: 1,
            totalPoints: 0,
            totalTimePlayed: 0,
            levelsCompleted: []
          }
        };

        // Guardar en localStorage
        this.saveProgress();

        logger.info('👤✅', `Usuario logueado: ${username}`);

        // Crear botón de logout
        this.createLogoutButton();

        // Remover modal con animación
        modal.style.transition = 'opacity 0.3s';
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.remove();
          resolve();
        }, 300);
      };

      // Enter key
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
      });

      // Click button
      btn.addEventListener('click', handleLogin);
    });
  }

  /**
   * Crear botón de logout flotante
   */
  createLogoutButton() {
    // Verificar si ya existe
    if (this.logoutButton) return;

    this.logoutButton = document.createElement('button');
    this.logoutButton.innerHTML = `
      <span style="margin-right: 8px;">👤</span>
      <span id="username-display">${this.getUsername()}</span>
      <span style="margin-left: 8px; font-size: 12px;">🚪</span>
    `;

    Object.assign(this.logoutButton.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#333',
      border: '2px solid #667eea',
      borderRadius: '25px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      zIndex: '9998',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    });

    // Hover effect
    this.logoutButton.addEventListener('mouseenter', () => {
      this.logoutButton.style.transform = 'translateY(-2px)';
      this.logoutButton.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      this.logoutButton.style.background = 'rgba(102, 126, 234, 0.1)';
    });

    this.logoutButton.addEventListener('mouseleave', () => {
      this.logoutButton.style.transform = 'translateY(0)';
      this.logoutButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      this.logoutButton.style.background = 'rgba(255, 255, 255, 0.95)';
    });

    // Click handler
    this.logoutButton.addEventListener('click', () => {
      this.logout();
    });

    document.body.appendChild(this.logoutButton);
    logger.info('👤🔘', 'Botón de logout creado');
  }

  /**
   * Cerrar sesión
   */
  logout() {
    if (!this.currentUser) return;

    const username = this.currentUser.username;

    // Confirmar logout
    const confirmed = confirm(`¿Seguro que quieres cerrar sesión, ${username}?`);

    if (!confirmed) return;

    logger.info('👤🚪', `Cerrando sesión de: ${username}`);

    // Limpiar datos
    this.currentUser = null;
    localStorage.removeItem(this.storageKey);

    // Remover botón de logout
    if (this.logoutButton) {
      this.logoutButton.remove();
      this.logoutButton = null;
    }

    // Recargar página para forzar nuevo login
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }

  /**
   * Guardar progreso en localStorage
   */
  saveProgress() {
    if (!this.currentUser) return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      logger.debug('💾', 'Progreso guardado');
    } catch (error) {
      logger.error('Error al guardar progreso:', error);
    }
  }

  /**
   * Actualizar progreso del jugador
   */
  updateProgress(level, points, timePlayed) {
    if (!this.currentUser) return;

    this.currentUser.progress.currentLevel = Math.max(
      this.currentUser.progress.currentLevel,
      level
    );
    this.currentUser.progress.totalPoints += points;
    this.currentUser.progress.totalTimePlayed += timePlayed;

    if (!this.currentUser.progress.levelsCompleted.includes(level)) {
      this.currentUser.progress.levelsCompleted.push(level);
    }

    this.saveProgress();

    logger.info('📊', `Progreso actualizado: Nivel ${level}, +${points} puntos`);
  }

  /**
   * Obtener progreso actual
   */
  getProgress() {
    return this.currentUser?.progress || {
      currentLevel: 1,
      totalPoints: 0,
      totalTimePlayed: 0,
      levelsCompleted: []
    };
  }
}
