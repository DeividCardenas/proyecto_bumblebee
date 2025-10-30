import * as THREE from 'three'
import { GAME_CONFIG } from '../../config/GameConfig.js'
import logger from '../../utils/Logger.js'

/**
 * Cámara de Primera Persona Mejorada
 *
 * Características:
 * - Control completo de mouse (horizontal y vertical)
 * - Límites de rotación vertical (pitch)
 * - Sensibilidad ajustable
 * - Suavizado configurable
 * - Opción de invertir eje Y
 * - Soporte para Pointer Lock API (opcional)
 */
export default class FirstPersonCamera {
    /**
     * @param {object} experience - Objeto principal de la experiencia
     * @param {THREE.Object3D} targetObject - El objeto a seguir (robot)
     */
    constructor(experience, targetObject) {
        this.experience = experience
        this.scene = experience.scene
        this.camera = experience.camera.instance
        this.canvas = experience.canvas
        this.target = targetObject

        // Configuración desde GameConfig
        this.config = GAME_CONFIG.camera.firstPerson

        // Offset de altura de ojos
        this.eyeOffset = new THREE.Vector3(0, this.config.eyeHeight, 0)

        // Ángulos de rotación
        this.yaw = 0    // Rotación horizontal
        this.pitch = 0  // Rotación vertical

        // Control de mouse
        this.isMouseLocked = false
        this.mouseMoveHandler = null

        // Posición y rotación suavizada
        this.currentPosition = new THREE.Vector3()
        this.targetRotation = new THREE.Euler()
        this.currentRotation = new THREE.Euler()

        this.setupMouseControl()

        logger.info('📷', 'FirstPersonCamera mejorada inicializada', {
            sensitivity: this.config.mouseSensitivity,
            pitchLimits: `${(this.config.minPitch * 180 / Math.PI).toFixed(0)}° a ${(this.config.maxPitch * 180 / Math.PI).toFixed(0)}°`,
            invertY: this.config.invertY
        })
    }

    /**
     * Configurar control de mouse
     */
    setupMouseControl() {
        // Mouse move handler
        this.mouseMoveHandler = (event) => this.handleMouseMove(event)

        // Click para capturar puntero (si lockPointer está habilitado)
        if (this.config.lockPointer) {
            this.canvas.addEventListener('click', () => {
                this.canvas.requestPointerLock()
            })

            // Pointer lock change events
            document.addEventListener('pointerlockchange', () => {
                this.isMouseLocked = document.pointerLockElement === this.canvas
            })
        }

        // Siempre escuchar mouse move
        document.addEventListener('mousemove', this.mouseMoveHandler)
    }

    /**
     * Manejar movimiento del mouse
     */
    handleMouseMove(event) {
        // Si lockPointer está deshabilitado, solo funciona con click derecho presionado
        if (!this.config.lockPointer && event.buttons !== 2) {
            return
        }

        // Obtener movimiento del mouse
        const movementX = event.movementX || event.mozMovementX || 0
        const movementY = event.movementY || event.mozMovementY || 0

        // Calcular sensibilidad total
        const horizontalSens = this.config.mouseSensitivity * this.config.horizontalSensitivity
        const verticalSens = this.config.mouseSensitivity * this.config.verticalSensitivity

        // Aplicar movimiento a los ángulos
        this.yaw -= movementX * horizontalSens
        this.pitch -= movementY * verticalSens * (this.config.invertY ? -1 : 1)

        // Limitar pitch (rotación vertical)
        this.pitch = Math.max(
            this.config.minPitch,
            Math.min(this.config.maxPitch, this.pitch)
        )

        // Normalizar yaw (opcional, evita números muy grandes)
        this.yaw = this.yaw % (Math.PI * 2)
    }

    /**
     * Update - Llamado cada frame
     */
    update() {
        if (!this.target) return

        // 1. Calcular posición de la cámara (altura de ojos)
        const basePosition = this.target.position.clone()
        const cameraPosition = basePosition.clone().add(this.eyeOffset)

        // Opcionalmente, mover ligeramente adelante
        if (this.config.lookAheadDistance > 0) {
            const forwardDirection = new THREE.Vector3(0, 0, -1)
            forwardDirection.applyEuler(this.target.rotation)
            forwardDirection.multiplyScalar(this.config.lookAheadDistance)
            cameraPosition.add(forwardDirection)
        }

        // 2. Suavizar posición (lerp)
        this.currentPosition.lerp(cameraPosition, this.config.positionLerp)
        this.camera.position.copy(this.currentPosition)

        // 3. Aplicar rotación basada en yaw y pitch
        // Combinamos la rotación del robot (Y) con la rotación de la cámara
        const targetYaw = this.target.rotation.y + this.yaw

        this.targetRotation.set(
            this.pitch,  // X (pitch - mirar arriba/abajo)
            targetYaw,   // Y (yaw - mirar izquierda/derecha)
            0            // Z (roll - no lo usamos)
        )

        // 4. Suavizar rotación (slerp con quaternions es mejor, pero para FPS lerp es suficiente)
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * this.config.rotationLerp
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * this.config.rotationLerp
        this.currentRotation.z = 0

        // 5. Aplicar rotación a la cámara
        this.camera.rotation.copy(this.currentRotation)
    }

    /**
     * Resetear rotación
     */
    reset() {
        this.yaw = 0
        this.pitch = 0
        this.currentRotation.set(0, 0, 0)
        this.targetRotation.set(0, 0, 0)

        logger.debug('FirstPersonCamera reseteada')
    }

    /**
     * Limpiar listeners
     */
    destroy() {
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler)
        }

        // Salir de pointer lock si está activo
        if (document.pointerLockElement === this.canvas) {
            document.exitPointerLock()
        }

        logger.debug('FirstPersonCamera destruida')
    }
}
