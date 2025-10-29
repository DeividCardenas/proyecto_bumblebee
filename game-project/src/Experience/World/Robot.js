import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

// --- CONFIGURACIÓN CENTRALIZADA ---
const CONFIG = {
    modelScale: 0.7,
    mass: 2,
    sphereRadius: 0.4,
    linearDamping: 0.05,
    angularDamping: 0.9,
    moveForce: 260,
    turnSpeed: 3.1,
    maxSpeed: 18,
    jumpForce: 3,
    jumpForwardImpulse: 0.5,
    animationFadeDuration: 0.2,
    soundWalkVolume: 0.5,
    soundJumpVolume: 0.8,
    requiredAnimations: {
        idle: 'idle01',
        walking: 'dash',
        death: 'emo_sad'
    }
};

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

        // Vectores reutilizables para optimización
        this.moveDirection = new THREE.Vector3();
        this.cannonMoveForce = new CANNON.Vec3();
        this.cannonJumpImpulse = new CANNON.Vec3();

        if (this.resources.items.robotModel) {
            try {
                this.setModel()
                this.setSounds()
                this.setPhysics()
                this.setAnimation()
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
        this.model.scale.set(CONFIG.modelScale, CONFIG.modelScale, CONFIG.modelScale)
        this.model.position.set(0, 0, 0)

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
        const shape = new CANNON.Sphere(CONFIG.sphereRadius)
        this.body = new CANNON.Body({
            mass: CONFIG.mass,
            shape: shape,
            position: new CANNON.Vec3(0, 0, 0),
            linearDamping: CONFIG.linearDamping,
            angularDamping: CONFIG.angularDamping,
            material: this.physics.robotMaterial
        })

        this.body.angularFactor.set(0, 0, 0) // No rotar por física, solo por control
        this.physics.world.addBody(this.body)

        // Estabilización inicial
        setTimeout(() => this.body.wakeUp(), 50)
    }

    setSounds() {
        this.walkSound = new Sound('/sounds/robot/walking.mp3', { loop: true, volume: CONFIG.soundWalkVolume })
        this.jumpSound = new Sound('/sounds/robot/jump.mp3', { volume: CONFIG.soundJumpVolume })
    }

    setAnimation() {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        this.animation.actions = {}

        const animations = this.resources.items.robotModel.animations;
        if (!animations || animations.length === 0) {
            console.error('❌ El modelo del robot no tiene animaciones')
            return
        }

        for (const [actionKey, animName] of Object.entries(CONFIG.requiredAnimations)) {
            const clip = animations.find(anim => anim.name === animName);
            if (clip) {
                this.animation.actions[actionKey] = this.animation.mixer.clipAction(clip);
            } else {
                console.warn(`⚠️ Animación "${animName}" no encontrada para la acción "${actionKey}"`);
            }
        }

        if (!this.animation.actions.idle) {
            console.error('❌ No se encontró la animación idle necesaria')
            return;
        }

        this.animation.actions.current = this.animation.actions.idle;
        this.animation.actions.current.play();

        this.animation.play = (name) => {
            const newAction = this.animation.actions[name];
            const oldAction = this.animation.actions.current;

            if (!newAction || newAction === oldAction) return;

            newAction.reset();
            if (name === 'jump' || name === 'death') {
                newAction.setLoop(THREE.LoopOnce, 1);
                newAction.clampWhenFinished = true;
            } else {
                newAction.setLoop(THREE.LoopRepeat);
                newAction.clampWhenFinished = false;
            }

            oldAction.fadeOut(CONFIG.animationFadeDuration);
            newAction.fadeIn(CONFIG.animationFadeDuration).play();
            this.animation.actions.current = newAction;

            // Sonidos
            name === 'walking' ? this.walkSound?.play() : this.walkSound?.stop();
            if (name === 'jump') this.jumpSound?.play();
        }
    }

    _handleKeyboardInput(deltaTime) {
        const keys = this.keyboard.getState();
        let isMoving = false;

        // Obtener la dirección "hacia adelante" del robot
        this.moveDirection.set(0, 0, 1).applyQuaternion(this.group.quaternion);

        // Salto
        if (keys.space && this.body.position.y <= CONFIG.sphereRadius * 1.1) {
            this.cannonJumpImpulse.set(
                this.moveDirection.x * CONFIG.jumpForwardImpulse,
                CONFIG.jumpForce,
                this.moveDirection.z * CONFIG.jumpForwardImpulse
            );
            this.body.applyImpulse(this.cannonJumpImpulse);
            this.animation.play('jump');
            return; // Evita otros movimientos durante el frame del salto
        }

        // Movimiento adelante/atrás
        if (keys.up) {
            this.cannonMoveForce.set(
                this.moveDirection.x * CONFIG.moveForce,
                0,
                this.moveDirection.z * CONFIG.moveForce
            );
            this.body.applyForce(this.cannonMoveForce);
            isMoving = true;
        } else if (keys.down) {
            this.cannonMoveForce.set(
                -this.moveDirection.x * CONFIG.moveForce,
                0,
                -this.moveDirection.z * CONFIG.moveForce
            );
            this.body.applyForce(this.cannonMoveForce);
            isMoving = true;
        }

        // Rotación
        if (keys.left) {
            this.group.rotation.y += CONFIG.turnSpeed * deltaTime;
        } else if (keys.right) {
            this.group.rotation.y -= CONFIG.turnSpeed * deltaTime;
        }
        this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0);

        this._updateAnimation(isMoving);
    }

    _updateAnimation(isMoving) {
        if (isMoving) {
            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking');
            }
        } else {
            if (this.animation.actions.current !== this.animation.actions.idle) {
                this.animation.play('idle');
            }
        }
    }

    _clampVelocity() {
        const { x, z } = this.body.velocity;
        if (Math.abs(x) > CONFIG.maxSpeed) {
            this.body.velocity.x = Math.sign(x) * CONFIG.maxSpeed;
        }
        if (Math.abs(z) > CONFIG.maxSpeed) {
            this.body.velocity.z = Math.sign(z) * CONFIG.maxSpeed;
        }
    }

    _checkBoundaries() {
        if (this.body.position.y > 10) {
            console.warn('Robot fuera del escenario. Reubicando...');
            this.body.position.set(0, 1.2, 0);
            this.body.velocity.set(0, 0, 0);
        }
    }

    update() {
        if (!this.isInitialized || this.isDead) return;
        if (this.animation.actions.current === this.animation.actions.death) return;

        const deltaTime = this.time.delta * 0.001;

        this.animation.mixer.update(deltaTime);
        this._handleKeyboardInput(deltaTime);
        this._clampVelocity();
        this._checkBoundaries();

        // Sincronización física → visual
        this.group.position.copy(this.body.position);
    }

    moveInDirection() {
        if (!this.isInitialized || !window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) {
            return;
        }

        const mobile = window.experience?.mobileControls;
        if (mobile?.intensity > 0) {
            const { x, y: z } = mobile.directionVector; // y de 2D es z en 3D
            this.moveDirection.set(x, 0, z).normalize();

            const adjustedSpeed = 250 * mobile.intensity;
            this.cannonMoveForce.set(
                this.moveDirection.x * adjustedSpeed,
                0,
                this.moveDirection.z * adjustedSpeed
            );
            this.body.applyForce(this.cannonMoveForce);

            this._updateAnimation(true);

            // Rotar suavemente
            const angle = Math.atan2(x, z);
            this.group.rotation.y = angle;
            this.body.quaternion.setFromEuler(0, angle, 0);
        }
    }

    die() {
        if (!this.isInitialized || this.isDead) return;
        this.isDead = true;

        this.body?.velocity.set(0, 0, 0);
        this.body?.angularVelocity.set(0, 0, 0);

        const cleanup = () => {
            this.walkSound?.stop();
            this.jumpSound?.stop();

            if (this.body && this.physics.world.bodies.includes(this.body)) {
                this.physics.world.removeBody(this.body);
                this.body = null;
            }

            if (this.group) {
                this.group.position.y -= 0.5;
                this.group.rotation.x = -Math.PI / 2;
            }
            console.log('Robot ha muerto');
        };

        if (this.animation.actions.death) {
            this.animation.play('death');
            const onFinished = (event) => {
                if (event.action === this.animation.actions.death) {
                    this.animation.mixer.removeEventListener('finished', onFinished);
                    cleanup();
                }
            };
            this.animation.mixer.addEventListener('finished', onFinished);
        } else {
            cleanup();
        }
    }
}