import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Sound from './Sound.js';
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js';
import { GAME_CONFIG } from '../../config/GameConfig.js';
import logger from '../../utils/Logger.js';

// Usar configuración centralizada
const CONFIG = GAME_CONFIG.enemy;

function toCannonVec3(v) {
  // acepta THREE.Vector3, plain obj, o CANNON.Vec3
  return new CANNON.Vec3(v.x ?? 0, v.y ?? 0, v.z ?? 0);
}

function toThreeVector(v) {
  return new THREE.Vector3(v.x ?? 0, v.y ?? 0, v.z ?? 0);
}

export default class Enemy {
  constructor({ experience, position, playerRef }) {
    this.experience = experience;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.physics = this.experience.physics;
    this.time = this.experience.time;
    this.playerRef = playerRef;

    // Guard: normalizar position a THREE.Vector3 internamente
    if (!position) {
      logger.warn('Enemy created without initial position — using (0,0,0).');
      this.initialPosition = new THREE.Vector3(0, 0, 0);
    } else {
      this.initialPosition = toThreeVector(position);
    }

    this.targetPosition = new CANNON.Vec3();
    this.moveDirection = new CANNON.Vec3();
    this.isDestroyed = false;

    // Guardar posición inicial para límite de persecución
    this.spawnPosition = new CANNON.Vec3(
      this.initialPosition.x,
      this.initialPosition.y,
      this.initialPosition.z
    );

    try {
      this.setSounds();
      this.setModel();
      this.setPhysics();
      this.setAnimation();
      logger.info('👹', 'Enemigo inicializado', { position: this.initialPosition });
    } catch (error) {
      logger.error('Error al inicializar el Enemigo:', error);
      this.destroy();
    }
  }

  setModel() {
    const resource = this.resources?.items?.enemyRedModel;
    if (!resource) {
      throw new Error('El recurso "enemyRedModel" no está cargado en resources.items.');
    }

    // Clonar escena / mesh
    this.model = resource.scene.clone(true);
    this.model.scale.set(CONFIG.modelScale, CONFIG.modelScale, CONFIG.modelScale);

    // Asegurarse de tener una posición THREE.Vector3
    this.model.position.set(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z);

    this.scene.add(this.model);
    this.model.visible = true;

    // CRÍTICO: Forzar visibilidad de TODOS los children del modelo
    // Esto soluciona el problema de que solo aparezcan armas y luces
    this.model.traverse((child) => {
      // Forzar visibilidad (fix para modelos GLTF con meshes invisibles)
      child.visible = true;

      if (child.isMesh || child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Asegurar que el material sea visible también
        if (child.material) {
          child.material.visible = true;
          // Si tiene transparencia desactivada, asegurarse que sea opaco
          if (child.material.transparent === false) {
            child.material.opacity = 1.0;
          }
        }
      }
    });

    logger.info('👹', `Modelo de enemigo cargado con ${this.model.children.length} children`);
  }

  setAnimation() {
    const resource = this.resources?.items?.enemyRedModel;
    if (!resource) {
      logger.warn('No hay resource.animations para Enemy.');
      this.animation = null;
      return;
    }

    this.animation = {
      mixer: new THREE.AnimationMixer(this.model),
      actions: {},
      current: null
    };

    // Debug: listar nombres de animaciones disponibles
    if (Array.isArray(resource.animations)) {
      logger.debug('Enemy: animaciones disponibles ->', resource.animations.map(a => a.name));
    }

    for (const [actionKey, animName] of Object.entries(CONFIG.requiredAnimations)) {
      const clip = resource.animations?.find(anim => anim.name === animName);
      if (clip) {
        this.animation.actions[actionKey] = this.animation.mixer.clipAction(clip);
      } else {
        logger.warn(`Animación de Enemigo "${animName}" no encontrada. actionKey=${actionKey}`);
      }
    }

    // No tirar error — mejor fallback
    if (!this.animation.actions.idle) {
      const anyClip = resource.animations?.[0];
      if (anyClip) {
        logger.warn('Asignando clip por defecto como idle.');
        this.animation.actions.idle = this.animation.mixer.clipAction(anyClip);
      } else {
        logger.warn('No hay clips disponibles para animaciones del enemigo.');
      }
    }
    if (!this.animation.actions.walking) {
      // fallback: reutilizar idle en walking para evitar crash
      this.animation.actions.walking = this.animation.actions.idle;
    }

    if (this.animation.actions.idle) {
      this.animation.actions.current = this.animation.actions.idle;
      this.animation.actions.current.play();
    }

    // Función play segura
    this.animation.play = (name) => {
      if (!this.animation) return;
      const newAction = this.animation.actions[name];
      const oldAction = this.animation.actions.current;
      if (!newAction || newAction === oldAction) return;

      try {
        newAction.reset();
        newAction.setLoop(THREE.LoopRepeat);
        if (oldAction) oldAction.fadeOut(CONFIG.animationFadeDuration);
        newAction.fadeIn(CONFIG.animationFadeDuration).play();
        this.animation.actions.current = newAction;
      } catch (err) {
        logger.warn('Error al cambiar animación de enemigo:', err);
      }
    };
  }

