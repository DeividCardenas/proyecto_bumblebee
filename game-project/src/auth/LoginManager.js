import logger from '../utils/Logger.js';
import AuthService from './AuthService.js';

/**
 * LoginManager - Sistema de autenticación y progreso del jugador
 * Funcionalidades:
 * - Login/Registro con backend JWT
 * - Sincronización de progreso con servidor
 * - Fallback a localStorage si el servidor no está disponible
 * - Tracking de nivel, puntos y tiempo jugado
 */
export default class LoginManager {
  constructor() {
    this.currentUser = null;
    this.storageKey = 'bumblebee_user_data';
    this.logoutButton = null;
    this.useBackend = true; // Intentar usar backend por defecto

    // Verificar si hay sesión existente
    this.checkExistingSession();
  }

  /**
   * Verificar si existe una sesión guardada
   */
  async checkExistingSession() {
    try {
      // Intentar restaurar sesión del backend
      if (AuthService.isAuthenticated()) {
        const isValid = await AuthService.verifyToken();

        if (isValid) {
          const user = await AuthService.getProfile();
          this.currentUser = this.mapBackendUser(user);
          logger.info('👤', `Sesión restaurada desde backend: ${this.currentUser.username}`);
          this.createLogoutButton();
          return true;
        }
      }

      // Fallback a localStorage (modo offline)
      const savedData = localStorage.getItem(this.storageKey);
      if (savedData) {
        this.currentUser = JSON.parse(savedData);
        this.useBackend = false;
        logger.info('👤', `Sesión restaurada desde localStorage (offline): ${this.currentUser.username}`);
        this.createLogoutButton();
        return true;
      }
    } catch (error) {
      logger.error('Error al restaurar sesión:', error);
      // Intentar fallback a localStorage
      try {
        const savedData = localStorage.getItem(this.storageKey);
        if (savedData) {
          this.currentUser = JSON.parse(savedData);
          this.useBackend = false;
          logger.warn('⚠️ Usando modo offline por error en backend');
          this.createLogoutButton();
          return true;
        }
      } catch (e) {
        localStorage.removeItem(this.storageKey);
      }
    }
    return false;
  }

