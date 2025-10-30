import * as THREE from "three";
import { GAME_CONFIG } from '../../config/GameConfig.js';
import logger from '../../utils/Logger.js';
import { FEATURES } from '../../config/FeatureFlags.js';

export default class GameLogic {
  constructor({ experience, player, levelManager, sounds }) {
    this.experience = experience;
    this.player = player;
    this.levelManager = levelManager;
    this.sounds = sounds; // { coin, lose, winner, portal }

    this.defeatTriggered = false;

    // Array para trackear timeouts (limpieza en destroy)
    this.timeouts = [];

    // Contador para debouncing de colisiones (optimización de rendimiento)
    this.collisionCheckFrame = 0;
    this.collisionCheckInterval = FEATURES.COLLISION_DEBOUNCING
      ? GAME_CONFIG.gameplay.collisionCheckInterval
      : 1; // Si debouncing desactivado, revisar cada frame

    // Delay antes de poder recoger premios (evita recolección inmediata al spawn)
    this.allowPrizePickup = false;
    const timeoutId = setTimeout(() => {
      this.allowPrizePickup = true;
      this.timeouts = this.timeouts.filter(id => id !== timeoutId);
      logger.debug('Prize pickup habilitado');
    }, GAME_CONFIG.gameplay.prizePickupDelay);
    this.timeouts.push(timeoutId);

    logger.info('🎮', 'GameLogic inicializado');
  }

  /**
   * Esta función es llamada desde World.update()
   * Recibe las listas dinámicas de premios y enemigos.
   */
  update(prizes, enemies) {
    // Si ya perdimos, no procesamos más lógica
    if (this.defeatTriggered || !this.player?.body) {
      return;
    }

    // 1. Revisar colisión con enemigos
    this.checkEnemyCollision(enemies);

    // 2. Revisar colisión con premios
    this.checkPrizeCollision(prizes);
  }

  /**
   * Revisa si el jugador ha sido atrapado por un enemigo.
   */
  checkEnemyCollision(enemies) {
    if (!enemies || enemies.length === 0) return;

    const distToClosest =
      enemies.reduce((min, e) => {
        if (!e?.body?.position || !this.player?.body?.position) return min;
        const d = e.body.position.distanceTo(this.player.body.position);
        return Math.min(min, d);
      }, Infinity) ?? Infinity;

    const defeatDistance = GAME_CONFIG.gameplay.enemyDefeatDistance;
    if (distToClosest < defeatDistance) {
      this.defeatTriggered = true; // ¡Importante! Seteamos el flag

      if (window.userInteracted && this.sounds.lose) {
        this.sounds.lose.play();
      }

      // (Efecto de escala del enemigo)
      const firstEnemy = enemies[0];
      const enemyMesh = firstEnemy?.model || firstEnemy?.group;
      if (enemyMesh) {
        enemyMesh.scale.set(6, 6, 6);
        const timeoutId = setTimeout(() => {
          if (enemyMesh) enemyMesh.scale.set(6, 6, 6);
          this.timeouts = this.timeouts.filter(id => id !== timeoutId);
        }, 500);
        this.timeouts.push(timeoutId);
      }

      // Mostrar modal de derrota
      this.experience.modal.show({
        icon: "💀",
        message: "¡El enemigo te atrapó!\n¿Quieres intentarlo otra vez?",
        buttons: [
          {
            text: "🔁 Reintentar",
            onClick: () => this.experience.resetGameToFirstLevel(),
          },
          {
            text: "❌ Salir",
            onClick: () => this.experience.resetGame(),
          },
        ],
      });
    }
  }

  /**
   * Revisa si el jugador está recolectando un premio.
   * Optimizado con debouncing para mejorar rendimiento.
   */
  checkPrizeCollision(prizes) {
    if (!this.allowPrizePickup || !prizes || prizes.length === 0) return;

    // Debouncing: solo revisar cada N frames para optimizar rendimiento
    this.collisionCheckFrame++;
    if (this.collisionCheckFrame < this.collisionCheckInterval) return;
    this.collisionCheckFrame = 0;

    // Determinar la posición del jugador (VR o PC)
    let playerPos = null;
    if (this.experience.renderer.instance.xr.isPresenting) {
      playerPos = this.experience.camera.instance.position;
    } else if (this.player?.body?.position) {
      playerPos = this.player.body.position;
    } else {
      return; // No hay posición válida
    }

    const speed = this.player?.body?.velocity?.length?.() || 0;
    const minSpeed = GAME_CONFIG.gameplay.minMovementSpeed;
    const hasMoved = speed > minSpeed;

    if (!hasMoved) return; // Optimización: si no se mueve, no puede recolectar

    for (const prize of prizes) {
      // Solo revisar premios visibles y no recolectados
      if (!prize.pivot || prize.collected || !prize.pivot.visible) continue;

      const dist = prize.pivot.position.distanceTo(playerPos);

      // --- LÓGICA DE RECOLECCIÓN ---
      const collectionDistance = GAME_CONFIG.gameplay.prizeCollectionDistance;
      if (dist < collectionDistance) {
        prize.collect(); // El premio se auto-elimina y suena (si tiene sonido)

        if (prize.role === "default") {
          this.levelManager.onPrizeCollected("default");
        } else if (prize.role === "final_prize") {
          this.handleFinalPrizeWin();
        }

        // Actualizar la UI
        this.experience.menu.setStatus?.(
          `🎖️ Puntos: ${this.levelManager.defaultPrizesCollected}`
        );

        // Rompemos el bucle si solo podemos coger una moneda por frame
        break;
      }
    }
  }

  /**
   * Lógica que se dispara al recolectar el premio final.
   */
  handleFinalPrizeWin() {
    if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
      // Aún hay más niveles
      logger.info('🎯', `Nivel ${this.levelManager.currentLevel} completado!`);
      this.levelManager.nextLevel();
    } else {
      // Es el último nivel, ¡Juego terminado!
      logger.info('🏆', 'Juego completado! Todos los niveles superados.');

      const elapsed = this.experience.tracker.stop();
      this.experience.tracker.saveTime(elapsed);
      this.experience.tracker.showEndGameModal(elapsed);

      this.experience.obstacleWavesDisabled = true;
      clearTimeout(this.experience.obstacleWaveTimeout);

      if (window.userInteracted && this.sounds.winner) {
        this.sounds.winner.play();
      }
    }
  }

  /**
   * Resetea el estado de la lógica para un nuevo nivel.
   */
  reset() {
    logger.debug('Reseteando GameLogic...');

    this.defeatTriggered = false;
    this.allowPrizePickup = false;
    this.collisionCheckFrame = 0;

    // Limpiar timeouts anteriores
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];

    // Crear nuevo timeout para prize pickup
    const timeoutId = setTimeout(() => {
      this.allowPrizePickup = true;
      this.timeouts = this.timeouts.filter(id => id !== timeoutId);
      logger.debug('Prize pickup habilitado después de reset');
    }, GAME_CONFIG.gameplay.prizePickupDelay);
    this.timeouts.push(timeoutId);
  }

  /**
   * Limpia recursos y cancela timeouts pendientes
   * Importante para prevenir memory leaks
   */
  destroy() {
    logger.debug('Limpiando GameLogic...');
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];
  }
}