  setSounds() {
    // Iniciamos con volumen 0 para que no moleste si suena antes de proximidad
    this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 });
    try {
      this.proximitySound.play();
    } catch (err) {
      logger.warn('No se pudo reproducir proximidad sound (tal vez audio no desbloqueado):', err);
    }
  }

  setPhysics() {
    if (!this.physics?.world) {
      logger.warn('No hay physics.world — el enemigo no tendrá física.');
      return;
    }

    const shape = new CANNON.Sphere(CONFIG.sphereRadius);
    const enemyMaterial = new CANNON.Material('enemyMaterial');

    // Crear el body con posición explicita desde THREE->CANNON
    this.body = new CANNON.Body({
      mass: CONFIG.mass,
      shape,
      material: enemyMaterial,
      position: toCannonVec3(this.initialPosition),
      linearDamping: CONFIG.linearDamping
    });

    this.physics.world.addBody(this.body);
    this.model.userData.physicsBody = this.body;

    // Manejo de colisiones
    this._onCollide = (event) => {
      try {
        if (event.body === this.playerRef?.body) {
          this.playerRef.die?.();
          new FinalPrizeParticles({
            scene: this.scene,
            targetPosition: this.body.position,
            sourcePosition: this.body.position,
            experience: this.experience
          });
          this.destroy();
        }
      } catch (err) {
        logger.error('Error manejando colisión de enemigo:', err);
      }
    };

    this.body.addEventListener('collide', this._onCollide);
  }

  update(deltaTime) {
    if (this.isDestroyed) return;
    if (!this.body || !this.playerRef?.body) {
      // Si no hay físicas o target, intentar posicionar el mesh en initialPosition
      if (this.model && (!this.body)) {
        // asegurar que se vea en scene
        this.model.position.set(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z);
      }
      return;
    }

    const targetPos = this.targetPosition.copy(this.playerRef.body.position);
    const enemyPos = this.body.position;
    const distance = enemyPos.distanceTo(targetPos);

    // Verificar distancia desde spawn point (zona de persecución limitada)
    const distanceFromSpawn = enemyPos.distanceTo(this.spawnPosition);

    // Si el enemigo se alejó mucho de su spawn, volver al punto inicial
    if (distanceFromSpawn > CONFIG.returnToSpawnDistance) {
      logger.debug('👹', 'Enemigo demasiado lejos del spawn, regresando...');
      this.moveDirection.copy(this.spawnPosition);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();
      this.moveDirection.scale(CONFIG.baseSpeed, this.moveDirection);

      this.body.velocity.x = this.moveDirection.x;
      this.body.velocity.y = this.moveDirection.y;
      this.body.velocity.z = this.moveDirection.z;

      this.animation?.play('walking');

      if (this.model) {
        const lookTarget = new THREE.Vector3(
          this.model.position.x + this.moveDirection.x,
          this.model.position.y,
          this.model.position.z + this.moveDirection.z
        );
        this.model.lookAt(lookTarget);
      }
    }
    // Si el jugador está dentro del rango de persecución
    else if (distance < CONFIG.maxChaseDistance && distance > CONFIG.stopDistance) {
      this.moveDirection.copy(targetPos);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();

      // Velocidad variable: más rápido si está cerca (persecución activa)
      const speed = distance < CONFIG.chaseDistance ? CONFIG.chaseSpeed : CONFIG.baseSpeed;
      // scale en cannon-es: scale(number, target)
      this.moveDirection.scale(speed, this.moveDirection);

      this.body.velocity.x = this.moveDirection.x;
      this.body.velocity.y = this.moveDirection.y;
      this.body.velocity.z = this.moveDirection.z;

      this.animation?.play('walking');

      // rotación visual: preferible sincronizar con quaternion de cuerpo si existe
      if (this.model) {
        // mirar hacia la dirección XZ
        const lookTarget = new THREE.Vector3(
          this.model.position.x + this.moveDirection.x,
          this.model.position.y,
          this.model.position.z + this.moveDirection.z
        );
        this.model.lookAt(lookTarget);
      }
    } else {
      // Detenerse si está muy cerca o el jugador está fuera de rango
      this.body.velocity.set(0, 0, 0);
      this.animation?.play('idle');
    }

    // Sincronizar modelo visual con cuerpo físico (usar set para evitar problemas de tipos)
    if (this.model && this.body) {
      this.model.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
      // si quieres rotación física:
      this.model.quaternion.set(
        this.body.quaternion.x,
        this.body.quaternion.y,
        this.body.quaternion.z,
        this.body.quaternion.w
      );
    }

    // sonido de proximidad
    const proximityVolume = Math.max(0, 1 - (distance / CONFIG.soundMaxDistance));
    this.proximitySound?.setVolume(proximityVolume * 0.8);

    // actualiza animaciones
    this.animation?.mixer?.update(deltaTime);
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    try { this.proximitySound?.stop(); } catch { /* Ignorar errores al detener el sonido de proximidad */ }

    if (this.model?.parent) {
      this.scene.remove(this.model);
    }

    if (this.body) {
      this.body.removeEventListener('collide', this._onCollide);
      if (this.physics?.world?.bodies?.includes(this.body)) {
        this.physics.world.removeBody(this.body);
      }
      this.body = null;
    }
  }
}
