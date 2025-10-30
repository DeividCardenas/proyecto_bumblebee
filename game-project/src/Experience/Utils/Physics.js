import * as CANNON from 'cannon-es'
import { GAME_CONFIG } from '../../config/GameConfig.js'
import logger from '../../utils/Logger.js'

export default class Physics {
    constructor() {
        this.world = new CANNON.World()

        // Configuración desde GameConfig
        const physicsConfig = GAME_CONFIG.physics

        this.world.gravity.set(0, physicsConfig.gravity, 0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true

        // Solver: afinar para mayor estabilidad en colisiones contra paredes/trimesh
        this.world.solver.iterations = physicsConfig.solverIterations
        this.world.solver.tolerance = physicsConfig.solverTolerance

        // Materiales
        this.defaultMaterial = new CANNON.Material('default')

        // Contacto por defecto (usando configuración centralizada)
        const defaultContactConfig = physicsConfig.contacts.default
        const defaultContact = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: defaultContactConfig.friction,
                restitution: defaultContactConfig.restitution,
                contactEquationStiffness: defaultContactConfig.contactEquationStiffness,
                contactEquationRelaxation: defaultContactConfig.contactEquationRelaxation,
                frictionEquationStiffness: defaultContactConfig.frictionEquationStiffness,
                frictionEquationRelaxation: defaultContactConfig.frictionEquationRelaxation
            }
        )
        this.world.defaultContactMaterial = defaultContact
        this.world.addContactMaterial(defaultContact)

        // Materiales específicos
        this.robotMaterial = new CANNON.Material('robot')
        this.obstacleMaterial = new CANNON.Material('obstacle')
        this.wallMaterial = new CANNON.Material('wall')
        this.floorMaterial = new CANNON.Material('floor')

        // Robot vs Obstáculos (usando configuración)
        const robotObstacleConfig = physicsConfig.contacts.robotObstacle
        const robotObstacleContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.obstacleMaterial,
            {
                friction: robotObstacleConfig.friction,
                restitution: robotObstacleConfig.restitution,
                contactEquationStiffness: robotObstacleConfig.contactEquationStiffness,
                contactEquationRelaxation: robotObstacleConfig.contactEquationRelaxation,
                frictionEquationStiffness: robotObstacleConfig.frictionEquationStiffness,
                frictionEquationRelaxation: robotObstacleConfig.frictionEquationRelaxation
            }
        )
        this.world.addContactMaterial(robotObstacleContact)

        // Robot vs Piso (mayor fricción para evitar deslizamiento)
        const robotFloorConfig = physicsConfig.contacts.robotFloor
        const robotFloorContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.floorMaterial,
            {
                friction: robotFloorConfig.friction,
                restitution: robotFloorConfig.restitution,
                contactEquationStiffness: robotFloorConfig.contactEquationStiffness,
                contactEquationRelaxation: robotFloorConfig.contactEquationRelaxation,
                frictionEquationStiffness: robotFloorConfig.frictionEquationStiffness,
                frictionEquationRelaxation: robotFloorConfig.frictionEquationRelaxation
            }
        )
        this.world.addContactMaterial(robotFloorContact)

        // Robot vs Paredes (baja fricción para evitar jitter)
        const robotWallConfig = physicsConfig.contacts.robotWall
        const robotWallContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.wallMaterial,
            {
                friction: robotWallConfig.friction,
                restitution: robotWallConfig.restitution,
                contactEquationStiffness: robotWallConfig.contactEquationStiffness,
                contactEquationRelaxation: robotWallConfig.contactEquationRelaxation,
                frictionEquationStiffness: robotWallConfig.frictionEquationStiffness,
                frictionEquationRelaxation: robotWallConfig.frictionEquationRelaxation
            }
        )
        this.world.addContactMaterial(robotWallContact)

        logger.info('⚙️', 'Sistema de física inicializado', {
            gravity: physicsConfig.gravity,
            iterations: physicsConfig.solverIterations
        })
    }

    update(delta) {
        // Limpia cualquier shape corrupto o desconectado
        this.world.bodies = this.world.bodies.filter(body => {
            if (!body || !Array.isArray(body.shapes) || body.shapes.length === 0) return false

            for (const shape of body.shapes) {
                if (!shape || !shape.body || shape.body !== body) return false
            }

            return true
        })

        // Avanza la simulación con delta limitado para evitar saltos grandes de tiempo
        try {
            const cappedDelta = Math.min(delta, 1 / 30) // cap a 33ms (evita explosiones físicas)
            const timeStep = GAME_CONFIG.physics.timeStep
            const maxSubSteps = GAME_CONFIG.physics.maxSubSteps

            this.world.step(timeStep, cappedDelta, maxSubSteps)
        } catch (err) {
            // Silenciar solo el error específico de wakeUpAfterNarrowphase
            if (err?.message?.includes('wakeUpAfterNarrowphase')) {
                logger.warn('Cannon encontró un shape corrupto residual. Ignorado.')
            } else {
                logger.error('Cannon step error:', err)
            }
        }
    }
}
