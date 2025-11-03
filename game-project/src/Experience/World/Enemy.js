import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Sound from './Sound.js';
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js';
import { GAME_CONFIG } from '../../config/GameConfig.js';
import logger from '../../utils/Logger.js';

// Usar configuración centralizada
const CONFIG = GAME_CONFIG.enemy;

export default class Enemy {
  constructor({ experience, position, playerRef }) {
    this.experience = experience;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.physics = this.experience.physics;
    this.time = this.experience.time;
    this.playerRef = playerRef;

    // Estado del enemigo
    this.isInitialized = false;
    this.isDead = false;
    this.isDestroyed = false;

    // Posición inicial
    this.initialPosition = position ? new THREE.Vector3(position.x, position.y, position.z) : new THREE.Vector3(0, 0, 0);

    // Guardar posición inicial para límite de persecución
    this.spawnPosition = new CANNON.Vec3(
      this.initialPosition.x,
      this.initialPosition.y,
      this.initialPosition.z
    );

    // Vectores reutilizables
    this.targetPosition = new CANNON.Vec3();
    this.moveDirection = new CANNON.Vec3();

    // Inicializar siguiendo patrón de Robot.js
    if (this.resources.items.enemyRedModel) {
      try {
        this.setModel();
        this.setSounds();
        this.setPhysics();
        this.setAnimation();
        this.isInitialized = true;
        logger.info('👹✅', `Enemigo inicializado en (${this.initialPosition.x}, ${this.initialPosition.y}, ${this.initialPosition.z})`);
      } catch (error) {
        logger.error('Error al inicializar el Enemigo:', error);
        this.destroy();
      }
    } else {
      logger.error('El modelo enemyRedModel no está cargado correctamente');
    }
  }

  setModel() {
    // IGUAL QUE ROBOT.JS: NO clonar, usar directo
    this.model = this.resources.items.enemyRedModel.scene;
    this.model.scale.set(CONFIG.modelScale, CONFIG.modelScale, CONFIG.modelScale);
    this.model.position.set(0, 0, 0); // Posición relativa al group

    // IGUAL QUE ROBOT.JS: Crear group y agregar modelo al group
    this.group = new THREE.Group();
    this.group.position.copy(this.initialPosition); // El GROUP tiene la posición, no el modelo
    this.group.add(this.model);
    this.scene.add(this.group);

    // IGUAL QUE ROBOT.JS: Traverse simple solo para sombras
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    logger.info('👹', `Modelo de enemigo cargado y agregado al group`);
  }

