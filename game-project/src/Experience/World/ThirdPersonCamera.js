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

        // --- Control táctil (touch) ---
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
        this.touches = new Map() // Almacenar múltiples toques
        this.lastTouchDistance = 0 // Para pinch-to-zoom

        // --- Raycaster para colisiones ---
        this.raycaster = new THREE.Raycaster()
        this.raycaster.far = this.config.maxDistance

        // Inicializar
        this.setMouseListeners()
        this.setTouchListeners() // NUEVO: soporte táctil
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
     * Configurar listeners táctiles para dispositivos móviles/tablets
     * NUEVO: Soporte completo para touch, incluyendo pinch-to-zoom
     */
    setTouchListeners() {
        if (!this.isTouchDevice) return

        // Touch start - Iniciar interacción táctil
        this.onTouchStart = (e) => this.handleTouchStart(e)

        // Touch move - Rotar cámara o hacer zoom
        this.onTouchMove = (e) => this.handleTouchMove(e)

        // Touch end - Finalizar interacción
        this.onTouchEnd = (e) => this.handleTouchEnd(e)

        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false })
        this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false })

        logger.info('📱', 'Controles táctiles de cámara activados para móvil/tablet')
    }

    /**
     * Touch Start - Guardar posiciones iniciales
     */
    handleTouchStart(event) {
        event.preventDefault()

        // Guardar todos los toques activos
        for (let i = 0; i < event.touches.length; i++) {
            const touch = event.touches[i]
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY
            })
        }

        // Si hay 2 toques, calcular distancia inicial para pinch-zoom
        if (event.touches.length === 2) {
            const touch1 = event.touches[0]
            const touch2 = event.touches[1]
            const dx = touch2.clientX - touch1.clientX
            const dy = touch2.clientY - touch1.clientY
            this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy)
        }
    }

    /**
     * Touch Move - Rotar cámara (1 dedo) o Zoom (2 dedos)
     */
    handleTouchMove(event) {
        event.preventDefault()

        if (!this.target) return

        // ==================================================
        // CASO 1: DOS DEDOS - PINCH TO ZOOM
        // ==================================================
        if (event.touches.length === 2) {
            const touch1 = event.touches[0]
            const touch2 = event.touches[1]

            // Calcular distancia actual entre los dos dedos
            const dx = touch2.clientX - touch1.clientX
            const dy = touch2.clientY - touch1.clientY
            const currentDistance = Math.sqrt(dx * dx + dy * dy)

            if (this.lastTouchDistance > 0) {
                // Calcular cambio en distancia
                const distanceDelta = currentDistance - this.lastTouchDistance

                // Aplicar zoom (sensibilidad ajustada para móvil)
                const zoomSensitivity = this.config.touchZoomSpeed || 0.05
                this.targetDistance -= distanceDelta * zoomSensitivity

                // Limitar zoom
                this.targetDistance = Math.max(
                    this.config.minDistance,
                    Math.min(this.config.maxDistance, this.targetDistance)
                )
            }

            this.lastTouchDistance = currentDistance
            return
        }

        // ==================================================
        // CASO 2: UN DEDO - ROTAR CÁMARA
        // ==================================================
        if (event.touches.length === 1) {
            const touch = event.touches[0]
            const storedTouch = this.touches.get(touch.identifier)

            if (storedTouch) {
                // Calcular movimiento desde la última posición
                const deltaX = touch.clientX - storedTouch.x
                const deltaY = touch.clientY - storedTouch.y

                // Aplicar rotación (sensibilidad ajustada para móvil)
                const touchRotationSpeed = this.config.touchRotationSpeed || this.config.rotationSpeed * 1.5
                const touchVerticalSpeed = this.config.touchVerticalRotationSpeed || this.config.verticalRotationSpeed * 1.5

                this.horizontalAngle -= deltaX * touchRotationSpeed
                this.verticalAngle -= deltaY * touchVerticalSpeed

                // Limitar pitch
                this.verticalAngle = Math.max(
                    this.config.minPitch,
                    Math.min(this.config.maxPitch, this.verticalAngle)
                )

                // Actualizar posición guardada
                storedTouch.x = touch.clientX
                storedTouch.y = touch.clientY
            }
        }
    }

    /**
     * Touch End - Limpiar toques finalizados
     */
    handleTouchEnd(event) {
        event.preventDefault()

        // Remover toques que ya no están activos
        const activeTouchIds = new Set()
        for (let i = 0; i < event.touches.length; i++) {
            activeTouchIds.add(event.touches[i].identifier)
        }

        // Limpiar toques que terminaron
        for (const [id] of this.touches) {
            if (!activeTouchIds.has(id)) {
                this.touches.delete(id)
            }
        }

        // Reset pinch distance si no hay 2 dedos
        if (event.touches.length < 2) {
            this.lastTouchDistance = 0
        }
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
     * MEJORADO: Detecta correctamente paredes, pisos y estructuras
     */
    checkCollisions(idealPosition) {
        if (!this.config.enableCollision || !this.target) {
            return idealPosition
        }

        // Dirección desde el target hasta la posición ideal de la cámara
        const direction = new THREE.Vector3()
            .subVectors(idealPosition, this.target.position)

        const distance = direction.length()

        if (distance < 0.1) {
            // Si la distancia es muy pequeña, no hay colisión posible
            return idealPosition
        }

        direction.normalize()

        // Configurar raycaster desde el target hacia la cámara
        // IMPORTANTE: Usamos la posición del target (robot) como origen
        this.raycaster.set(this.target.position, direction)
        this.raycaster.far = distance

        // Buscar intersecciones con objetos de nivel
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true // recursive - busca en todos los hijos
        )

        // Filtrar colisiones válidas:
        // 1. Debe tener userData.levelObject
        // 2. Debe ser un Mesh (geometría sólida)
        // 3. No debe ser el robot mismo ni sus hijos
        // 4. No debe estar marcado con ignoreCamera (ej: portal)
        const validIntersects = intersects.filter(intersect => {
            // Verificar que sea un mesh
            if (!intersect.object.isMesh) {
                return false
            }

            // IMPORTANTE: Ignorar objetos marcados explícitamente (ej: portal)
            if (intersect.object.userData?.ignoreCamera === true) {
                return false
            }

            // Verificar userData.levelObject o que tenga physicsBody
            const hasLevelObject = intersect.object.userData?.levelObject === true
            const hasPhysicsBody = intersect.object.userData?.physicsBody !== undefined

            // Verificar que no sea parte del robot (target)
            let parent = intersect.object.parent
            while (parent) {
                if (parent === this.target) {
                    return false // Es parte del robot, ignorar
                }
                // También verificar ignoreCamera en padres
                if (parent.userData?.ignoreCamera === true) {
                    return false
                }
                parent = parent.parent
            }

            return hasLevelObject || hasPhysicsBody
        })

        if (validIntersects.length > 0) {
            // Hay colisión! Ajustar posición de la cámara
            const firstHit = validIntersects[0]
            const hitDistance = firstHit.distance - this.config.collisionRadius

            if (hitDistance < distance && hitDistance > 0.1) {
                // Colocar la cámara justo antes del obstáculo
                const adjustedPosition = this.target.position.clone()
                adjustedPosition.addScaledVector(direction, Math.max(hitDistance, 0.5))

                // Debug log (opcional)
                if (GAME_CONFIG.debug.enableVerboseLogs) {
                    logger.debug('📷 Colisión de cámara detectada', {
                        objeto: firstHit.object.name || 'sin nombre',
                        distanciaOriginal: distance.toFixed(2),
                        distanciaAjustada: hitDistance.toFixed(2)
                    })
                }

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
        // Remover listeners de mouse
        this.canvas.removeEventListener('mousedown', this.onMouseDown)
        this.canvas.removeEventListener('mouseup', this.onMouseUp)
        this.canvas.removeEventListener('mousemove', this.onMouseMove)
        this.canvas.removeEventListener('wheel', this.onWheel)

        // Remover listeners táctiles
        if (this.isTouchDevice) {
            this.canvas.removeEventListener('touchstart', this.onTouchStart)
            this.canvas.removeEventListener('touchmove', this.onTouchMove)
            this.canvas.removeEventListener('touchend', this.onTouchEnd)
            this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
        }

        logger.debug('ThirdPersonCamera destruida')
    }
}
