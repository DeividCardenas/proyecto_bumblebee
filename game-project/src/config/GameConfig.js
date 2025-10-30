/**
 * Configuración centralizada del juego
 *
 * Este archivo contiene TODOS los parámetros configurables del juego.
 * Modifica estos valores para ajustar el comportamiento, balance y física.
 *
 * @author Optimizado por Claude Code
 * @version 2.0
 */

export const GAME_CONFIG = {
    // ========================================
    // FÍSICA
    // ========================================
    physics: {
        // Gravedad del mundo (negativo = hacia abajo)
        gravity: -9.82,

        // Solver: más iteraciones = más precisión pero menos FPS
        solverIterations: 15,
        solverTolerance: 0.001,

        // Time step para simulación
        timeStep: 1 / 60,
        maxSubSteps: 5,

        // Configuración de materiales y contactos
        contacts: {
            // Contacto por defecto
            default: {
                friction: 0.3,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 3,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 3
            },

            // Robot vs Obstáculos (cajas, rampas)
            robotObstacle: {
                friction: 0.3,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 5,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 5
            },

            // Robot vs Piso (mayor fricción para evitar deslizamiento)
            robotFloor: {
                friction: 0.9,
                restitution: 0.0,
                contactEquationStiffness: 5e6,
                contactEquationRelaxation: 6,
                frictionEquationStiffness: 5e4,
                frictionEquationRelaxation: 6
            },

            // Robot vs Paredes (baja fricción para evitar jitter)
            robotWall: {
                friction: 0.15,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 4,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 4
            }
        }
    },

    // ========================================
    // JUGADOR (ROBOT)
    // ========================================
    player: {
        // Escala del modelo 3D
        modelScale: 0.7,

        // Física
        mass: 2,
        sphereRadius: 0.4,
        linearDamping: 0.05,
        angularDamping: 0.9,

        // Movimiento
        moveForce: 260,
        turnSpeed: 3.1,
        maxSpeed: 18,

        // Salto
        jumpForce: 3,
        jumpForwardImpulse: 0.5,

        // Animaciones
        animationFadeDuration: 0.2,
        requiredAnimations: {
            idle: 'idle01',
            walking: 'dash',
            death: 'emo_sad'
        },

        // Sonidos
        sounds: {
            walkVolume: 0.5,
            jumpVolume: 0.8
        },

        // Tiempo de estabilización inicial (ms)
        stabilizationDelay: 50
    },

    // ========================================
    // ENEMIGOS
    // ========================================
    enemy: {
        // Escala del modelo 3D (aumentada para mejor visibilidad)
        modelScale: 0.8,

        // Física
        mass: 5,
        sphereRadius: 0.5,
        linearDamping: 0.01,

        // Velocidades
        baseSpeed: 1.5,           // Velocidad base (patrullaje)
        chaseSpeed: 4.0,          // Velocidad al perseguir

        // Distancias de comportamiento
        chaseDistance: 20.0,      // A qué distancia empieza a perseguir (aumentado)
        stopDistance: 2.0,        // A qué distancia se detiene (más tolerante)
        maxChaseDistance: 35.0,   // Distancia máxima de persecución (zona limitada)
        returnToSpawnDistance: 40.0, // A qué distancia vuelve al spawn
        soundMaxDistance: 15.0,   // Distancia máxima para escuchar sonido

        // Animaciones
        animationFadeDuration: 0.2,
        requiredAnimations: {
            idle: 'idle01',
            walking: 'dash'
        },

        // Spawn de enemigos
        spawn: {
            minRadius: 25,        // Distancia mínima de spawn desde el jugador
            maxRadius: 40,        // Distancia máxima de spawn
            delayBetween: 0.5     // Segundos entre cada spawn
        }
    },

    // ========================================
    // GAMEPLAY
    // ========================================
    gameplay: {
        // Tiempos (en milisegundos)
        prizePickupDelay: 2000,           // Delay antes de poder recoger premios (evita recolección al spawn)
        portalParticlesDuration: 8000,    // Duración de partículas del portal
        levelTransitionDelay: 1000,       // Delay al cambiar de nivel

        // Distancias (en unidades 3D)
        prizeCollectionDistance: 1.2,     // Distancia mínima para recoger premios (monedas)
        portalCollectionDistance: 3.0,    // Distancia para entrar al portal (más tolerante)
        enemyDefeatDistance: 1.0,         // Distancia para que enemigo atrape al jugador
        physicsOptimizationRadius: 40,    // Radio para activar/desactivar física por distancia

        // Velocidad mínima para detectar movimiento
        minMovementSpeed: 0.5,

        // Optimización de colisiones (revisar cada N frames)
        collisionCheckInterval: 2,

        // Niveles
        totalLevels: 3,
        defaultSpawnPoint: { x: 0, y: 0, z: 0 }
    },

    // ========================================
    // CÁMARA
    // ========================================
    camera: {
        // Configuración global de cámara
        global: {
            fov: 35,                            // Field of view
            near: 0.1,                          // Near clipping plane
            far: 100,                           // Far clipping plane
            defaultPosition: { x: 12, y: 5, z: 10 },
            target: { x: 0, y: 0, z: 0 }
        },

        // OrbitControls (modo libre/debug)
        orbit: {
            enableDamping: true,
            dampingFactor: 0.05,
            enableZoom: true,
            enablePan: true,
            enableRotate: true,

            // Límites de zoom
            minDistance: 3,
            maxDistance: 50,

            // Límites de rotación vertical
            minPolarAngle: Math.PI * 0.1,      // No puede mirar completamente hacia arriba
            maxPolarAngle: Math.PI * 0.85,     // No puede mirar completamente hacia abajo

            // Velocidades
            rotateSpeed: 1.0,
            zoomSpeed: 1.0,
            panSpeed: 1.0
        },

        // Tercera Persona (seguimiento del robot)
        thirdPerson: {
            // Offset de la cámara respecto al robot
            offset: { x: 0, y: 4, z: -8 },     // Detrás (z negativo) y arriba (y positivo)
            lookAtOffset: { x: 0, y: 1, z: 0 }, // Punto de enfoque (ligeramente arriba del robot)

            // Zoom dinámico
            minDistance: 3,                     // Distancia mínima (scroll acercar)
            maxDistance: 15,                    // Distancia máxima (scroll alejar)
            zoomSpeed: 0.5,                     // Velocidad de zoom con scroll
            defaultDistance: 8,                 // Distancia inicial

            // Rotación
            rotationSpeed: 0.003,               // Sensibilidad de rotación horizontal (yaw)
            verticalRotationSpeed: 0.002,       // Sensibilidad de rotación vertical (pitch)
            minPitch: -Math.PI / 6,             // Límite hacia abajo (-30°)
            maxPitch: Math.PI / 3,              // Límite hacia arriba (60°)

            // Suavizado (lerp factors)
            positionLerp: 0.1,                  // Suavizado de posición (más alto = más rápido)
            lookAtLerp: 0.15,                   // Suavizado de punto de mira
            zoomLerp: 0.1,                      // Suavizado de zoom

            // Colisión con geometría
            enableCollision: true,              // Activar detección de colisiones
            collisionRadius: 0.5,               // Radio de la "esfera" de la cámara
            collisionLayers: ['levelObject'],   // Capas con las que colisionar (userData)

            // Comportamiento
            inheritRotation: true,              // Heredar rotación del robot
            autoRotate: false,                  // Auto-rotar detrás del robot
            autoRotateSpeed: 2.0                // Velocidad de auto-rotación
        },

        // Primera Persona
        firstPerson: {
            // Offset respecto al robot (altura de ojos)
            eyeHeight: 1.5,                     // Altura de los ojos sobre el robot
            lookAheadDistance: 0.2,             // Qué tan adelante mirar

            // Control de mouse
            mouseSensitivity: 0.002,            // Sensibilidad general del mouse
            horizontalSensitivity: 1.0,         // Multiplicador horizontal
            verticalSensitivity: 0.8,           // Multiplicador vertical

            // Límites de rotación
            minPitch: -Math.PI / 2.5,           // Límite hacia abajo (-72°)
            maxPitch: Math.PI / 2.5,            // Límite hacia arriba (72°)

            // Suavizado
            positionLerp: 0.3,                  // Suavizado de posición
            rotationLerp: 0.2,                  // Suavizado de rotación

            // Opciones
            invertY: false,                     // Invertir eje Y (mouse)
            lockPointer: false                  // Bloquear puntero (Pointer Lock API)
        },

        // Transiciones entre modos
        transition: {
            enabled: true,                      // Activar transiciones suaves
            duration: 0.5,                      // Duración en segundos
            easing: 'easeInOutCubic'            // Función de easing
        }
    },

    // ========================================
    // VR (WebXR)
    // ========================================
    vr: {
        // Altura de la cámara sobre el jugador en VR
        cameraHeightOffset: 1.6,
        lookAheadDistance: 1.0
    },

    // ========================================
    // UI / HUD
    // ========================================
    ui: {
        // Tiempos de animaciones (ms)
        fadeOutDuration: 1000,
        warningDuration: 5000,
        modalTransitionDelay: 3000
    },

    // ========================================
    // DEBUG / DESARROLLO
    // ========================================
    debug: {
        // Activar debugger de física (líneas verdes)
        showPhysicsDebugger: false,

        // Logs verbosos en consola
        enableVerboseLogs: false,

        // Mostrar ejes de coordenadas en premios
        showPrizeAxesHelper: true,

        // Panel de debug (lil-gui)
        showDebugPanel: false
    }
};

/**
 * Helper para obtener valores anidados de forma segura
 * @param {string} path - Ruta del valor (ej: 'physics.gravity')
 * @returns {*} El valor en la ruta o undefined
 *
 * @example
 * getConfig('player.moveForce') // 260
 * getConfig('physics.contacts.robotFloor.friction') // 0.9
 */
export function getConfig(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], GAME_CONFIG);
}

/**
 * Helper para verificar si un valor está definido en la configuración
 * @param {string} path - Ruta del valor
 * @returns {boolean}
 */
export function hasConfig(path) {
    return getConfig(path) !== undefined;
}

export default GAME_CONFIG;
