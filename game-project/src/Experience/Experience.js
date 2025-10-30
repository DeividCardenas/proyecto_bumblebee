import * as THREE from 'three'
import Debug from './Utils/Debug.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import VRIntegration from '../integrations/VRIntegration.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import ModalManager from './Utils/ModalManager.js'
import World from './World/World.js'
import Resources from './Utils/Resources.js'
import sources from './sources.js'
import Sounds from './World/Sound.js'
import KeyboardControls from './Utils/KeyboardControls.js'
import GameTracker from './Utils/GameTracker.js'
import Physics from './Utils/Physics.js'
import cannonDebugger from 'cannon-es-debugger'
import CircularMenu from '../controls/CircularMenu.js'
import { Howler } from 'howler'
import SocketManager from '../network/SocketManager.js'
import { FEATURES } from '../config/FeatureFlags.js'
import { GAME_CONFIG } from '../config/GameConfig.js'
import logger from '../utils/Logger.js'

let instance = null

export default class Experience {
  constructor(_canvas) {
    if (instance) return instance
    instance = this

    // Global access
    window.experience = this
    this.canvas = _canvas

    // Flag de interacción
    window.userInteracted = false

    // Core setup
    this.debug = new Debug()
    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()
    this.physics = new Physics()

    // Debugger de física (solo si está habilitado)
    if (FEATURES.PHYSICS_DEBUG) {
      this.debugger = cannonDebugger(this.scene, this.physics.world, { color: 0x00ff00 })
    }

    this.keyboard = new KeyboardControls()

    this.scene.background = new THREE.Color('#87ceeb')

    logger.info('🎮', 'Experience inicializada')

    // Recursos
    this.resources = new Resources(sources)

    this.resources.on('ready', () => {
      // Mostrar modal solo cuando los recursos estén listos
      this.modal.show({
        icon: '🚀',
        message: 'Recoge todas las monedas\n¡y evita los obstáculos!',
        buttons: [
          {
            text: '▶️ Iniciar juego',
            onClick: () => this.startGame()
          }
        ]
      })

      // Ocultar precarga si existe
      const overlay = document.querySelector('.loader-overlay')
      if (overlay) {
        overlay.classList.add('fade-out')
        setTimeout(() => overlay.remove(), GAME_CONFIG.ui.fadeOutDuration)
      }
    })

    
    // Cámara y renderer
    this.camera = new Camera(this)
    this.renderer = new Renderer(this)

    // 🚀 Dolly para VR movement
    this.vrDolly = new THREE.Group()
    this.vrDolly.name = 'VR_DOLLY'
    this.vrDolly.add(this.camera.instance)
    this.scene.add(this.vrDolly)


    // Sistema multijugador (controlado por feature flag)
    if (FEATURES.MULTIPLAYER_ENABLED) {
      this.socketManager = new SocketManager(this)
      logger.info('🔌', 'SocketManager inicializado')
    }


    // Modal y VR
    this.modal = new ModalManager({ container: document.body })
    this.vr = new VRIntegration({
      renderer: this.renderer.instance,
      scene: this.scene,
      camera: this.camera.instance,
      vrDolly: this.vrDolly,
      modalManager: this.modal,
      experience: this
    })

    // Menú
    this.menu = new CircularMenu({
      container: document.body,
      vrIntegration: this.vr,
      onAudioToggle: () => this.world.toggleAudio(),
      onWalkMode: () => {
        this.resumeAudioContext()
        this.toggleWalkMode()
      },
      onFullscreen: () => {
        if (!document.fullscreenElement) {
          document.body.requestFullscreen()
        } else {
          document.exitFullscreen()
        }
      },
      onCancelGame: () => this.tracker.handleCancelGame() // 🔴 aquí se integra la lógica central
    })

    // Activar tiempos
    if (this.tracker) {
      this.tracker.destroy()
    }

    this.tracker = new GameTracker({ modal: this.modal, menu: this.menu })


    // Mundo
    this.world = new World(this)

    // Flag tercera persona
    this.isThirdPerson = false

    // Iniciar loop adecuado
    this.startLoop()

    // Resize
    this.sizes.on('resize', () => this.resize())

    // Sonidos
    this.sounds = new Sounds({ time: this.time, debug: this.debug })

    // Detectar gesto del usuario
    window.addEventListener('click', this.handleFirstInteraction, { once: true })
    window.addEventListener('touchstart', this.handleFirstInteraction, { once: true })
  }

