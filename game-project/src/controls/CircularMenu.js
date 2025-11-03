import gsap from 'gsap'

export default class CircularMenu {
  constructor({ container, onAudioToggle, onWalkMode, onFullscreen, onCancelGame }) {
    this.container = container
    this.isOpen = false
    this.actionButtons = []

    // Estilo base de los botones
    const baseStyle = `
      position: fixed;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(0, 255, 247, 0.12);
      color: #00fff7;
      font-size: 20px;
      border: 1px solid rgba(0, 255, 247, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px #00fff7;
      backdrop-filter: blur(4px);
      z-index: 9999;
      transition: all 0.3s ease;
    `

    const hoverStyle = `
      background: rgba(0, 255, 247, 0.25);
      box-shadow: 0 0 15px #00fff7, 0 0 30px #00fff7;
      transform: scale(1.1);
    `

    // Botón flotante principal ⚙️
    this.toggleButton = document.createElement('button')
    this.toggleButton.innerText = '⚙️'
    this.toggleButton.title = 'Mostrar menú'
    this.toggleButton.setAttribute('aria-label', 'Mostrar menú')
    this.toggleButton.style.cssText = baseStyle + 'top: 80px; right: 20px;'
    container.appendChild(this.toggleButton)
    // Ocultar inicialmente
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())

