import * as THREE from 'three'
import { GAME_CONFIG } from '../../config/GameConfig.js'
import logger from '../../utils/Logger.js'

/**
 * Cámara de Tercera Persona Avanzada
 *
 * Características:
 * - Rotación horizontal (yaw) y vertical (pitch)
 * - Zoom dinámico con scroll del mouse
 * - Detección de colisiones con geometría (raycasting)
 * - Límites de rotación configurables
 * - Suavizado independiente para cada acción
 * - Configuración completa desde GameConfig
 */
export default class ThirdPersonCamera {
    /**
     * @param {object} experience - Objeto principal de la experiencia
     * @param {THREE.Group} targetGroup - El grupo del robot a seguir
     */
    constructor(experience, targetGroup) {
        this.experience = experience
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        // Cámara principal (la que renderiza)
        this.cameraInstance = this.experience.camera.instance

        // Objetivo a seguir
        this.target = targetGroup

        // Configuración desde GameConfig
        this.config = GAME_CONFIG.camera.thirdPerson

        // --- Offset y LookAt desde configuración ---
        this.baseOffset = new THREE.Vector3(
            this.config.offset.x,
            this.config.offset.y,
            this.config.offset.z
        )

        this.baseLookAtOffset = new THREE.Vector3(
            this.config.lookAtOffset.x,
            this.config.lookAtOffset.y,
            this.config.lookAtOffset.z
        )

        // --- Estado de la cámara ---
        this.currentPosition = new THREE.Vector3()
        this.currentLookAt = new THREE.Vector3()

        // --- Rotación ---
        this.horizontalAngle = 0  // Yaw (rotación horizontal)
        this.verticalAngle = 0    // Pitch (rotación vertical)

        // --- Zoom ---
        this.currentDistance = this.config.defaultDistance
        this.targetDistance = this.config.defaultDistance

        // --- Control de mouse ---
        this.isMouseDown = false
        this.lastMouseX = 0
        this.lastMouseY = 0

        // --- Raycaster para colisiones ---
        this.raycaster = new THREE.Raycaster()
        this.raycaster.far = this.config.maxDistance

        // Inicializar
        this.setMouseListeners()
        this.initializePosition()

        logger.info('📷', 'ThirdPersonCamera avanzada inicializada', {
            zoom: `${this.config.minDistance}-${this.config.maxDistance}`,
            pitch: `${(this.config.minPitch * 180 / Math.PI).toFixed(0)}° a ${(this.config.maxPitch * 180 / Math.PI).toFixed(0)}°`,
            collision: this.config.enableCollision
        })
    }

    /**
     * Inicializar posición de la cámara sin saltos
     */
    initializePosition() {
        if (!this.target) return

        const initialPos = this.calculateIdealPosition()
        const initialLookAt = this.calculateIdealLookAt()

        this.currentPosition.copy(initialPos)
        this.currentLookAt.copy(initialLookAt)

        this.cameraInstance.position.copy(initialPos)
        this.cameraInstance.lookAt(initialLookAt)
    }