  //Control de audio
  handleFirstInteraction() {
    const ctx = Howler.ctx
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('🔊 AudioContext reanudado por interacción del usuario.')
      }).catch((err) => {
        console.warn('⚠️ Error reanudando AudioContext:', err)
      })
    }
    window.userInteracted = true
  }

  resumeAudioContext() {
    const ctx = Howler.ctx
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('🔊 AudioContext reanudado manualmente')
      }).catch((err) => {
        console.warn('⚠️ Error reanudando AudioContext:', err)
      })
    }
  }

  toggleWalkMode() {
    this.isThirdPerson = !this.isThirdPerson

    const controls = this.camera.controls
    const cam = this.camera.instance

    if (this.isThirdPerson) {
      controls.enabled = false
      console.log('🟡 Tercera persona ON')
    } else {
      controls.enabled = true
      controls.enableRotate = true
      controls.enableZoom = true
      controls.enablePan = false
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI * 0.9

      cam.position.set(12, 5, 10)
      cam.up.set(0, 1, 0)
      controls.target.set(0, 0, 0)
      cam.lookAt(controls.target)
      controls.update()

      console.log('🟢 Vista global restaurada')
    }
  }

  startLoop() {
    this.vr.setUpdateCallback((delta) => this.update(delta))

    this.time.on('tick', () => {
      if (!this.renderer.instance.xr.isPresenting) {
        const delta = this.time.delta * 0.001
        this.update(delta)
      }
    })
  }

  resize() {
    this.camera.resize()
    this.renderer.resize()
  }

  update(delta) {
    if (!this.isThirdPerson && !this.renderer.instance.xr.isPresenting) {
      this.camera.update()
    }

    if (this.renderer.instance.xr.isPresenting) {
      this.adjustCameraForVR()
    }

    this.world.update(delta)
    this.renderer.update()
    this.physics.update(delta)

    // Actualizar multiplayer si está habilitado
    if (FEATURES.MULTIPLAYER_ENABLED) {
      this.socketManager?.update()
    }

    // Actualizar debugger de física si está habilitado
    if (FEATURES.PHYSICS_DEBUG && this.debugger) {
      this.debugger.update()
    }
  }

  adjustCameraForVR() {
    if (this.renderer.instance.xr.isPresenting && this.world.robot?.group) {
      const pos = this.world.robot.group.position
      this.camera.instance.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0))
      this.camera.instance.lookAt(pos.clone().add(new THREE.Vector3(0, 1.6, -1)))
      // console.log('🎯 Cámara ajustada a robot en VR')
    }
  }

  destroy() {
    this.sizes.off('resize')
    this.time.off('tick')

    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose && mat.dispose())
        } else {
          child.material.dispose?.()
        }

      }
    })

    this.camera.controls.dispose()
    this.renderer.instance.dispose()
    if (this.debug.active) this.debug.ui.destroy()
  }

  startGame() {
    logger.info('🎮', 'Juego iniciado')
    this.isThirdPerson = true // Asegurar modo tercera persona
    this.tracker.start()
    if (this.menu && this.menu.toggleButton && this.menu.toggleButton.style) {
      this.menu.toggleButton.style.display = 'block'
    }
    if (this.world) {
      this.world.gameStarted = true
    }
  }



  /**
   * Resetea el estado común del juego
   * Método base reutilizado por resetGame() y resetGameToFirstLevel()
   * @private
   */
  _resetGameState() {
    // Limpiar enemigos
    if (Array.isArray(this.world?.enemies)) {
      this.world.enemies.forEach(e => e?.destroy?.())
      this.world.enemies = []
    }

    // Resetear puntos
    if (this.world) {
      this.world.points = 0
      this.world.defeatTriggered = false
      if (this.world.robot) this.world.robot.points = 0
      if (this.world.loader) this.world.loader.prizes = []
      this.world.finalPrizeActivated = false
    }

    // Limpiar tracker
    if (this.tracker) {
      this.tracker.destroy()
    }
  }

  /**
   * Reinicia completamente el juego (nueva instancia)
   * Se usa cuando el jugador quiere salir y empezar de cero
   */
  resetGame() {
    logger.info('♻️', 'Reiniciando juego completamente...')

    // Notificar desconexión al servidor (si está habilitado)
    if (FEATURES.MULTIPLAYER_ENABLED) {
      this.socketManager?.socket?.disconnect()
    }

    // Limpieza de UI
    if (this.menu) this.menu.destroy()

    // Limpiar socketManager si existe
    if (this.socketManager) {
      this.socketManager.destroy()
    }

    // Destruir instancia actual
    this.destroy()
    instance = null

    // Crear nueva instancia
    const newExperience = new Experience(this.canvas)
    newExperience.isThirdPerson = true

    // Limpiar UI residual
    const cancelBtn = document.getElementById('cancel-button')
    if (cancelBtn) cancelBtn.remove()

    newExperience.tracker?.hideGameButtons?.()

    logger.info('✅', 'Nueva instancia de juego creada')
  }

  /**
   * Reinicia al nivel 1 sin recrear la instancia
   * Se usa cuando el jugador muere y quiere reintentar
   */
  resetGameToFirstLevel() {
    logger.info('♻️', 'Reiniciando al nivel 1...')

    // Usar método base para limpiar estado común
    this._resetGameState()

    // Resetear nivel
    this.world.levelManager.currentLevel = 1

    // Limpiar y recargar
    this.world.clearCurrentScene()
    this.world.loadLevel(1)

    // Reiniciar tracker
    this.tracker = new GameTracker({ modal: this.modal, menu: this.menu })
    this.tracker.start()

    logger.info('✅', 'Juego reiniciado en nivel 1')
  }
}
