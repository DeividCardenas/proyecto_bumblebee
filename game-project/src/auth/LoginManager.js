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
   * Mostrar modal de login con diseño mejorado
   */
  showLoginModal() {
    return new Promise((resolve) => {
      // Crear modal con fondo animado
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%);
        background-size: 200% 200%;
        animation: gradientShift 10s ease infinite;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        opacity: 0;
        animation: fadeIn 0.5s forwards;
      `;

      // Agregar animaciones CSS
      const style = document.createElement('style');
      style.textContent = `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.5); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.8), 0 0 60px rgba(139, 92, 246, 0.4); }
        }
      `;
      document.head.appendChild(style);

      const container = document.createElement('div');
      container.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        padding: 50px 40px;
        border-radius: 30px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.4),
                    0 0 100px rgba(139, 92, 246, 0.3);
        max-width: 450px;
        width: 90%;
        text-align: center;
        animation: slideUp 0.6s ease-out;
        border: 2px solid rgba(255,255,255,0.3);
      `;

      // Logo animado con efecto de robot
      const logo = document.createElement('div');
      logo.style.cssText = `
        font-size: 80px;
        margin-bottom: 15px;
        animation: pulse 2s ease-in-out infinite;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.2));
      `;
      logo.textContent = '🤖';

      const title = document.createElement('h1');
      title.style.cssText = `
        margin: 0 0 10px 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        font-size: 42px;
        font-weight: 900;
        letter-spacing: -1px;
        text-shadow: 0 2px 10px rgba(0,0,0,0.1);
      `;
      title.textContent = 'BUMBLEBEE';

      const subtitle = document.createElement('p');
      subtitle.style.cssText = `
        margin: 0 0 35px 0;
        color: #666;
        font-size: 16px;
        font-weight: 500;
      `;
      subtitle.innerHTML = '🎮 ¡Prepárate para la aventura! 🚀';

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'username-input';
      input.placeholder = '✨ Tu nombre de héroe';
      input.maxLength = 20;
      input.style.cssText = `
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 20px;
        transition: all 0.3s ease;
        font-weight: 500;
        background: rgba(255,255,255,0.9);
        outline: none;
      `;

      const button = document.createElement('button');
      button.id = 'login-btn';
      button.style.cssText = `
        width: 100%;
        padding: 18px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 15px;
        font-size: 19px;
        font-weight: 900;
        cursor: pointer;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        position: relative;
        overflow: hidden;
      `;
      button.innerHTML = '🚀 INICIAR AVENTURA';

      // Ensamblar modal
      container.appendChild(logo);
      container.appendChild(title);
      container.appendChild(subtitle);
      container.appendChild(input);
      container.appendChild(button);
      modal.appendChild(container);
      document.body.appendChild(modal);

      // Foco automático
      setTimeout(() => input.focus(), 150);

      // Hover effects mejorados
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-3px) scale(1.02)';
        button.style.boxShadow = '0 15px 35px rgba(102, 126, 234, 0.6)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = '0 10px 25px rgba(102, 126, 234, 0.4)';
      });

      // Input focus effect mejorado
      input.addEventListener('focus', () => {
        input.style.borderColor = '#667eea';
        input.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
        input.style.transform = 'scale(1.02)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#e0e0e0';
        input.style.boxShadow = 'none';
        input.style.transform = 'scale(1)';
      });

      const handleLogin = () => {
        const username = input.value.trim();

        if (!username || username.length < 2) {
          input.style.borderColor = '#ff4444';
          input.style.animation = 'shake 0.5s';
          input.placeholder = '❌ Mínimo 2 caracteres';
          input.value = '';
          setTimeout(() => {
            input.style.borderColor = '#e0e0e0';
            input.placeholder = '✨ Tu nombre de héroe';
          }, 2000);
          return;
        }

        // Animación de carga en botón
        button.innerHTML = '⏳ Cargando...';
        button.style.pointerEvents = 'none';

        setTimeout(() => {
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

          // Animación de éxito
          button.innerHTML = '✅ ¡Listo!';
          button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

          // Remover modal con animación
          setTimeout(() => {
            modal.style.transition = 'opacity 0.5s, transform 0.5s';
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            setTimeout(() => {
              modal.remove();
              resolve();
            }, 500);
          }, 500);
        }, 800);
      };

      // Enter key
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
      });

      // Click button
      button.addEventListener('click', handleLogin);
    });
  }

  /**
   * Crear botón de logout flotante con diseño mejorado
   */
  createLogoutButton() {
    // Verificar si ya existe
    if (this.logoutButton) return;

    this.logoutButton = document.createElement('button');
    this.logoutButton.innerHTML = `
      <span style="font-size: 20px; margin-right: 10px;">👤</span>
      <span id="username-display" style="font-weight: 700;">${this.getUsername()}</span>
      <span style="margin-left: 10px; font-size: 18px; opacity: 0.7;">🚪</span>
    `;

    Object.assign(this.logoutButton.style, {
      position: 'fixed',
      top: '25px',
      right: '25px',
      padding: '14px 24px',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%)',
      backdropFilter: 'blur(10px)',
      color: '#1f2937',
      border: '2px solid transparent',
      borderImage: 'linear-gradient(135deg, #667eea, #764ba2) 1',
      borderRadius: '50px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      zIndex: '9998',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 8px 20px rgba(102, 126, 234, 0.25), 0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '0.3px'
    });

    // Hover effect mejorado
    this.logoutButton.addEventListener('mouseenter', () => {
      this.logoutButton.style.transform = 'translateY(-3px) scale(1.03)';
      this.logoutButton.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.35), 0 4px 8px rgba(0,0,0,0.15)';
      this.logoutButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      this.logoutButton.style.color = 'white';
    });

    this.logoutButton.addEventListener('mouseleave', () => {
      this.logoutButton.style.transform = 'translateY(0) scale(1)';
      this.logoutButton.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.25), 0 2px 4px rgba(0,0,0,0.1)';
      this.logoutButton.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%)';
      this.logoutButton.style.color = '#1f2937';
    });

    // Click handler
    this.logoutButton.addEventListener('click', () => {
      this.logout();
    });

    // Animación de entrada
    this.logoutButton.style.opacity = '0';
    this.logoutButton.style.transform = 'translateY(-20px)';
    document.body.appendChild(this.logoutButton);

    setTimeout(() => {
      this.logoutButton.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      this.logoutButton.style.opacity = '1';
      this.logoutButton.style.transform = 'translateY(0)';
    }, 100);

    logger.info('👤🔘', 'Botón de logout creado con diseño mejorado');
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
