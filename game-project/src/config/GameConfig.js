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
        // Escala del modelo 3D
        modelScale: 0.6,

        // Física
        mass: 5,
        sphereRadius: 0.5,
        linearDamping: 0.01,

        // Velocidades
        baseSpeed: 1.0,
        chaseSpeed: 3.5,

        // Distancias de comportamiento
        chaseDistance: 15.0,      // A qué distancia empieza a perseguir
        stopDistance: 1.5,        // A qué distancia se detiene
        soundMaxDistance: 12.0,   // Distancia máxima para escuchar sonido

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
        prizeCollectionDistance: 1.2,     // Distancia mínima para recoger premios
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
        // Tercera persona
        thirdPerson: {
            distance: 5,
            height: 2,
            smoothing: 0.1
        },

        // Primera persona / Global
        global: {
            defaultPosition: { x: 12, y: 5, z: 10 },
            target: { x: 0, y: 0, z: 0 },
            maxPolarAngle: Math.PI * 0.9
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
