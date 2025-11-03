// Sistema de autenticación y gestión de progreso del jugador
// Usa localStorage para guardar progreso localmente

export default class LoginManager {
    constructor() {
        this.currentUser = null
        this.storageKey = 'bumblebee_user_data'
        this.loginModal = null

        this.checkExistingSession()
    }

    /**
     * Verificar si hay una sesión guardada
     */
    checkExistingSession() {
        const savedData = localStorage.getItem(this.storageKey)
        if (savedData) {
            try {
                this.currentUser = JSON.parse(savedData)
                console.log('✅ Sesión restaurada:', this.currentUser.username)
                return true
            } catch (e) {
                console.error('Error al restaurar sesión:', e)
                localStorage.removeItem(this.storageKey)
            }
        }
        return false
    }

    /**
     * Mostrar modal de login
     */
    showLoginModal() {
        return new Promise((resolve) => {
            // Crear modal
            this.loginModal = document.createElement('div')
            this.loginModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                backdrop-filter: blur(10px);
            `

            this.loginModal.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 255, 247, 0.3);
                    border: 2px solid rgba(0, 255, 247, 0.5);
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                ">
                    <h2 style="
                        color: #00fff7;
                        margin-bottom: 10px;
                        font-family: 'Arial', sans-serif;
                        font-size: 32px;
                        text-shadow: 0 0 20px rgba(0, 255, 247, 0.5);
                    ">🎮 Proyecto Bumblebee</h2>
                    <p style="
                        color: #aaa;
                        margin-bottom: 30px;
                        font-size: 14px;
                    ">Ingresa tu nombre para guardar tu progreso</p>

                    <input
                        type="text"
                        id="username-input"
                        placeholder="Nombre de jugador"
                        maxlength="20"
                        style="
                            width: 100%;
                            padding: 15px;
                            font-size: 16px;
                            border: 2px solid rgba(0, 255, 247, 0.3);
                            border-radius: 10px;
                            background: rgba(255, 255, 255, 0.05);
                            color: white;
                            margin-bottom: 20px;
                            box-sizing: border-box;
                            outline: none;
                            transition: all 0.3s;
                        "
                    />

                    <button id="login-btn" style="
                        width: 100%;
                        padding: 15px;
                        font-size: 18px;
                        font-weight: bold;
                        background: linear-gradient(135deg, #00fff7 0%, #00d4ff 100%);
                        color: #000;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 5px 15px rgba(0, 255, 247, 0.4);
                    ">
                        Jugar Ahora
                    </button>

                    <div id="stats-container" style="
                        margin-top: 30px;
                        padding: 20px;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 10px;
                        display: none;
                    ">
                        <h3 style="color: #00fff7; margin-bottom: 15px;">📊 Tu Progreso</h3>
                        <div style="color: #fff; font-size: 14px; line-height: 2;">
                            <div>🏆 Nivel Alcanzado: <span id="level-stat">-</span></div>
                            <div>⭐ Puntos Totales: <span id="points-stat">-</span></div>
                            <div>⏱️ Tiempo Jugado: <span id="time-stat">-</span></div>
                        </div>
                    </div>
                </div>
            `

            document.body.appendChild(this.loginModal)

            const usernameInput = this.loginModal.querySelector('#username-input')
            const loginBtn = this.loginModal.querySelector('#login-btn')
            const statsContainer = this.loginModal.querySelector('#stats-container')

            // Focus en input
            setTimeout(() => usernameInput.focus(), 100)

            // Estilo hover del botón
            loginBtn.addEventListener('mouseenter', () => {
                loginBtn.style.transform = 'scale(1.05)'
                loginBtn.style.boxShadow = '0 8px 25px rgba(0, 255, 247, 0.6)'
            })
            loginBtn.addEventListener('mouseleave', () => {
                loginBtn.style.transform = 'scale(1)'
                loginBtn.style.boxShadow = '0 5px 15px rgba(0, 255, 247, 0.4)'
            })

            // Estilo focus del input
            usernameInput.addEventListener('focus', () => {
                usernameInput.style.borderColor = '#00fff7'
                usernameInput.style.boxShadow = '0 0 15px rgba(0, 255, 247, 0.3)'
            })
            usernameInput.addEventListener('blur', () => {
                usernameInput.style.borderColor = 'rgba(0, 255, 247, 0.3)'
                usernameInput.style.boxShadow = 'none'
            })

            // Mostrar stats si hay usuario guardado
            if (this.currentUser) {
                usernameInput.value = this.currentUser.username
                statsContainer.style.display = 'block'
                this.loginModal.querySelector('#level-stat').textContent = this.currentUser.progress.currentLevel
                this.loginModal.querySelector('#points-stat').textContent = this.currentUser.progress.totalPoints
                this.loginModal.querySelector('#time-stat').textContent = this.formatTime(this.currentUser.progress.totalTimePlayed)
            }

            // Handle login
            const handleLogin = () => {
                const username = usernameInput.value.trim()
                if (username.length < 2) {
                    usernameInput.style.borderColor = '#ff4444'
                    usernameInput.placeholder = 'Mínimo 2 caracteres'
                    setTimeout(() => {
                        usernameInput.style.borderColor = 'rgba(0, 255, 247, 0.3)'
                        usernameInput.placeholder = 'Nombre de jugador'
                    }, 2000)
                    return
                }

                if (this.currentUser && this.currentUser.username === username) {
                    // Usuario existente
                    console.log('👋 Bienvenido de nuevo,', username)
                } else {
                    // Nuevo usuario
                    this.currentUser = {
                        username: username,
                        createdAt: new Date().toISOString(),
                        progress: {
                            currentLevel: 1,
                            totalPoints: 0,
                            totalTimePlayed: 0,
                            levelsCompleted: []
                        }
                    }
                    this.saveProgress()
                    console.log('🎉 Nuevo jugador creado:', username)
                }

                this.loginModal.remove()
                resolve(this.currentUser)
            }

            loginBtn.addEventListener('click', handleLogin)
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin()
            })
        })
    }

    /**
     * Guardar progreso del jugador
     */
    saveProgress() {
        if (!this.currentUser) return

        this.currentUser.lastPlayed = new Date().toISOString()
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser))
        console.log('💾 Progreso guardado para', this.currentUser.username)
    }

    /**
     * Actualizar progreso (llamar cuando se completa un nivel)
     */
    updateProgress(level, points, timePlayed) {
        if (!this.currentUser) return

        this.currentUser.progress.currentLevel = Math.max(this.currentUser.progress.currentLevel, level)
        this.currentUser.progress.totalPoints += points
        this.currentUser.progress.totalTimePlayed += timePlayed

        if (!this.currentUser.progress.levelsCompleted.includes(level)) {
            this.currentUser.progress.levelsCompleted.push(level)
        }

        this.saveProgress()
    }

    /**
     * Obtener progreso actual
     */
    getProgress() {
        return this.currentUser?.progress || null
    }

    /**
     * Cerrar sesión
     */
    logout() {
        this.currentUser = null
        localStorage.removeItem(this.storageKey)
        console.log('👋 Sesión cerrada')
    }

    /**
     * Formatear tiempo en HH:MM:SS
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)

        if (hours > 0) {
            return `${hours}h ${mins}m ${secs}s`
        } else if (mins > 0) {
            return `${mins}m ${secs}s`
        } else {
            return `${secs}s`
        }
    }

    /**
     * Verificar si hay sesión activa
     */
    isLoggedIn() {
        return this.currentUser !== null
    }

    /**
     * Obtener nombre del usuario actual
     */
    getUsername() {
        return this.currentUser?.username || 'Invitado'
    }
}
