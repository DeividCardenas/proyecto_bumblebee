import * as THREE from 'three';

// Constantes para configuración y legibilidad
const MODEL_SCALE = 0.02;
const INITIAL_POSITION = new THREE.Vector3(3, 0, 3);
const ANIMATION_FADE_DURATION = 0.5;

export default class Fox {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.time = this.experience.time;
        this.debug = this.experience.debug;

        // Propiedades de IA
        this.target = null;
        this.walkSpeed = 4.0;        
        this.runSpeed = 8.0;       
        this.stopDistance = 2.5;         
        this.startMoveDistance = 4.0;    
        this.runDistance = 8.0;        

        // Propiedades de Teletransporte
        this.teleportDistance = 40.0;
        this.stuckTimer = 0.0;
        this.stuckCheckTime = 3.0;
        this.stuckMoveThreshold = 0.5;

        // Vectores reutilizables para optimización
        this.lastCheckPosition = new THREE.Vector3();
        this.directionVector = new THREE.Vector3();
        this.teleportVector = new THREE.Vector3();
        this.modelForward = new THREE.Vector3();

        // Rotación suave
        this.currentLookAt = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.rotationSpeed = 8.0;
        this.rotationThreshold = 0.5;
        this.isMoving = false;

        // Debug
        if (this.debug.active) {
            this.setupDebug();
        }

        // Resource
        this.resource = this.resources.items.foxModel;

        this.setModel();
        this.setAnimation();

