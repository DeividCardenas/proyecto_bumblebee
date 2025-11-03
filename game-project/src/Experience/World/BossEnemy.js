import * as THREE from 'three';
import Enemy from './Enemy.js';
import logger from '../../utils/Logger.js';
import { GAME_CONFIG } from '../../config/GameConfig.js';

/**
 * BossEnemy - Clase extendida para el jefe final (Shockwave)
 *
 * Extiende Enemy.js y sobrescribe solo lo necesario:
 * - Usa el modelo Shockwave.glb en lugar de Decepticon_Soldier.glb
 * - Mayor escala visual (20% más grande)
 * - Mayor rango de persecución y velocidad
 * - Mismo sistema de animaciones (idle01, dash)
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

    // IGUAL QUE ENEMY/ROBOT: NO clonar, usar directo
    this.model = resource.scene;
    this.model.scale.set(bossScale, bossScale, bossScale);
    this.model.position.set(0, 0, 0); // Posición relativa al group

    // IGUAL QUE ENEMY/ROBOT: Crear group y agregar modelo al group
    this.group = new THREE.Group();
    this.group.position.copy(this.initialPosition);
    this.group.add(this.model);
    this.scene.add(this.group);

    // IGUAL QUE ENEMY/ROBOT: Traverse simple solo para sombras
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    logger.info('👹👑', `Modelo BOSS cargado (escala ${bossScale})`);
  }

  /**
   * Sobrescribir setAnimation para usar el bossModel resource
   */
  setAnimation() {
    this.animation = {};
    this.animation.mixer = new THREE.AnimationMixer(this.model);
    this.animation.actions = {};

    const animations = this.resources.items.bossModel.animations;
    if (!animations || animations.length === 0) {
      logger.error('El modelo del BOSS no tiene animaciones');
      return;
    }

    const CONFIG = GAME_CONFIG.enemy;

    // Cargar animaciones requeridas
    for (const [actionKey, animName] of Object.entries(CONFIG.requiredAnimations)) {
      const clip = animations.find(anim => anim.name === animName);
      if (clip) {
        this.animation.actions[actionKey] = this.animation.mixer.clipAction(clip);
      } else {
        logger.warn(`Animación "${animName}" no encontrada para BOSS`);
      }
    }

    // Fallback si no se encuentra idle
    if (!this.animation.actions.idle) {
      const anyClip = animations[0];
      if (anyClip) {
        logger.warn('BossEnemy: Asignando clip por defecto como idle.');
        this.animation.actions.idle = this.animation.mixer.clipAction(anyClip);
      } else {
        logger.error('BossEnemy: No hay clips disponibles.');
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
        logger.warn('BossEnemy: Error al cambiar animación:', err);
      }
    };

    logger.info('👹👑🎬', 'Animaciones del BOSS configuradas correctamente');
  }

  /**
   * Sobrescribir update para comportamiento de boss mejorado
   * - Mayor rango de persecución (1.5x)
   * - Velocidad aumentada (1.2x chase, 1.1x base)
   */
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

    const distanceFromSpawn = enemyPos.distanceTo(this.spawnPosition);

    // Boss: parámetros mejorados
    const BOSS_MAX_CHASE_DISTANCE = GAME_CONFIG.enemy.maxChaseDistance * 1.5;
    const BOSS_CHASE_DISTANCE = GAME_CONFIG.enemy.chaseDistance * 1.5;
    const BOSS_RETURN_DISTANCE = GAME_CONFIG.enemy.returnToSpawnDistance * 1.5;
    const BOSS_CHASE_SPEED = GAME_CONFIG.enemy.chaseSpeed * 1.2; // 20% más rápido
    const BOSS_BASE_SPEED = GAME_CONFIG.enemy.baseSpeed * 1.1; // 10% más rápido

    // Si el boss se alejó mucho, volver
    if (distanceFromSpawn > BOSS_RETURN_DISTANCE) {
      this.moveDirection.copy(this.spawnPosition);
      this.moveDirection.vsub(enemyPos, this.moveDirection);
      this.moveDirection.normalize();
      this.moveDirection.scale(BOSS_BASE_SPEED, this.moveDirection);

      this.body.velocity.x = this.moveDirection.x;
      this.body.velocity.y = this.moveDirection.y;
      this.body.velocity.z = this.moveDirection.z;

      this.animation?.play('walking');

      if (this.group) {
        const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
        this.group.rotation.y = angle;
      }
    }
    // Boss persigue con mayor rango
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

      if (this.group) {
        const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
        this.group.rotation.y = angle;
      }
    } else {
      // Detenerse
      this.body.velocity.set(0, 0, 0);
      this.animation?.play('idle');
    }

    // CRÍTICO: Sincronizar GROUP con body - IGUAL QUE ENEMY/ROBOT
    if (this.group && this.body) {
      this.group.position.copy(this.body.position);
    }

    // Sonido de proximidad (más fuerte para el boss)
    const proximityVolume = Math.max(0, 1 - (distance / GAME_CONFIG.enemy.soundMaxDistance));
    this.proximitySound?.setVolume(proximityVolume * 1.0); // 100% volumen (vs 80% normal)
  }

  /**
   * Sobrescribir die para logging especial del boss
   */
  die() {
    logger.info('👹👑💀', '¡BOSS DERROTADO!');
    super.die();
  }

  /**
   * Sobrescribir destroy para logging especial
   */
  destroy() {
    if (this.isDestroyed) return;
    logger.info('👹👑🗑️', 'Boss Enemy (Shockwave) destruido');
    super.destroy();
  }
}
