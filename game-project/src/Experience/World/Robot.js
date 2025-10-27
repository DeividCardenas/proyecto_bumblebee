import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

export default class Robot {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.physics = this.experience.physics
        this.keyboard = this.experience.keyboard
        this.debug = this.experience.debug
        this.points = 0
        this.isInitialized = false
    this.isDead = false

        // Verificar si el modelo del robot está cargado
        if (this.resources.items.robotModel) {
            try {
                this.setModel()
                this.setSounds()
                this.setPhysics()
                this.setAnimation()
                // transformation feature removed
                this.isInitialized = true
            } catch (error) {
                console.error('❌ Error al inicializar el robot:', error)
            }
        } else {
            console.error('❌ El modelo del robot no está cargado correctamente')
        }
    }

    setModel() {
        this.model = this.resources.items.robotModel.scene
        this.model.scale.set(0.8, 0.8, 0.8)
        this.model.position.set(0, -0.1, 0) // Centrar respecto al cuerpo físico

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })
    }

    setPhysics() {
        //const shape = new CANNON.Box(new CANNON.Vec3(0.3, 0.5, 0.3))
        const shape = new CANNON.Sphere(0.4)

        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            //position: new CANNON.Vec3(4, 1, 0), // Apenas sobre el piso real (que termina en y=0)
            position: new CANNON.Vec3(0, 1.2, 0),
            linearDamping: 0.05,
            angularDamping: 0.9
        })

        this.body.angularFactor.set(0, 1, 0)

        // Estabilización inicial
        this.body.velocity.setZero()
        this.body.angularVelocity.setZero()
        this.body.sleep()
        this.body.material = this.physics.robotMaterial
        //console.log(' Robot material:', this.body.material.name)


        this.physics.world.addBody(this.body)
        //console.log(' Posición inicial del robot:', this.body.position)
        // Activar cuerpo después de que el mundo haya dado al menos un paso de simulación
        setTimeout(() => {
            this.body.wakeUp()
        }, 40) // 100 ms ≈ 6 pasos de simulación si step = 1/60
    }


    setSounds() {
        this.walkSound = new Sound('/sounds/robot/walking.mp3', { loop: true, volume: 0.5 })
        this.jumpSound = new Sound('/sounds/robot/jump.mp3', { volume: 0.8 })
    }
    // Transformation feature removed. Robot will use idle/dash only.

    setAnimation() {
    this.animation = {}
    this.animation.mixer = new THREE.AnimationMixer(this.model)
    this.animation.actions = {}

        // Verificar que el modelo tenga animaciones
        if (!this.resources.items.robotModel.animations || this.resources.items.robotModel.animations.length === 0) {
            console.error('❌ El modelo del robot no tiene animaciones')
            return
        }

        // Buscar las animaciones por nombre
        const animations = this.resources.items.robotModel.animations;
        const requiredAnimations = {
            idle: 'idle01',
            walking: 'dash',
            death: 'emo_sad'
        }

        // reverseTransform removed

        // Crear acciones buscando las animaciones por nombre
        for (const [actionKey, animationName] of Object.entries(requiredAnimations)) {
            const animation = animations.find(anim => anim.name === animationName);
            if (animation) {
                this.animation.actions[actionKey] = this.animation.mixer.clipAction(animation);
            } else {
                console.warn(`⚠️ Animación "${animationName}" no encontrada`);
            }
        }

        // Verificar que tenemos al menos la animación idle
        if (this.animation.actions.idle) {
            // Configurar la animación idle para que se repita
            this.animation.actions.idle.setLoop(THREE.LoopRepeat)
            this.animation.actions.idle.clampWhenFinished = false
            
            // Iniciar con la animación idle
            this.animation.actions.current = this.animation.actions.idle
            this.animation.actions.current.play()
            
            // Ya no necesitamos la configuración del salto ya que no lo usamos
            /*
            if (this.animation.actions.jump) {
                this.animation.actions.jump.setLoop(THREE.LoopOnce)
                this.animation.actions.jump.clampWhenFinished = true
                this.animation.actions.jump.onFinished = () => {
                    this.animation.play('idle')
                }
            }
            */
        } else {
            console.error('❌ No se encontró la animación idle necesaria')
        }

        // Método para cambiar entre animaciones de forma segura
        this.animation.play = (name) => {
            if (!this.animation.actions[name]) {
                console.warn(`⚠️ Intento de reproducir animación "${name}" que no existe`)
                return
            }

            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            if (oldAction && oldAction !== newAction) {
                newAction.reset()

                // Jump uses a single-run loop, others repeat
                if (name === 'jump' || name === 'death') {
                    newAction.setLoop(THREE.LoopOnce)
                    newAction.clampWhenFinished = true
                } else {
                    newAction.setLoop(THREE.LoopRepeat)
                    newAction.clampWhenFinished = false
                }

                const duration = 0.2
                oldAction.fadeOut(duration)
                newAction.fadeIn(duration)
                newAction.play()
            }

            this.animation.actions.current = newAction

            // Manejo de sonidos
            if (name === 'walking' && this.walkSound) {
                this.walkSound.play()
            } else if (this.walkSound) {
                this.walkSound.stop()
            }

            if (name === 'jump' && this.jumpSound) {
                this.jumpSound.play()
            }
        }
    }

    update() {
        if (!this.isInitialized) return
        if (this.isDead) return
        if (this.animation?.actions?.current === this.animation?.actions?.death) return
        const delta = this.time.delta * 0.001

        // Actualizar el mixer de animaciones si existe
        if (this.animation?.mixer) {
            this.animation.mixer.update(delta)
        }

        const keys = this.keyboard.getState()
    // Velocidades fijas (ajustadas para movimiento más lento)
    const moveForce = 180 // fuerza de movimiento reducida
    const turnSpeed = 1.5 // giro más suave
        let isMoving = false

    // Limitar velocidad si es demasiado alta
    const maxSpeed = 8
        this.body.velocity.x = Math.max(Math.min(this.body.velocity.x, maxSpeed), -maxSpeed)
        this.body.velocity.z = Math.max(Math.min(this.body.velocity.z, maxSpeed), -maxSpeed)


        // Salto
        // Dirección hacia adelante, independientemente del salto o movimiento
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)

        // Salto
        if (keys.space && this.body.position.y <= 0.51) {
            this.body.applyImpulse(new CANNON.Vec3(forward.x * 0.5, 3, forward.z * 0.5))
            this.animation.play('jump')
            return
        }
        //No permitir que el robot salga del escenario
        if (this.body.position.y > 10) {
            console.warn(' Robot fuera del escenario. Reubicando...')
            this.body.position.set(0, 1.2, 0)
            this.body.velocity.set(0, 0, 0)
        }


        // Movimiento hacia adelante
        if (keys.up) {
            const forward = new THREE.Vector3(0, 0, 1)
            forward.applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(forward.x * moveForce, 0, forward.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        // Movimiento hacia atrás
        if (keys.down) {
            const backward = new THREE.Vector3(0, 0, -1)
            backward.applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(backward.x * moveForce, 0, backward.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        // Rotación
        if (keys.left) {
            this.group.rotation.y += turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
        if (keys.right) {
            this.group.rotation.y -= turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }


        // Animaciones según movimiento
        if (isMoving && this.animation?.actions?.walking) {
            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking') // Usará la animación 'dash'
            }
        } else if (this.animation?.actions?.idle) {
            if (this.animation.actions.current !== this.animation.actions.idle) {
                this.animation.play('idle') // Usará la animación 'vehicle_idle01'
            }
        }

        // Sincronización física → visual
        this.group.position.copy(this.body.position)

    }

    // Método para mover el robot desde el exterior VR
    moveInDirection() {
        if (!this.isInitialized || !window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) {
            return
        }

        // Si hay controles móviles activos
        const mobile = window.experience?.mobileControls
        if (mobile?.intensity > 0) {
            const dir2D = mobile.directionVector
            const dir3D = new THREE.Vector3(dir2D.x, 0, dir2D.y).normalize()

            const adjustedSpeed = 250 * mobile.intensity // velocidad más fluida
            const force = new CANNON.Vec3(dir3D.x * adjustedSpeed, 0, dir3D.z * adjustedSpeed)

            if (this.body) {
                this.body.applyForce(force, this.body.position)
            }

            if (this.animation?.actions?.walking && 
                this.animation?.actions?.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }

            // Rotar suavemente en dirección de avance si el grupo existe
            if (this.group && this.body) {
                const angle = Math.atan2(dir3D.x, dir3D.z)
                this.group.rotation.y = angle
                this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
            }
        }
    }
    die() {
        if (!this.isInitialized) return

        // Prevent multiple calls
        if (this.isDead) return
        this.isDead = true

        // Stop movement immediately
        if (this.body) {
            try {
                this.body.velocity.set(0, 0, 0)
                this.body.angularVelocity.set(0, 0, 0)
            } catch {
                /* ignore */
            }
        }

        // Play death animation if available, otherwise cleanup immediately
        const playDeathAndCleanup = () => {
            // Detener sonidos si existen
            if (this.walkSound) this.walkSound.stop()
            if (this.jumpSound) this.jumpSound.stop()

            // 💥 Eliminar cuerpo del mundo de forma segura
            if (this.body && this.physics?.world?.bodies.includes(this.body)) {
                try {
                    this.physics.world.removeBody(this.body)
                } catch {
                    /* ignore removal error */
                }
                this.body = null // prevenir referencias rotas
            }

            // Ajustes visuales si el grupo existe
            if (this.group) {
                this.group.position.y -= 0.5
                this.group.rotation.x = -Math.PI / 2
            }

            console.log(' Robot ha muerto')
        }

        if (this.animation?.actions?.death) {
            // Crossfade to death and when finished do cleanup
            try {
                const old = this.animation.actions.current
                if (old && old !== this.animation.actions.death) old.fadeOut(0.2)
                const deathAction = this.animation.actions.death
                deathAction.reset()
                deathAction.setLoop(THREE.LoopOnce)
                deathAction.clampWhenFinished = true
                deathAction.fadeIn(0.2)
                deathAction.play()
                this.animation.actions.current = deathAction

                const onFinished = () => {
                    // remove listener and cleanup
                    try { this.animation.mixer.removeEventListener('finished', onFinished) } catch { /* ignore */ }
                    playDeathAndCleanup()
                }
                // mixer 'finished' fires with no args when any action finishes; guard by isDead
                this.animation.mixer.addEventListener('finished', onFinished)
            } catch {
                // If animation play fails, cleanup immediately
                playDeathAndCleanup()
            }
        } else {
            playDeathAndCleanup()
        }
        

        return
    }

}


