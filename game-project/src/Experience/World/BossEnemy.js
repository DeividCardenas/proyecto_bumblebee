import * as THREE from 'three';
import Enemy from './Enemy.js';
import logger from '../../utils/Logger.js';
import { GAME_CONFIG } from '../../config/GameConfig.js';

/**
 * BossEnemy - Clase extendida para el jefe final (Shockwave)
 *
 * Características especiales:
 * - Usa el modelo Shockwave.glb en lugar de Decepticon_Soldier.glb
 * - Mayor escala visual (más intimidante)
 * - Mayor rango de persecución (más agresivo)
 * - Velocidad de persecución aumentada
 * - Mismo sistema de animaciones (idle01, dash)
 * - Sistema de remoción de armas heredado
 *
 * @extends Enemy
 */
export default class BossEnemy extends Enemy {
  constructor({ experience, position, playerRef }) {
    // Llamar al constructor padre
    super({ experience, position, playerRef });

    // Marcar como boss para lógica especial si es necesaria
    this.isBoss = true;

    logger.info('👹👑', 'Boss Enemy (Shockwave) inicializado', { position: this.initialPosition });
  }

  /**
   * Sobrescribir setModel para usar el bossModel en lugar de enemyRedModel
   */
  setModel() {
    const resource = this.resources?.items?.bossModel;
    if (!resource) {
      throw new Error('El recurso "bossModel" no está cargado en resources.items.');
    }

    // Escala aumentada para el boss (20% más grande que enemigos normales)
    const bossScale = GAME_CONFIG.enemy.modelScale * 1.2;

    // Clonar escena / mesh
    this.model = resource.scene.clone(true);
    this.model.scale.set(bossScale, bossScale, bossScale);

    // Asegurarse de tener una posición THREE.Vector3
    this.model.position.set(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z);

    this.scene.add(this.model);
    this.model.visible = true;

    // CRÍTICO: Forzar visibilidad de TODOS los children del modelo
    let meshCount = 0;
    this.model.traverse((child) => {
      child.visible = true;

      if (child.isMesh || child instanceof THREE.Mesh) {
        meshCount++;
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          child.material.visible = true;
          if (child.material.transparent === false) {
            child.material.opacity = 1.0;
          }
        }
      }
    });

    logger.info('👹👑✅', `Modelo BOSS cargado: ${this.model.children.length} children, ${meshCount} meshes (escala ${bossScale})`);
    logger.info('👹👑📍', `Posición BOSS: (${this.initialPosition.x}, ${this.initialPosition.y}, ${this.initialPosition.z})`);

    // CRÍTICO: Remover armas del boss también
    // NOTA: Deshabilitado temporalmente para debug
    // this.removeWeapons();

    // Log de estructura del modelo para debug
    this.logModelStructure();
  }

  /**
   * Sobrescribir setAnimation para usar el bossModel resource
   */
  setAnimation() {
    const resource = this.resources?.items?.bossModel;
    if (!resource) {
      logger.warn('No hay resource.animations para BossEnemy.');
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
      logger.debug('BossEnemy: animaciones disponibles ->', resource.animations.map(a => a.name));
    }

    const CONFIG = GAME_CONFIG.enemy;
    for (const [actionKey, animName] of Object.entries(CONFIG.requiredAnimations)) {
      const clip = resource.animations?.find(anim => anim.name === animName);
      if (clip) {
        this.animation.actions[actionKey] = this.animation.mixer.clipAction(clip);
      } else {
        logger.warn(`Animación de BossEnemy "${animName}" no encontrada. actionKey=${actionKey}`);
      }
    }

    // Fallback
    if (!this.animation.actions.idle) {
      const anyClip = resource.animations?.[0];
      if (anyClip) {
        logger.warn('BossEnemy: Asignando clip por defecto como idle.');
        this.animation.actions.idle = this.animation.mixer.clipAction(anyClip);
      } else {
        logger.warn('BossEnemy: No hay clips disponibles para animaciones.');
      }
    }
    if (!this.animation.actions.walking) {
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
        logger.warn('BossEnemy: Error al cambiar animación:', err);
      }
    };
  }

  /**
   * Sobrescribir update para comportamiento de boss mejorado
   * - Mayor rango de persecución
   * - Velocidad aumentada
   */
  update(deltaTime) {
    if (this.isDestroyed) return;
    if (!this.body || !this.playerRef?.body) {
      if (this.model && (!this.body)) {
        this.model.position.set(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z);
      }
      return;
    }

    const targetPos = this.targetPosition.copy(this.playerRef.body.position);
    const enemyPos = this.body.position;
    const distance = enemyPos.distanceTo(targetPos);

    const distanceFromSpawn = enemyPos.distanceTo(this.spawnPosition);

    // Boss: mayor rango de persecución (1.5x normal)
    const BOSS_MAX_CHASE_DISTANCE = GAME_CONFIG.enemy.maxChaseDistance * 1.5;
    const BOSS_CHASE_DISTANCE = GAME_CONFIG.enemy.chaseDistance * 1.5;
    const BOSS_CHASE_SPEED = GAME_CONFIG.enemy.chaseSpeed * 1.2; // 20% más rápido
    const BOSS_BASE_SPEED = GAME_CONFIG.enemy.baseSpeed * 1.1; // 10% más rápido

    // Si el boss se alejó mucho de su spawn, volver
    if (distanceFromSpawn > GAME_CONFIG.enemy.returnToSpawnDistance * 1.5) {
      logger.debug('👹👑', 'Boss demasiado lejos del spawn, regresando...');
      this.moveDirection.copy(this.spawnPosition);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();
      this.moveDirection.scale(BOSS_BASE_SPEED, this.moveDirection);

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
    // Boss persigue al jugador con mayor rango
    else if (distance < BOSS_MAX_CHASE_DISTANCE && distance > GAME_CONFIG.enemy.stopDistance) {
      this.moveDirection.copy(targetPos);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();

      // Velocidad aumentada para el boss
      const speed = distance < BOSS_CHASE_DISTANCE ? BOSS_CHASE_SPEED : BOSS_BASE_SPEED;
      this.moveDirection.scale(speed, this.moveDirection);

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
    } else {
      // Detenerse
      this.body.velocity.set(0, 0, 0);
      this.animation?.play('idle');
    }

    // Sincronizar modelo visual con cuerpo físico
    if (this.model && this.body) {
      this.model.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
      this.model.quaternion.set(
        this.body.quaternion.x,
        this.body.quaternion.y,
        this.body.quaternion.z,
        this.body.quaternion.w
      );
    }

    // Sonido de proximidad (más fuerte para el boss)
    const proximityVolume = Math.max(0, 1 - (distance / GAME_CONFIG.enemy.soundMaxDistance));
    this.proximitySound?.setVolume(proximityVolume * 1.0); // 100% volumen (vs 80% normal)

    // Actualizar animaciones
    this.animation?.mixer?.update(deltaTime);
  }

  /**
   * Sobrescribir destroy para logging especial
   */
  destroy() {
    logger.info('👹👑', 'Boss Enemy (Shockwave) destruido');
    super.destroy();
  }
}
