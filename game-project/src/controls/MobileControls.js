// src/Experience/World/MobileControls.js
import * as THREE from 'three'

export default class MobileControls {
  constructor({ onUp, onDown, onLeft, onRight }) {
    this.onUp = onUp
    this.onDown = onDown
    this.onLeft = onLeft
    this.onRight = onRight

    this.active = false
    this.direction = { up: false, down: false, left: false, right: false }
    this.directionVector = new THREE.Vector2(0, 0)
    this.intensity = 0
    this.moveActive = false

    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (this.isTouchDevice) {
      this.createJoystick()
      this.createJumpButton()
      this.createCameraHint()
    }
  }

  createJoystick() {
    // Detectar si es tablet para usar tamaño más grande
    const isTablet = window.innerWidth >= 768
    const containerSize = isTablet ? 160 : 140
    const stickSize = isTablet ? 70 : 60

    this.container = document.createElement('div')
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '5vh',
      left: '5vw',
      width: `${containerSize}px`,
      height: `${containerSize}px`,
      borderRadius: '50%',
      background: 'rgba(0, 255, 247, 0.15)',
      border: '3px solid rgba(0, 255, 247, 0.4)',
      boxShadow: '0 0 20px rgba(0, 255, 247, 0.3), inset 0 0 20px rgba(0, 255, 247, 0.1)',
      zIndex: '9999',
      touchAction: 'none',
      userSelect: 'none'
    })

    this.stick = document.createElement('div')
    Object.assign(this.stick.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: `${stickSize}px`,
      height: `${stickSize}px`,
      borderRadius: '50%',
      background: 'rgba(0, 255, 247, 0.8)',
      border: '2px solid rgba(255, 255, 255, 0.9)',
      boxShadow: '0 0 15px rgba(0, 255, 247, 0.6)',
      transform: 'translate(-50%, -50%)',
      transition: '0.1s',
      pointerEvents: 'none'
    })

    this.container.appendChild(this.stick)
    document.body.appendChild(this.container)

    this.center = { x: 0, y: 0 }
    this.radius = containerSize / 2

    this.container.addEventListener('touchstart', this.onStart.bind(this))
    this.container.addEventListener('touchmove', this.onMove.bind(this))
    this.container.addEventListener('touchend', this.onEnd.bind(this))
  }

  createJumpButton() {
    const isTablet = window.innerWidth >= 768
    const buttonSize = isTablet ? 80 : 70

    this.jumpButton = document.createElement('button')
    this.jumpButton.innerText = '🆙'
    Object.assign(this.jumpButton.style, {
      position: 'fixed',
      top: '40vh',
      left: '5vw',
      width: `${buttonSize}px`,
      height: `${buttonSize}px`,
      borderRadius: '50%',
      background: 'rgba(0, 255, 247, 0.25)',
      border: '3px solid rgba(0, 255, 247, 0.5)',
      color: '#00fff7',
      fontSize: isTablet ? '32px' : '28px',
      fontWeight: 'bold',
      zIndex: 9999,
      boxShadow: '0 0 20px rgba(0, 255, 247, 0.4)',
      touchAction: 'none',
      userSelect: 'none'
    })

    this.jumpButton.addEventListener('touchstart', () => {
      this.simulateSpacebar(true)
    })
    this.jumpButton.addEventListener('touchend', () => {
      this.simulateSpacebar(false)
    })

    document.body.appendChild(this.jumpButton)
  }

  onStart(e) {
    const rect = this.container.getBoundingClientRect()
    this.center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    this.active = true

    // Feedback visual: hacer brillar el joystick
    this.container.style.boxShadow = '0 0 30px rgba(0, 255, 247, 0.6), inset 0 0 30px rgba(0, 255, 247, 0.2)'
    this.container.style.borderColor = 'rgba(0, 255, 247, 0.7)'
  }

  onMove(e) {
    if (!this.active) return
    const touch = e.touches[0]
    const dx = touch.clientX - this.center.x
    const dy = touch.clientY - this.center.y

    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), this.radius)
    const angle = Math.atan2(dy, dx)

    const offsetX = Math.cos(angle) * dist
    const offsetY = Math.sin(angle) * dist

    this.stick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`

    const threshold = 20
    const dir = {
      up: dy < -threshold,
      down: dy > threshold,
      left: dx < -threshold,
      right: dx > threshold
    }

    const deadZone = 20
    if (dist < deadZone) {
      this.updateDirections({ up: false, down: false, left: false, right: false })
      this.intensity = 0
      return
    }

    this.intensity = Math.pow(dist / this.radius, 1.3) * 0.6

    const rawDir = new THREE.Vector2(dx, dy)
    if (rawDir.length() > 0) this.directionVector = rawDir.normalize()
    else this.directionVector.set(0, 0)

    this.updateDirections(dir)
  }

  onEnd(e) {
    this.active = false
    this.stick.style.transform = 'translate(-50%, -50%)'
    this.intensity = 0
    this.directionVector.set(0, 0)
    this.updateDirections({ up: false, down: false, left: false, right: false })

    // Restaurar brillo normal
    this.container.style.boxShadow = '0 0 20px rgba(0, 255, 247, 0.3), inset 0 0 20px rgba(0, 255, 247, 0.1)'
    this.container.style.borderColor = 'rgba(0, 255, 247, 0.4)'
  }

  updateDirections(newDir) {
    if (this.direction.up !== newDir.up) this.onUp?.(newDir.up)
    if (this.direction.down !== newDir.down) this.onDown?.(newDir.down)
    if (this.direction.left !== newDir.left) this.onLeft?.(newDir.left)
    if (this.direction.right !== newDir.right) this.onRight?.(newDir.right)

    this.direction = newDir
  }

  createCameraHint() {
    // Crear indicador de controles táctiles de cámara
    this.cameraHint = document.createElement('div')
    this.cameraHint.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">👆</span>
        <span>Desliza para rotar cámara</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        <span style="font-size: 20px;">🤏</span>
        <span>Pellizca para zoom</span>
      </div>
    `
    Object.assign(this.cameraHint.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#00fff7',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      zIndex: '9999',
      border: '1px solid rgba(0, 255, 247, 0.3)',
      boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)',
      pointerEvents: 'none',
      opacity: '0.9',
      transition: 'opacity 0.3s'
    })

    document.body.appendChild(this.cameraHint)

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
      if (this.cameraHint) {
        this.cameraHint.style.opacity = '0'
        setTimeout(() => {
          this.cameraHint?.remove()
        }, 300)
      }
    }, 5000)
  }

  simulateSpacebar(pressed) {
    if (!window.experience?.keyboard?.keys) return
    window.experience.keyboard.keys.space = pressed
  }

  destroy() {
    this.container?.remove()
    this.jumpButton?.remove()
    this.cameraHint?.remove()
  }
}
