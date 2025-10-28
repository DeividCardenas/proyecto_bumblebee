import * as CANNON from 'cannon-es'

export default class Physics {
    constructor() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true
        // Afinar el solver para mayor estabilidad en colisiones contra paredes/trimesh
        this.world.solver.iterations = 15
        this.world.solver.tolerance = 1e-3

        this.defaultMaterial = new CANNON.Material('default')
        const defaultContact = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                // Fricción moderada y contactos menos rígidos para evitar rebotes "elásticos"
                friction: 0.3,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 3,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 3
            }
        )
        this.world.defaultContactMaterial = defaultContact
        this.world.addContactMaterial(defaultContact)

    this.robotMaterial = new CANNON.Material('robot')
    this.obstacleMaterial = new CANNON.Material('obstacle')
    this.wallMaterial = new CANNON.Material('wall')
    this.floorMaterial = new CANNON.Material('floor')

        const robotObstacleContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.obstacleMaterial,
            {
                // Obstáculos (cajas, rampas, etc.)
                // Menos fricción y menos rigidez para reducir vibraciones en aristas
                friction: 0.3,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 5,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 5
            }
        )
        this.world.addContactMaterial(robotObstacleContact)

        // Contacto específico para PISO: mayor fricción y parámetros suaves
        const robotFloorContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.floorMaterial,
            {
                friction: 0.9,            // agarre alto para evitar deslizamiento
                restitution: 0.0,          // sin rebote
                contactEquationStiffness: 5e6,
                contactEquationRelaxation: 6,
                frictionEquationStiffness: 5e4,
                frictionEquationRelaxation: 6
            }
        )
        this.world.addContactMaterial(robotFloorContact)

        const robotWallContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.wallMaterial,
            {
                // Paredes/Trimesh: muy propensos a jitter si la fricción es alta
                friction: 0.15,
                restitution: 0.0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 4,
                frictionEquationStiffness: 1e5,
                frictionEquationRelaxation: 4
            }
        )
        this.world.addContactMaterial(robotWallContact)
    }

    update(delta) {
        // 💣 Limpia cualquier shape corrupto o desconectado
        this.world.bodies = this.world.bodies.filter(body => {
            if (!body || !Array.isArray(body.shapes) || body.shapes.length === 0) return false

            for (const shape of body.shapes) {
                if (!shape || !shape.body || shape.body !== body) return false
            }

            return true
        })

        // ✅ Avanza la simulación con delta limitado para evitar saltos grandes de tiempo
        try {
            const cappedDelta = Math.min(delta, 1 / 30) // cap a 33ms
            this.world.step(1 / 60, cappedDelta, 5)
        } catch (err) {
            // Silenciar solo el error exacto de wakeUpAfterNarrowphase
            if (err?.message?.includes('wakeUpAfterNarrowphase')) {
                console.warn('⚠️ Cannon encontró un shape corrupto residual. Ignorado.')
            } else {
                console.error('🚫 Cannon step error:', err)
            }
        }
    }
}