  /**
   * Mapear usuario del backend al formato local
   */
  mapBackendUser(backendUser) {
    return {
      id: backendUser.id,
      username: backendUser.username,
      email: backendUser.email,
      createdAt: backendUser.createdAt,
      progress: {
        currentLevel: backendUser.gameStats.level,
        totalPoints: backendUser.gameStats.highScore,
        totalTimePlayed: backendUser.gameStats.totalPlayTime,
        levelsCompleted: [],
        totalGamesPlayed: backendUser.gameStats.totalGamesPlayed
      },
      isBackendUser: true
    };
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
   * Mostrar modal de login/registro mejorado con backend
   */
  showLoginModal() {
    return new Promise((resolve) => {
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `;
      document.head.appendChild(style);

      const container = document.createElement('div');
      container.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        padding: 50px 40px;
        border-radius: 30px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.4);
        max-width: 450px;
        width: 90%;
        text-align: center;
        animation: slideUp 0.6s ease-out;
        border: 2px solid rgba(255,255,255,0.3);
      `;

      const logo = document.createElement('div');
      logo.style.cssText = `
        font-size: 80px;
        margin-bottom: 15px;
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

      // Tabs para Login/Registro
      const tabsContainer = document.createElement('div');
      tabsContainer.style.cssText = `
        display: flex;
        margin-bottom: 25px;
        border-bottom: 2px solid #e0e0e0;
      `;

      const loginTab = this.createTab('Iniciar Sesión', true);
      const registerTab = this.createTab('Registrarse', false);

      tabsContainer.appendChild(loginTab);
      tabsContainer.appendChild(registerTab);

      // Formulario de Login
      const loginForm = this.createLoginForm();

      // Formulario de Registro
      const registerForm = this.createRegisterForm();
      registerForm.style.display = 'none';

      // Switch entre tabs
      loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      });

      registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
      });

      // Ensamblar modal
      container.appendChild(logo);
      container.appendChild(title);
      container.appendChild(subtitle);
      container.appendChild(tabsContainer);
      container.appendChild(loginForm);
      container.appendChild(registerForm);
      modal.appendChild(container);
      document.body.appendChild(modal);

      // Handlers
      this.setupLoginHandler(loginForm, modal, resolve);
      this.setupRegisterHandler(registerForm, modal, resolve);

      // Foco automático
      setTimeout(() => loginForm.querySelector('input').focus(), 150);
    });
  }

  createTab(text, active) {
    const tab = document.createElement('div');
    tab.style.cssText = `
      flex: 1;
      padding: 15px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
      color: ${active ? '#667eea' : '#999'};
      border-bottom: 3px solid ${active ? '#667eea' : 'transparent'};
    `;
    tab.textContent = text;
    if (active) tab.classList.add('active');

    tab.addEventListener('mouseenter', () => {
      if (!tab.classList.contains('active')) {
        tab.style.color = '#667eea';
      }
    });
    tab.addEventListener('mouseleave', () => {
      if (!tab.classList.contains('active')) {
        tab.style.color = '#999';
      }
    });

    return tab;
  }

  createLoginForm() {
    const form = document.createElement('div');
    form.innerHTML = `
      <input type="email" id="login-email" placeholder="📧 Email" style="
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        font-weight: 500;
        outline: none;
      "/>
      <input type="password" id="login-password" placeholder="🔒 Contraseña" style="
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 20px;
        transition: all 0.3s ease;
        font-weight: 500;
        outline: none;
      "/>
      <button id="login-btn" style="
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
      ">🚀 INICIAR SESIÓN</button>
    `;
    return form;
  }

  createRegisterForm() {
    const form = document.createElement('div');
    form.innerHTML = `
      <input type="text" id="register-username" placeholder="✨ Nombre de usuario" maxlength="30" style="
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        font-weight: 500;
        outline: none;
      "/>
      <input type="email" id="register-email" placeholder="📧 Email" style="
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        font-weight: 500;
        outline: none;
      "/>
      <input type="password" id="register-password" placeholder="🔒 Contraseña (min. 6 caracteres)" style="
        width: 100%;
        padding: 18px 20px;
        border: 3px solid #e0e0e0;
        border-radius: 15px;
        font-size: 17px;
        box-sizing: border-box;
        margin-bottom: 20px;
        transition: all 0.3s ease;
        font-weight: 500;
        outline: none;
      "/>
      <button id="register-btn" style="
        width: 100%;
        padding: 18px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        border-radius: 15px;
        font-size: 19px;
        font-weight: 900;
        cursor: pointer;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
      ">✅ REGISTRARSE</button>
    `;
    return form;
  }

  setupLoginHandler(form, modal, resolve) {
    const emailInput = form.querySelector('#login-email');
    const passwordInput = form.querySelector('#login-password');
    const button = form.querySelector('#login-btn');

    const handleLogin = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        this.showError(emailInput, '❌ Por favor completa todos los campos');
        return;
      }

      button.innerHTML = '⏳ Cargando...';
      button.style.pointerEvents = 'none';

      try {
        const data = await AuthService.login(email, password);
        this.currentUser = this.mapBackendUser(data.user);
        this.useBackend = true;
        this.saveProgress();

        logger.info('👤✅', `Usuario logueado: ${this.currentUser.username}`);
        this.createLogoutButton();

        button.innerHTML = '✅ ¡Listo!';
        button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

        setTimeout(() => this.closeModal(modal, resolve), 800);
      } catch (error) {
        button.innerHTML = '🚀 INICIAR SESIÓN';
        button.style.pointerEvents = 'auto';
        this.showError(emailInput, error.message || 'Error al iniciar sesión');
      }
    };

    button.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  setupRegisterHandler(form, modal, resolve) {
    const usernameInput = form.querySelector('#register-username');
    const emailInput = form.querySelector('#register-email');
    const passwordInput = form.querySelector('#register-password');
    const button = form.querySelector('#register-btn');

    const handleRegister = async () => {
      const username = usernameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!username || !email || !password) {
        this.showError(usernameInput, '❌ Por favor completa todos los campos');
        return;
      }

      if (username.length < 3) {
        this.showError(usernameInput, '❌ El nombre debe tener al menos 3 caracteres');
        return;
      }

      if (password.length < 6) {
        this.showError(passwordInput, '❌ La contraseña debe tener al menos 6 caracteres');
        return;
      }

      button.innerHTML = '⏳ Creando cuenta...';
      button.style.pointerEvents = 'none';

      try {
        const data = await AuthService.register(username, email, password);
        this.currentUser = this.mapBackendUser(data.user);
        this.useBackend = true;
        this.saveProgress();

        logger.info('👤✅', `Usuario registrado: ${this.currentUser.username}`);
        this.createLogoutButton();

        button.innerHTML = '✅ ¡Cuenta creada!';

        setTimeout(() => this.closeModal(modal, resolve), 800);
      } catch (error) {
        button.innerHTML = '✅ REGISTRARSE';
        button.style.pointerEvents = 'auto';
        this.showError(usernameInput, error.message || 'Error al registrar usuario');
      }
    };

    button.addEventListener('click', handleRegister);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleRegister();
    });
  }

  showError(input, message) {
    input.style.borderColor = '#ff4444';
    input.style.animation = 'shake 0.5s';
    input.placeholder = message;
    input.value = '';
    setTimeout(() => {
      input.style.borderColor = '#e0e0e0';
      input.style.animation = '';
    }, 2000);
  }

  closeModal(modal, resolve) {
    modal.style.transition = 'opacity 0.5s, transform 0.5s';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.95)';
    setTimeout(() => {
      modal.remove();
      resolve();
    }, 500);
  }

  /**
   * Crear botón de logout flotante
   */
  createLogoutButton() {
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
      boxShadow: '0 8px 20px rgba(102, 126, 234, 0.25)',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '0.3px'
    });

    this.logoutButton.addEventListener('mouseenter', () => {
      this.logoutButton.style.transform = 'translateY(-3px) scale(1.03)';
      this.logoutButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      this.logoutButton.style.color = 'white';
    });

    this.logoutButton.addEventListener('mouseleave', () => {
      this.logoutButton.style.transform = 'translateY(0) scale(1)';
      this.logoutButton.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%)';
      this.logoutButton.style.color = '#1f2937';
    });

    this.logoutButton.addEventListener('click', () => this.logout());

    this.logoutButton.style.opacity = '0';
    document.body.appendChild(this.logoutButton);

    setTimeout(() => {
      this.logoutButton.style.transition = 'all 0.5s';
      this.logoutButton.style.opacity = '1';
    }, 100);
  }

  /**
   * Cerrar sesión
   */
  logout() {
    if (!this.currentUser) return;

    const confirmed = confirm(`¿Seguro que quieres cerrar sesión, ${this.currentUser.username}?`);
    if (!confirmed) return;

    logger.info('👤🚪', `Cerrando sesión de: ${this.currentUser.username}`);

    if (this.useBackend) {
      AuthService.logout();
    }

    this.currentUser = null;
    localStorage.removeItem(this.storageKey);

    if (this.logoutButton) {
      this.logoutButton.remove();
      this.logoutButton = null;
    }

    setTimeout(() => window.location.reload(), 300);
  }

  /**
   * Guardar progreso (localStorage como backup)
   */
  saveProgress() {
    if (!this.currentUser) return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      logger.debug('💾', 'Progreso guardado localmente');
    } catch (error) {
      logger.error('Error al guardar progreso:', error);
    }
  }

  /**
   * Actualizar progreso del jugador
   */
  async updateProgress(level, points, timePlayed) {
    if (!this.currentUser) return;

    this.currentUser.progress.currentLevel = Math.max(
      this.currentUser.progress.currentLevel,
      level
    );
    this.currentUser.progress.totalPoints += points;
    this.currentUser.progress.totalTimePlayed += timePlayed;
    this.currentUser.progress.totalGamesPlayed = (this.currentUser.progress.totalGamesPlayed || 0) + 1;

    // Guardar localmente
    this.saveProgress();

    // Sincronizar con backend si está disponible
    if (this.useBackend && this.currentUser.isBackendUser) {
      try {
        await AuthService.updateGameStats({
          highScore: this.currentUser.progress.totalPoints,
          level: this.currentUser.progress.currentLevel,
          totalGamesPlayed: this.currentUser.progress.totalGamesPlayed,
          totalPlayTime: this.currentUser.progress.totalTimePlayed
        });
        logger.info('📊', `Progreso sincronizado con servidor: Nivel ${level}, +${points} puntos`);
      } catch (error) {
        logger.error('Error al sincronizar con backend:', error);
      }
    } else {
      logger.info('📊', `Progreso guardado localmente: Nivel ${level}, +${points} puntos`);
    }
  }

  /**
   * Obtener progreso actual
   */
  getProgress() {
    return this.currentUser?.progress || {
      currentLevel: 1,
      totalPoints: 0,
      totalTimePlayed: 0,
      levelsCompleted: [],
      totalGamesPlayed: 0
    };
  }
}