    // Lista de botones de acción
    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo Caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla Completa', onClick: onFullscreen },
      { icon: '👨‍💻', title: 'Acerca de', onClick: () => this.showAboutModal() },
      { icon: '❌', title: 'Cancelar Juego', onClick: onCancelGame }
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.innerText = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)

      Object.assign(btn.style, {
        position: 'fixed',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(0, 255, 247, 0.12)',
        color: '#00fff7',
        fontSize: '20px',
        border: '1px solid rgba(0, 255, 247, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px #00fff7',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        top: `${140 + index * 60}px`,
        right: '20px',
        opacity: '0',
        pointerEvents: 'none'
      })

      btn.addEventListener('click', () => {
        action.onClick()
        this.toggleMenu()
      })

      btn.addEventListener('mouseenter', () => btn.style.cssText += hoverStyle)
      btn.addEventListener('mouseleave', () => btn.style.cssText = btn.style.cssText.replace(hoverStyle, ''))

      this.container.appendChild(btn)
      this.actionButtons.push(btn)
    })

    // HUD: Diseño mejorado con estilo moderno
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const fontSize = isMobile ? '17px' : '15px'
    const padding = isMobile ? '12px 18px' : '10px 16px'

    // Estilos base para HUD mejorado
    const hudBaseStyle = {
      position: 'fixed',
      fontSize: fontSize,
      fontWeight: '700',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
      backdropFilter: 'blur(12px)',
      color: '#e2e8f0',
      padding: padding,
      borderRadius: '16px',
      zIndex: 9997,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      pointerEvents: 'none',
      border: '2px solid rgba(139, 92, 246, 0.4)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 40px rgba(139, 92, 246, 0.15)',
      letterSpacing: '0.3px',
      transition: 'all 0.3s ease'
    }

    // HUD: Tiempo (izquierda superior)
    this.timer = document.createElement('div')
    this.timer.id = 'hud-timer'
    this.timer.innerHTML = '<span style="font-size: 20px; margin-right: 8px;">⏱</span><span style="color: #a78bfa;">0s</span>'
    Object.assign(this.timer.style, {
      ...hudBaseStyle,
      top: '25px',
      left: '25px'
    })
    document.body.appendChild(this.timer)

    // HUD: Puntos (parte superior central-derecha con estilo destacado)
    this.status = document.createElement('div')
    this.status.id = 'hud-points'
    this.status.innerHTML = '<span style="font-size: 22px; margin-right: 10px;">🎖️</span><span style="color: #fbbf24; font-size: 18px; font-weight: 800;">0</span><span style="color: #94a3b8; margin-left: 6px; font-size: 13px;">puntos</span>'
    Object.assign(this.status.style, {
      position: 'fixed',
      top: '90px',
      right: '25px',
      fontSize: isMobile ? '16px' : '15px',
      fontWeight: '700',
      background: 'linear-gradient(135deg, rgba(30,27,75,0.95) 0%, rgba(74,58,147,0.95) 100%)',
      backdropFilter: 'blur(12px)',
      color: '#e2e8f0',
      padding: isMobile ? '14px 20px' : '12px 18px',
      borderRadius: '20px',
      zIndex: 9997,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      pointerEvents: 'none',
      border: '2px solid rgba(251, 191, 36, 0.5)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 50px rgba(251, 191, 36, 0.2)',
      letterSpacing: '0.5px',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '2px'
    })
    document.body.appendChild(this.status)

    // HUD: Jugadores
    this.playersLabel = document.createElement('div')
    this.playersLabel.id = 'hud-players'
    this.playersLabel.innerText = '👥 Jugadores: 1'
    Object.assign(this.playersLabel.style, {
      position: 'fixed',
      top: '16px',
      left: '140px',
      fontSize: fontSize,
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.75)',
      color: '#00fff7',
      padding: padding,
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      border: '1px solid rgba(0, 255, 247, 0.3)',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
    })
    document.body.appendChild(this.playersLabel)

  }

  //Mostrar modal acerca de
  showAboutModal() {
    if (this.aboutContainer) return // evita duplicados

    this.aboutContainer = document.createElement('div')
    Object.assign(this.aboutContainer.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.95)',
      padding: '20px',
      borderRadius: '12px',
      color: '#fff',
      zIndex: 10000,
      textAlign: 'center',
      fontFamily: 'sans-serif',
      maxWidth: '300px',
      boxShadow: '0 0 20px #00fff7'
    })

    this.aboutContainer.innerHTML = `
          <h2 style="margin-bottom: 10px;">👨‍💻 Desarrollador</h2>
          <p style="margin: 0;">Gustavo Sánchez Rodríguez</p>
          <p style="margin: 0; font-size: 14px;">Universidad Cooperativa de Colombia</p>
          <p style="margin: 10px 0 0; font-size: 13px;">Proyecto interactivo educativo con Three.js</p>
          <p style="margin: 10px 0 0; font-size: 13px;">guswillsan@gmail.com</p>
          <button style="
            margin-top: 12px;
            padding: 6px 14px;
            font-size: 14px;
            background: #00fff7;
            color: black;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Cerrar</button>
        `

    const closeBtn = this.aboutContainer.querySelector('button')
    closeBtn.onclick = () => {
      this.aboutContainer.remove()
      this.aboutContainer = null
    }

    document.body.appendChild(this.aboutContainer)
  }




  toggleMenu() {
    this.isOpen = !this.isOpen

    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          delay,
          duration: 0.3,
          ease: 'power2.out'
        })
      } else {
        gsap.to(btn, {
          opacity: 0,
          y: -10,
          pointerEvents: 'none',
          delay,
          duration: 0.2,
          ease: 'power2.in'
        })
      }
    })
  }

  setStatus(text) {
    if (!this.status) return

    // Extraer número de puntos del texto (formato esperado: "🎖️ Puntos: 5")
    const match = text.match(/(\d+)/)
    const points = match ? match[1] : '0'

    // Actualizar con HTML mejorado
    this.status.innerHTML = `<span style="font-size: 22px; margin-right: 10px;">🎖️</span><span style="color: #fbbf24; font-size: 18px; font-weight: 800;">${points}</span><span style="color: #94a3b8; margin-left: 6px; font-size: 13px;">puntos</span>`

    // Animación de pulso cuando aumentan los puntos
    if (parseInt(points) > 0) {
      this.status.style.transform = 'scale(1.1)'
      setTimeout(() => {
        this.status.style.transform = 'scale(1)'
      }, 200)
    }
  }

  setTimer(seconds) {
    if (!this.timer) return

    // Actualizar con HTML mejorado
    this.timer.innerHTML = `<span style="font-size: 20px; margin-right: 8px;">⏱</span><span style="color: #a78bfa;">${seconds}s</span>`
  }

  //Contador jugadores
  setPlayerCount(count) {
    if (this.playersLabel) {
      this.playersLabel.innerText = `👥 Jugadores: ${count}`
    }
  }


  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach(btn => btn.remove())
    this.timer?.remove()
    this.status?.remove()
  }
}