        if (this.experience.world && this.experience.world.robot) {
            this.setTarget(this.experience.world.robot);
        }
    }

    setupDebug() {
        this.debugFolder = this.debug.ui.addFolder('fox');

        this.debugFolder.add(this, 'walkSpeed', 0, 10, 0.1).name('Walk Speed');
        this.debugFolder.add(this, 'runSpeed', 0, 15, 0.1).name('Run Speed');
        this.debugFolder.add(this, 'stopDistance', 0, 10, 0.1).name('Stop Distance');
        this.debugFolder.add(this, 'startMoveDistance', 0, 10, 0.1).name('StartMove Distance');
        this.debugFolder.add(this, 'runDistance', 0, 10, 0.1).name('Run Distance');
        this.debugFolder.add(this, 'teleportDistance', 10, 50, 1).name('Teleport Distance');
        this.debugFolder.add(this, 'stuckCheckTime', 1, 10, 0.5).name('Stuck Time (s)');
        this.debugFolder.add(this, 'rotationSpeed', 1, 15, 0.5).name('Rotate Speed');
        this.debugFolder.add(this, 'rotationThreshold', 0, Math.PI, 0.1).name('Rotate Threshold');
    }

    setTarget(robotInstance) {
        if (robotInstance && robotInstance.group) {
            this.target = robotInstance.group;
            console.log('Fox: Objetivo establecido -> Robot');
            this.lastCheckPosition.copy(this.model.position);
            this.targetLookAt.set(
                this.target.position.x,
                this.model.position.y,
                this.target.position.z
            );
            this.currentLookAt.copy(this.targetLookAt);
        } else {
            console.warn('Fox: No se pudo establecer el objetivo. Instancia de robot inválida.');
        }
    }

    setModel() {
        this.model = this.resource.scene;
        this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        this.model.position.copy(INITIAL_POSITION);
        this.scene.add(this.model);

        this.currentLookAt.set(this.model.position.x, this.model.position.y, this.model.position.z + 1);
        this.targetLookAt.copy(this.currentLookAt);

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
            }
        });
    }

    setAnimation() {
        this.animation = {};
        this.animation.mixer = new THREE.AnimationMixer(this.model);
        this.animation.actions = {};

        // Asignar animaciones por nombre para mayor robustez
        for (const clip of this.resource.animations) {
            const action = this.animation.mixer.clipAction(clip);
            this.animation.actions[clip.name.toLowerCase()] = action;
        }

        // Asignar acciones comunes si existen
        this.animation.actions.idle = this.animation.actions.idle || this.animation.actions.survey; // Fallback para nombres comunes
        this.animation.actions.walking = this.animation.actions.walking || this.animation.actions.walk;
        this.animation.actions.running = this.animation.actions.running || this.animation.actions.run;

        if (!this.animation.actions.idle || !this.animation.actions.walking || !this.animation.actions.running) {
            console.error("Fox: No se encontraron todas las animaciones necesarias (idle, walking, running).");
            // Asigna la primera animación como idle por defecto si no se encuentra ninguna
            this.animation.actions.idle = this.animation.actions.idle || this.animation.mixer.clipAction(this.resource.animations[0]);
        }

        this.animation.actions.current = this.animation.actions.idle;
        this.animation.actions.current.play();

        this.animation.play = (name) => {
            const newAction = this.animation.actions[name];
            const oldAction = this.animation.actions.current;

            if (!newAction || newAction === oldAction) {
                return;
            }

            newAction.reset();
            newAction.play();
            newAction.crossFadeFrom(oldAction, ANIMATION_FADE_DURATION);

            this.animation.actions.current = newAction;
        };

        // Debug
        if (this.debug.active) {
            const debugObject = {
                playIdle: () => { this.animation.play('idle') },
                playWalking: () => { this.animation.play('walking') },
                playRunning: () => { this.animation.play('running') }
            };
            this.debugFolder.add(debugObject, 'playIdle');
            this.debugFolder.add(debugObject, 'playWalking');
            this.debugFolder.add(debugObject, 'playRunning');
        }
    }

    teleportToTarget() {
        if (!this.target) return;

        const spawnRadius = this.stopDistance + 1.0;
        // Reutiliza el vector para el cálculo
        this.teleportVector.set(0, 0, -1); // Vector "hacia atrás" local

        this.teleportVector.applyQuaternion(this.target.quaternion);
        this.teleportVector.multiplyScalar(spawnRadius);

        const targetPos = this.target.position;
        const newPos = this.teleportVector.add(targetPos);

        // Mantenemos la 'y' actual del zorro
        const newPosY = this.model.position.y;
        this.model.position.set(newPos.x, newPosY, newPos.z);

        console.log(`Fox: Teletransportado a ${newPos.x.toFixed(2)}, ${newPosY}, ${newPos.z.toFixed(2)}`);

        this.targetLookAt.set(targetPos.x, newPosY, targetPos.z);
        this.model.lookAt(this.targetLookAt);
        this.currentLookAt.copy(this.targetLookAt);
        this.animation.play('idle');

        this.stuckTimer = 0;
        this.lastCheckPosition.copy(this.model.position);
    }

    followTarget(deltaTime) {
        if (!this.target) {
            if (this.experience.world && this.experience.world.robot) {
                this.setTarget(this.experience.world.robot);
            }
            if (!this.target) {
                this.animation.play('idle');
                return;
            }
        }

        const targetPosition = this.target.position;
        const foxPosition = this.model.position;

        // Reutiliza el vector de dirección
        this.directionVector.subVectors(targetPosition, foxPosition);
        this.directionVector.y = 0;
        const distance = this.directionVector.length();

        if (distance > this.teleportDistance) {
            console.log('Fox: Demasiado lejos. Preparando teletransporte...');
            this.teleportToTarget();
            return;
        }

        this.targetLookAt.set(targetPosition.x, foxPosition.y, targetPosition.z);

        if (this.isMoving) {
            if (distance <= this.stopDistance) {
                this.isMoving = false;
            }
        } else if (distance > this.startMoveDistance) {
            this.isMoving = true;
        }

        if (this.isMoving) {
            let currentSpeed;
            if (distance > this.runDistance) {
                currentSpeed = this.runSpeed;
                this.animation.play('running');
            } else {
                currentSpeed = this.walkSpeed;
                this.animation.play('walking');
            }

            this.directionVector.normalize();
            this.model.getWorldDirection(this.modelForward);
            this.modelForward.y = 0;

            const angle = this.modelForward.angleTo(this.directionVector);

            if (angle < this.rotationThreshold) {
                const moveAmount = currentSpeed * deltaTime;
                this.model.position.x += this.modelForward.x * moveAmount;
                this.model.position.z += this.modelForward.z * moveAmount;
            }
        } else {
            this.animation.play('idle');
        }
    }

    checkIfStuck(deltaTime) {
        if (!this.target) return;

        const currentAction = this.animation.actions.current;
        const isTryingToMove = (
            currentAction === this.animation.actions.walking ||
            currentAction === this.animation.actions.running
        );

        if (isTryingToMove) {
            this.stuckTimer += deltaTime;

            if (this.stuckTimer >= this.stuckCheckTime) {
                const distanceMoved = this.model.position.distanceTo(this.lastCheckPosition);

                if (distanceMoved < this.stuckMoveThreshold) {
                    console.log(`Fox: ¡Atascado! (Movido: ${distanceMoved.toFixed(2)}m en ${this.stuckCheckTime}s). Teletransportando...`);
                    this.teleportToTarget();
                }

                this.stuckTimer = 0;
                this.lastCheckPosition.copy(this.model.position);
            }
        } else {
            this.stuckTimer = 0;
            this.lastCheckPosition.copy(this.model.position);
        }
    }

    update() {
        const deltaTime = this.time.delta * 0.001;

        this.animation.mixer.update(deltaTime);

        this.followTarget(deltaTime);
        this.checkIfStuck(deltaTime);

        if (!this.currentLookAt.equals(this.targetLookAt)) {
            this.currentLookAt.lerp(this.targetLookAt, deltaTime * this.rotationSpeed);
            this.model.lookAt(this.currentLookAt.x, this.model.position.y, this.currentLookAt.z);
        } else if (!Number.isNaN(this.targetLookAt.x)) {
            this.model.lookAt(this.targetLookAt.x, this.model.position.y, this.targetLookAt.z);
        }
    }
}