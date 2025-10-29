import * as THREE from "three";

export default class GameLogic {
  constructor({ experience, player, levelManager, sounds }) {
    this.experience = experience;
    this.player = player;
    this.levelManager = levelManager;
    this.sounds = sounds; // { coin, lose, winner, portal }

    this.defeatTriggered = false;

    // Lógica del delay que tenías en World
    this.allowPrizePickup = false;
    setTimeout(() => {
      this.allowPrizePickup = true;
    }, 2000);
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

    if (distToClosest < 1.0) {
      this.defeatTriggered = true; // ¡Importante! Seteamos el flag

      if (window.userInteracted && this.sounds.lose) {
        this.sounds.lose.play();
      }

      // (Efecto de escala del enemigo)
      const firstEnemy = enemies[0];
      const enemyMesh = firstEnemy?.model || firstEnemy?.group;
      if (enemyMesh) {
        enemyMesh.scale.set(6, 6, 6);
        setTimeout(() => {
          enemyMesh.scale.set(6, 6, 6);
        }, 500);
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
   */
  checkPrizeCollision(prizes) {
    if (!this.allowPrizePickup || !prizes || prizes.length === 0) return;

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
    const hasMoved = speed > 0.5;

    if (!hasMoved) return; // Optimización: si no se mueve, no puede recolectar

    for (const prize of prizes) {
      // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
      // Ahora también comprueba si el pivote del premio es visible.
      // Si no lo es (como el final_prize al inicio), lo ignora.
      if (!prize.pivot || prize.collected || !prize.pivot.visible) continue;

      const dist = prize.pivot.position.distanceTo(playerPos);

      // --- LÓGICA DE RECOLECCIÓN ---
      if (dist < 1.2) {
        prize.collect(); // El premio se auto-elimina y suena (si tiene sonido)
        // prize.collected = true; // 'collect()' ya debería setear esto

        if (prize.role === "default") {
          this.levelManager.onPrizeCollected("default");
        } else if (prize.role === "final_prize") {
          this.handleFinalPrizeWin();
        }

        // Sonido de moneda (manejado por Prize.js, pero lo dejamos por si acaso)
        if (window.userInteracted && this.sounds.coin) {
          // this.sounds.coin.play(); // Prize.js ya lo hace, pero si falla, descomenta
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
      this.levelManager.nextLevel();
    } else {
      // Es el último nivel, ¡Juego terminado!
      console.log("Final prize collected! Game Over.");
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
    this.defeatTriggered = false;
    this.allowPrizePickup = false;
    setTimeout(() => {
      this.allowPrizePickup = true;
    }, 2000);
  }
}