    /**
     * Configurar listeners de mouse y scroll
     */
    setMouseListeners() {
        // Mouse drag para rotar
        this.onMouseDown = (e) => this.handleMouseDown(e)
        this.onMouseUp = () => this.handleMouseUp()
        this.onMouseMove = (e) => this.handleMouseMove(e)

        // Scroll para zoom
        this.onWheel = (e) => this.handleWheel(e)

        this.canvas.addEventListener('mousedown', this.onMouseDown)
        this.canvas.addEventListener('mouseup', this.onMouseUp)
        this.canvas.addEventListener('mousemove', this.onMouseMove)
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false })

        // Prevenir menú contextual
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    }

    /**
     * Mouse down - Iniciar rotación
     */
    handleMouseDown(event) {
        // Clic izquierdo (0) o derecho (2)
        if (event.button === 0 || event.button === 2) {
            this.isMouseDown = true
            this.lastMouseX = event.clientX
            this.lastMouseY = event.clientY
        }
    }

    /**
     * Mouse up - Detener rotación
     */
    handleMouseUp() {
        this.isMouseDown = false
    }

    /**
     * Mouse move - Rotar cámara
     */
    handleMouseMove(event) {
        if (!this.isMouseDown || !this.target) return

        const deltaX = event.clientX - this.lastMouseX
        const deltaY = event.clientY - this.lastMouseY

        this.lastMouseX = event.clientX
        this.lastMouseY = event.clientY

        // Rotación horizontal (yaw) - izquierda/derecha
        this.horizontalAngle -= deltaX * this.config.rotationSpeed

        // Rotación vertical (pitch) - arriba/abajo
        this.verticalAngle -= deltaY * this.config.verticalRotationSpeed

        // Limitar pitch para evitar inversión
        this.verticalAngle = Math.max(
            this.config.minPitch,
            Math.min(this.config.maxPitch, this.verticalAngle)
        )
    }

    /**
     * Wheel - Zoom in/out
     */
    handleWheel(event) {
        event.preventDefault()

        const delta = event.deltaY * this.config.zoomSpeed * 0.01
        this.targetDistance += delta

        // Limitar zoom
        this.targetDistance = Math.max(
            this.config.minDistance,
            Math.min(this.config.maxDistance, this.targetDistance)
        )
    }

    /**
     * Calcular posición ideal de la cámara (sin colisiones)
     */
    calculateIdealPosition() {
        if (!this.target) return this.currentPosition.clone()

        // 1. Crear quaternion de rotación combinada
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.horizontalAngle
        )

        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            this.verticalAngle
        )

        const combinedRotation = new THREE.Quaternion()

        // Combinar con rotación del robot si está habilitado
        if (this.config.inheritRotation) {
            combinedRotation.copy(this.target.quaternion)
        }

        combinedRotation.multiply(yawQuat)
        combinedRotation.multiply(pitchQuat)

        // 2. Aplicar offset con zoom dinámico
        const offset = this.baseOffset.clone()

        // Escalar offset según distancia de zoom
        const zoomFactor = this.currentDistance / this.config.defaultDistance
        offset.multiplyScalar(zoomFactor)

        // Aplicar rotación
        offset.applyQuaternion(combinedRotation)

        // 3. Sumar posición del target
        offset.add(this.target.position)

        return offset
    }

    /**
     * Calcular punto de mira ideal
     */
    calculateIdealLookAt() {
        if (!this.target) return this.currentLookAt.clone()

        const lookAt = this.baseLookAtOffset.clone()
        lookAt.add(this.target.position)

        return lookAt
    }

    /**
     * Detectar colisiones con geometría usando raycasting
     * Ajusta la posición de la cámara si hay obstáculos
     */
    checkCollisions(idealPosition) {
        if (!this.config.enableCollision || !this.target) {
            return idealPosition
        }

        // Dirección desde el target hasta la posición ideal de la cámara
        const direction = new THREE.Vector3()
            .subVectors(idealPosition, this.target.position)

        const distance = direction.length()
        direction.normalize()

        // Configurar raycaster desde el target hacia la cámara
        this.raycaster.set(this.target.position, direction)
        this.raycaster.far = distance

        // Buscar intersecciones con objetos de nivel
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true // recursive
        )

        // Filtrar solo objetos con userData.levelObject
        const validIntersects = intersects.filter(intersect => {
            return intersect.object.userData?.levelObject === true
        })

        if (validIntersects.length > 0) {
            // Hay colisión! Ajustar posición de la cámara
            const firstHit = validIntersects[0]
            const hitDistance = firstHit.distance - this.config.collisionRadius

            if (hitDistance < distance) {
                // Colocar la cámara justo antes del obstáculo
                const adjustedPosition = this.target.position.clone()
                adjustedPosition.addScaledVector(direction, Math.max(hitDistance, 0.5))

                return adjustedPosition
            }
        }

        return idealPosition
    }

    /**
     * Update - Llamado cada frame desde World.js
     */
    update() {
        if (!this.target) return

        // 1. Suavizar zoom
        this.currentDistance += (this.targetDistance - this.currentDistance) * this.config.zoomLerp

        // 2. Calcular posición ideal
        let idealPosition = this.calculateIdealPosition()

        // 3. Verificar colisiones y ajustar si es necesario
        idealPosition = this.checkCollisions(idealPosition)

        // 4. Calcular lookAt ideal
        const idealLookAt = this.calculateIdealLookAt()

        // 5. Suavizar posición (lerp)
        this.currentPosition.lerp(idealPosition, this.config.positionLerp)

        // 6. Suavizar lookAt (lerp)
        this.currentLookAt.lerp(idealLookAt, this.config.lookAtLerp)

        // 7. Aplicar a la cámara
        this.cameraInstance.position.copy(this.currentPosition)
        this.cameraInstance.lookAt(this.currentLookAt)
    }

    /**
     * Resetear rotación y zoom
     */
    reset() {
        this.horizontalAngle = 0
        this.verticalAngle = 0
        this.targetDistance = this.config.defaultDistance
        this.currentDistance = this.config.defaultDistance

        logger.debug('ThirdPersonCamera reseteada')
    }

    /**
     * Limpiar listeners
     */
    destroy() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown)
        this.canvas.removeEventListener('mouseup', this.onMouseUp)
        this.canvas.removeEventListener('mousemove', this.onMouseMove)
        this.canvas.removeEventListener('wheel', this.onWheel)

        logger.debug('ThirdPersonCamera destruida')
    }
}
