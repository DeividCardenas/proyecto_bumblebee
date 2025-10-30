import { GAME_CONFIG } from '../../config/GameConfig.js';
import logger from '../../utils/Logger.js';

export default class LevelManager {
  constructor(experience) {
    this.experience = experience;
    this.currentLevel = 1; // Inicias en el nivel 1
    this.totalLevels = GAME_CONFIG.gameplay.totalLevels; // Total de niveles desde config

    // Premios por nivel
    this.defaultPrizesToCollect = 0; // Total de premios 'default' en el nivel
    this.defaultPrizesCollected = 0; // Contador de premios 'default' recogidos

    // Array para trackear timeouts
    this.timeouts = [];

    logger.info('🎯', `LevelManager inicializado (${this.totalLevels} niveles)`);
  }

  /**
   * Registra cuántos premios 'default' hay en el nivel actual.
   * Debe ser llamado por World después de crear todas las instancias de Prize.
   * @param {number} defaultPrizeCount - El número de premios con role='default'.
   */
  setLevelPrizeCount(defaultPrizeCount) {
    this.defaultPrizesToCollect = defaultPrizeCount;
    this.defaultPrizesCollected = 0; // Resetea el contador

    logger.info('💰', `Nivel ${this.currentLevel} cargado. Premios a recoger: ${this.defaultPrizesToCollect}`);
  }

  /**
   * Método para ser llamado cuando se recoge un premio.
   * @param {string} role - El 'role' del premio recogido ('default' o 'final_prize').
   */
  onPrizeCollected(role) {
    if (role === "default") {
      this.defaultPrizesCollected++;

      logger.debug(`Premio recogido! ${this.defaultPrizesCollected} / ${this.defaultPrizesToCollect}`);

      // Si se recogieron todos los premios 'default'
      if (this.defaultPrizesCollected >= this.defaultPrizesToCollect) {
        logger.info('✅', '¡Todos los premios recogidos! Mostrando premio final...');

        if (
          this.experience.world &&
          typeof this.experience.world.showFinalPrize === "function"
        ) {
          this.experience.world.showFinalPrize();
        } else {
          logger.warn("world.showFinalPrize() not found!");
        }
      }
    } else if (role === "final_prize") {
      // Si se recogió el premio final, pasa al siguiente nivel
      logger.info('🏆', 'Premio final recogido! Avanzando al siguiente nivel...');
      this.nextLevel();
    }
  }

  /**
   * Avanza al siguiente nivel
   */
  nextLevel() {
    if (this.currentLevel < this.totalLevels) {
      this.currentLevel++;

      // Resetea los contadores para el nuevo nivel
      this.defaultPrizesCollected = 0;
      this.defaultPrizesToCollect = 0; // Se establecerá de nuevo con setLevelPrizeCount

      this.experience.world.clearCurrentScene();
      this.experience.world.loadLevel(this.currentLevel);

      // Espera breve para que el nivel se cargue y luego reubicar al robot
      const spawnPoint = GAME_CONFIG.gameplay.defaultSpawnPoint;
      const levelTransitionDelay = GAME_CONFIG.gameplay.levelTransitionDelay;

      const timeoutId = setTimeout(() => {
        this.experience.world.resetRobotPosition(spawnPoint);
        this.timeouts = this.timeouts.filter(id => id !== timeoutId);
        logger.debug(`Robot reposicionado en spawn point del nivel ${this.currentLevel}`);
      }, levelTransitionDelay);

      this.timeouts.push(timeoutId);
    } else {
      logger.info('🎊', '¡Todos los niveles completados! Game Over.');
    }
  }

  /**
   * Resetea al nivel 1
   */
  resetLevel() {
    logger.info('🔄', 'Reseteando al nivel 1...');

    this.currentLevel = 1;

    // Resetea contadores
    this.defaultPrizesCollected = 0;
    this.defaultPrizesToCollect = 0; // Se establecerá de nuevo con setLevelPrizeCount

    this.experience.world.loadLevel(this.currentLevel);

    // Limpiar timeouts anteriores
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];

    // Reposicionar robot
    const spawnPoint = GAME_CONFIG.gameplay.defaultSpawnPoint;
    const levelTransitionDelay = GAME_CONFIG.gameplay.levelTransitionDelay;

    const timeoutId = setTimeout(() => {
      this.experience.world.resetRobotPosition(spawnPoint);
      this.timeouts = this.timeouts.filter(id => id !== timeoutId);
    }, levelTransitionDelay);

    this.timeouts.push(timeoutId);
  }

  /**
   * Obtiene el objetivo de puntos del nivel actual
   * @returns {number}
   */
  getCurrentLevelTargetPoints() {
    return this.defaultPrizesToCollect;
  }

  /**
   * Limpia recursos y cancela timeouts pendientes
   */
  destroy() {
    logger.debug('Limpiando LevelManager...');
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];
  }
}
