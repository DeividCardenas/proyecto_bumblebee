import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GAME_CONFIG } from '../config/GameConfig.js'
import logger from '../utils/Logger.js'

/**
 * Cámara principal con OrbitControls mejorados
 * Usada principalmente en modo libre/debug
 */
export default class Camera {
    constructor(experience) {
        this.experience = experience
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        // Configuración desde GameConfig
        this.config = GAME_CONFIG.camera

        this.setInstance()
        this.setControls()

        logger.info('📷', 'Cámara principal inicializada con OrbitControls mejorados')
    }

    setInstance() {
        const globalConfig = this.config.global

        this.instance = new THREE.PerspectiveCamera(
            globalConfig.fov,
            this.sizes.width / this.sizes.height,
            globalConfig.near,
            globalConfig.far
        )

        this.instance.position.set(
            globalConfig.defaultPosition.x,
            globalConfig.defaultPosition.y,
            globalConfig.defaultPosition.z
        )

        this.scene.add(this.instance)
    }

    setControls() {
        const orbitConfig = this.config.orbit

        this.controls = new OrbitControls(this.instance, this.canvas)

        // Damping (suavizado)
        this.controls.enableDamping = orbitConfig.enableDamping
        this.controls.dampingFactor = orbitConfig.dampingFactor

        // Habilitar/deshabilitar controles
        this.controls.enableZoom = orbitConfig.enableZoom
        this.controls.enablePan = orbitConfig.enablePan
        this.controls.enableRotate = orbitConfig.enableRotate

        // Límites de distancia (zoom)
        this.controls.minDistance = orbitConfig.minDistance
        this.controls.maxDistance = orbitConfig.maxDistance

        // Límites de ángulo vertical (evita inversión)
        this.controls.minPolarAngle = orbitConfig.minPolarAngle
        this.controls.maxPolarAngle = orbitConfig.maxPolarAngle

        // Velocidades
        this.controls.rotateSpeed = orbitConfig.rotateSpeed
        this.controls.zoomSpeed = orbitConfig.zoomSpeed
        this.controls.panSpeed = orbitConfig.panSpeed

        // Target inicial
        this.controls.target.set(
            this.config.global.target.x,
            this.config.global.target.y,
            this.config.global.target.z
        )

        this.controls.update()

        logger.debug('OrbitControls configurados:', {
            minDistance: orbitConfig.minDistance,
            maxDistance: orbitConfig.maxDistance,
            minPolarAngle: `${(orbitConfig.minPolarAngle * 180 / Math.PI).toFixed(1)}°`,
            maxPolarAngle: `${(orbitConfig.maxPolarAngle * 180 / Math.PI).toFixed(1)}°`
        })
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        this.controls.update()
    }

    /**
     * Habilitar/deshabilitar controles
     */
    setEnabled(enabled) {
        this.controls.enabled = enabled
    }

    /**
     * Resetear cámara a posición inicial
     */
    reset() {
        const globalConfig = this.config.global

        this.instance.position.set(
            globalConfig.defaultPosition.x,
            globalConfig.defaultPosition.y,
            globalConfig.defaultPosition.z
        )

        this.controls.target.set(
            globalConfig.target.x,
            globalConfig.target.y,
            globalConfig.target.z
        )

        this.controls.update()
        logger.debug('Cámara reseteada a posición inicial')
    }
}