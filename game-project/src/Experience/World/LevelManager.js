export default class LevelManager {
  constructor(experience) {
    this.experience = experience;
    this.currentLevel = 1; // Inicias en el nivel 1
    this.totalLevels = 3; // Total de niveles
    // --- Nuevas propiedades ---
    this.defaultPrizesToCollect = 0; // Total de premios 'default' en el nivel
    this.defaultPrizesCollected = 0; // Contador de premios 'default' recogidos
  }
  /**
   * Registra cuántos premios 'default' hay en el nivel actual.
   * Debe ser llamado por tu clase World (o la que cargue los premios)
   * después de crear todas las instancias de Prize.
   * @param {number} defaultPrizeCount - El número de premios con role='default'.
   */

  setLevelPrizeCount(defaultPrizeCount) {
    this.defaultPrizesToCollect = defaultPrizeCount;
    this.defaultPrizesCollected = 0; // Resetea el contador
    console.log(
      `Level ${this.currentLevel} loaded. Prizes to collect: ${this.defaultPrizesToCollect}`
    );
  }
  /**
   * Método para ser llamado cuando se recoge un premio.
   * La lógica de colisión (en Robot.js o World.js) debe llamar a este método
   * y pasarle el 'role' del premio que fue recogido.
   * @param {string} role - El 'role' del premio recogido ('default' o 'final_prize').
   */

  onPrizeCollected(role) {
    if (role === "default") {
      this.defaultPrizesCollected++;
      console.log(
        `Default prize collected! ${this.defaultPrizesCollected} / ${this.defaultPrizesToCollect}`
      ); // Si se recogieron todos los premios 'default'

      if (this.defaultPrizesCollected >= this.defaultPrizesToCollect) {
        console.log("All default prizes collected! Showing final prize."); // Asumimos que 'world' tiene un método para mostrar el premio final // (El premio final ya existe pero está invisible, según tu Prize.js)

        if (
          this.experience.world &&
          typeof this.experience.world.showFinalPrize === "function"
        ) {
          this.experience.world.showFinalPrize();
        } else {
          console.warn("world.showFinalPrize() not found!");
        }
      }
    } else if (role === "final_prize") {
      // Si se recogió el premio final, pasa al siguiente nivel
      console.log("Final prize collected! Advancing to next level.");
      this.nextLevel();
    }
  }

  nextLevel() {
    if (this.currentLevel < this.totalLevels) {
      this.currentLevel++; // Resetea los contadores para el nuevo nivel

      this.defaultPrizesCollected = 0;
      this.defaultPrizesToCollect = 0; // Se establecerá de nuevo con setLevelPrizeCount

      this.experience.world.clearCurrentScene();
      this.experience.world.loadLevel(this.currentLevel); // Espera breve para que el nivel se cargue y luego reubicar al robot

      setTimeout(() => {
        // Reubicar de forma segura al punto de spawn fijo usado en todos los niveles
        this.experience.world.resetRobotPosition({ x: 0, y: 0, z: 0 });
      }, 1000);
    } else {
      console.log("All levels completed! Game Over."); // Aquí puedes manejar la lógica de fin de juego (ej. mostrar pantalla de victoria)
    }
  }

  resetLevel() {
    this.currentLevel = 1; // Resetea contadores

    this.defaultPrizesCollected = 0;
    this.defaultPrizesToCollect = 0; // Se establecerá de nuevo con setLevelPrizeCount

    this.experience.world.loadLevel(this.currentLevel); // (Opcional) resetear también la posición del robot aquí

    setTimeout(() => {
      // Posición inicial fija para todos los niveles (centro del mapa)
      this.experience.world.resetRobotPosition({ x: 0, y: 0, z: 0 });
    }, 1000);
  }

  getCurrentLevelTargetPoints() {
    // Esta función ahora puede usar el contador de premios
    return this.defaultPrizesToCollect; // return this.pointsToComplete?.[this.currentLevel] || 2 // Tu lógica original
  }
}