  setSounds() {
    // Sonido de proximidad con volumen inicial 0
    this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 });
    try {
      this.proximitySound.play();
    } catch (err) {
      logger.warn('No se pudo reproducir sonido de proximidad:', err);
    }
  }

  setPhysics() {
    if (!this.physics?.world) {
      logger.warn('No hay physics.world — el enemigo no tendrá física.');
      return;
    }

    const shape = new CANNON.Sphere(CONFIG.sphereRadius);
    const enemyMaterial = new CANNON.Material('enemyMaterial');

    // Crear body en la posición inicial
    this.body = new CANNON.Body({
      mass: CONFIG.mass,
      shape: shape,
      position: new CANNON.Vec3(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z),
      linearDamping: CONFIG.linearDamping,
      material: enemyMaterial
    });

    this.physics.world.addBody(this.body);
    this.model.userData.physicsBody = this.body;

    // Manejo de colisiones
    this._onCollide = (event) => {
      try {
        if (this.isDead) return; // Ignorar colisiones si ya está muerto

        if (event.body === this.playerRef?.body) {
          logger.info('👹💀', '¡ENEMIGO TOCÓ AL JUGADOR! Iniciando muerte del robot...');

          // Matar al jugador
          if (this.playerRef.die) {
            this.playerRef.die();
          } else {
            logger.error('playerRef.die no está disponible');
          }

          // Partículas de impacto
          new FinalPrizeParticles({
            scene: this.scene,
            targetPosition: this.body.position,
            sourcePosition: this.body.position,
            experience: this.experience
          });

          // Destruir el enemigo
          this.die();
        }
      } catch (err) {
        logger.error('Error manejando colisión de enemigo:', err);
      }
    };

    this.body.addEventListener('collide', this._onCollide);
    logger.info('👹⚛️', `Físicas de enemigo configuradas: radio=${CONFIG.sphereRadius}, masa=${CONFIG.mass}`);
  }

  setAnimation() {
    this.animation = {};
    this.animation.mixer = new THREE.AnimationMixer(this.model);
    this.animation.actions = {};

    const animations = this.resources.items.enemyRedModel.animations;
    if (!animations || animations.length === 0) {
      logger.error('El modelo del enemigo no tiene animaciones');
      return;
    }

    // Cargar animaciones requeridas
    for (const [actionKey, animName] of Object.entries(CONFIG.requiredAnimations)) {
      const clip = animations.find(anim => anim.name === animName);
      if (clip) {
        this.animation.actions[actionKey] = this.animation.mixer.clipAction(clip);
      } else {
        logger.warn(`Animación "${animName}" no encontrada para la acción "${actionKey}"`);
      }
    }

    // Fallback si no se encuentra idle
    if (!this.animation.actions.idle) {
      const anyClip = animations[0];
      if (anyClip) {
        logger.warn('Asignando clip por defecto como idle.');
        this.animation.actions.idle = this.animation.mixer.clipAction(anyClip);
      } else {
        logger.error('No hay clips disponibles para animaciones del enemigo.');
        return;
      }
    }

    // Fallback para walking
    if (!this.animation.actions.walking) {
      this.animation.actions.walking = this.animation.actions.idle;
    }

    // Iniciar con idle
    if (this.animation.actions.idle) {
      this.animation.actions.current = this.animation.actions.idle;
      this.animation.actions.current.play();
    }

    // Función play
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

    logger.info('👹🎬', 'Animaciones del enemigo configuradas correctamente');
  }

  update(deltaTime) {
    if (!this.isInitialized || this.isDead || this.isDestroyed) return;
    if (!this.body || !this.playerRef?.body) return;

    // Actualizar animaciones
    if (this.animation?.mixer) {
      this.animation.mixer.update(deltaTime);
    }

    const targetPos = this.targetPosition.copy(this.playerRef.body.position);
    const enemyPos = this.body.position;
    const distance = enemyPos.distanceTo(targetPos);

    // Verificar distancia desde spawn point
    const distanceFromSpawn = enemyPos.distanceTo(this.spawnPosition);

    // Si el enemigo se alejó mucho de su spawn, volver al punto inicial
    if (distanceFromSpawn > CONFIG.returnToSpawnDistance) {
      this.moveDirection.copy(this.spawnPosition);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();
      this.moveDirection.scale(CONFIG.baseSpeed, this.moveDirection);

      this.body.velocity.x = this.moveDirection.x;
      this.body.velocity.y = this.moveDirection.y;
      this.body.velocity.z = this.moveDirection.z;

      this.animation?.play('walking');

      // Rotar hacia la dirección
      if (this.group) {
        const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
        this.group.rotation.y = angle;
      }
    }
    // Si el jugador está dentro del rango de persecución
    else if (distance < CONFIG.maxChaseDistance && distance > CONFIG.stopDistance) {
      this.moveDirection.copy(targetPos);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();

      // Velocidad variable: más rápido si está cerca
      const speed = distance < CONFIG.chaseDistance ? CONFIG.chaseSpeed : CONFIG.baseSpeed;
      this.moveDirection.scale(speed, this.moveDirection);

      this.body.velocity.x = this.moveDirection.x;
      this.body.velocity.y = this.moveDirection.y;
      this.body.velocity.z = this.moveDirection.z;

      this.animation?.play('walking');

      // Rotar hacia el jugador
      if (this.group) {
        const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
        this.group.rotation.y = angle;
      }
    } else {
      // Detenerse si está muy cerca o el jugador está fuera de rango
      this.body.velocity.set(0, 0, 0);
      this.animation?.play('idle');
    }

    // CRÍTICO: Sincronizar GROUP (no model) con body - IGUAL QUE ROBOT.JS
    if (this.group && this.body) {
      this.group.position.copy(this.body.position);
    }

    // Sonido de proximidad
    const proximityVolume = Math.max(0, 1 - (distance / CONFIG.soundMaxDistance));
    this.proximitySound?.setVolume(proximityVolume * 0.8);
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;

    logger.info('👹💀', 'Enemigo muriendo...');

    // Detener velocidad
    if (this.body) {
      this.body.velocity.set(0, 0, 0);
      this.body.angularVelocity.set(0, 0, 0);
    }

    // Detener sonidos
    this.proximitySound?.stop();

    // Remover cuerpo físico
    if (this.body && this.physics?.world?.bodies?.includes(this.body)) {
      this.physics.world.removeBody(this.body);
    }

    // Hacer caer el modelo (efecto visual)
    if (this.group) {
      this.group.position.y -= 0.5;
      this.group.rotation.x = -Math.PI / 2; // Caer de lado
    }

    // Destruir después de un breve delay
    setTimeout(() => {
      this.destroy();
    }, 2000);
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    logger.info('👹🗑️', 'Destruyendo enemigo...');

    try {
      // Detener sonidos
      this.proximitySound?.stop();
    } catch (err) {
      logger.warn('Error al detener sonido:', err);
    }

    // Remover del mundo físico
    if (this.body) {
      if (this._onCollide) {
        this.body.removeEventListener('collide', this._onCollide);
      }
      if (this.physics?.world?.bodies?.includes(this.body)) {
        this.physics.world.removeBody(this.body);
      }
      this.body = null;
    }

    // Remover de la escena
    if (this.group?.parent) {
      this.scene.remove(this.group);
    }

    // Limpiar animaciones
    if (this.animation?.mixer) {
      this.animation.mixer.stopAllAction();
    }

    logger.info('👹✅', 'Enemigo destruido correctamente');
  }
}
