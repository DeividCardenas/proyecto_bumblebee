import * as THREE from "three";
import Environment from "./Environment.js";
import Fox from "./Fox.js";
import Robot from "./Robot.js";
import ToyCarLoader from "../../loaders/ToyCarLoader.js";
import Floor from "./Floor.js";
import ThirdPersonCamera from "./ThirdPersonCamera.js";
import Sound from "./Sound.js";
import AmbientSound from "./AmbientSound.js";
import MobileControls from "../../controls/MobileControls.js";
import LevelManager from "./LevelManager.js";
import BlockPrefab from "./BlockPrefab.js";
import Enemy from "./Enemy.js";
import GameLogic from "../Utils/GameLogic.js";
import FXManager from "../Utils/FXManager.js";
import Prize from "./Prize.js";

export default class World {
  constructor(experience) {
    this.experience = experience;
    this.scene = this.experience.scene;
    this.blockPrefab = new BlockPrefab(this.experience);
    this.resources = this.experience.resources;

    // --- Integración LevelManager ---
    this.levelManager = new LevelManager(this.experience);

    // --- Manejador de Efectos ---
    this.fxManager = new FXManager(this.scene, this.experience);

    this.finalPrizeActivated = false;
    this.gameStarted = false;
    this.enemies = [];

    this.coinSound = new Sound("/sounds/coin.ogg");
    this.ambientSound = new AmbientSound("/sounds/ambiente.mp3");
    this.winner = new Sound("/sounds/winner.mp3");
    this.portalSound = new Sound("/sounds/portal.mp3");
    this.loseSound = new Sound("/sounds/lose.ogg");

    this.resources.on("ready", async () => {
      this.floor = new Floor(this.experience);
      this.environment = new Environment(this.experience);

      this.loader = new ToyCarLoader(this.experience);

      // 1. Carga el Nivel 1 (o el nivel por defecto)
      await this.loader.loadFromAPI();

      // --- ¡ESTA ES LA CORRECCIÓN DEL BUG! ---
      // 2. Contamos las monedas del Nivel 1 y configuramos el LevelManager
      // (Esta lógica faltaba aquí y solo estaba en loadLevel)
      const defaultPrizeCount = this.loader.prizes.filter(
        (p) => p.role === "default"
      ).length;

      if (defaultPrizeCount === 0) {
        console.warn(
          "⚠️ ¡Advertencia (Nivel 1)! No se encontraron premios con 'role: \"default\"'."
        );
      }
      this.levelManager.setLevelPrizeCount(defaultPrizeCount);
      // --- FIN DE LA CORRECCIÓN DEL BUG ---

      this.fox = new Fox(this.experience);
      this.robot = new Robot(this.experience);

      // Enemigos múltiples: plantilla y spawn lejos del jugador
      this.enemyTemplate = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      const enemiesCountEnv = parseInt(
        import.meta.env.VITE_ENEMIES_COUNT || "0",
        10
      );
      const enemiesCount =
        Number.isFinite(enemiesCountEnv) && enemiesCountEnv > 0
          ? enemiesCountEnv
          : 0;
      this.spawnEnemies(enemiesCount);

      this.thirdPersonCamera = new ThirdPersonCamera(
        this.experience,
        this.robot.group
      );

      this.mobileControls = new MobileControls({
        onUp: (pressed) => {
          this.experience.keyboard.keys.up = pressed;
        },
        onDown: (pressed) => {
          this.experience.keyboard.keys.down = pressed;
        },
        onLeft: (pressed) => {
          this.experience.keyboard.keys.left = pressed;
        },
        onRight: (pressed) => {
          this.experience.keyboard.keys.right = pressed;
        },
      });

      // --- Manejador de Lógica de Juego ---
      // NUEVO: Se instancia después de que el 'robot' (player) exista
      this.gameLogic = new GameLogic({
        experience: this.experience,
        player: this.robot,
        levelManager: this.levelManager,
        sounds: {
          coin: this.coinSound,
          lose: this.loseSound,
          winner: this.winner,
          portal: this.portalSound,
        },
      });

      if (!this.experience.physics || !this.experience.physics.world) {
        console.error(
          "🚫 Sistema de físicas no está inicializado al cargar el mundo."
        );
        return;
      }
    });
  }

  // Crear varios enemigos en posiciones alejadas del jugador para evitar atascos iniciales
  spawnEnemies(count = 0) {
    if (!this.robot?.body?.position) return;
    const playerPos = this.robot.body.position;
    const minRadius = 25;
    const maxRadius = 40;

    // Limpia anteriores si existen
    if (this.enemies?.length) {
      this.enemies.forEach((e) => e?.destroy?.());
      this.enemies = [];
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;
      const y = 1.5;

      const enemy = new Enemy({
        experience: this.experience,
        playerRef: this.robot,
        position: new THREE.Vector3(x, y, z),
      });

      // Pequeño delay para que no ataquen todos a la vez
      enemy.delayActivation = 1.0 + i * 0.5;
      this.enemies.push(enemy);
    }
  }

  toggleAudio() {
    this.ambientSound.toggle();
  }

  update(delta) {
    this.fox?.update();
    this.robot?.update();
    this.blockPrefab?.update();

    // NUEVO: Actualizar el manager de efectos (para rotación del faro, etc.)
    this.fxManager.update(delta);

    // 🧟‍♂️ Solo actualizar enemigos si el juego ya comenzó
    if (this.gameStarted) {
      this.enemies?.forEach((e) => e.update(delta));

      // NUEVO: Delegar la lógica de colisiones y estado del juego
      if (this.gameLogic && !this.gameLogic.defeatTriggered) {
        this.gameLogic.update(this.loader.prizes, this.enemies);
      }
    }

    if (
      this.thirdPersonCamera &&
      this.experience.isThirdPerson &&
      !this.experience.renderer.instance.xr.isPresenting
    ) {
      this.thirdPersonCamera.update();
    }

    // Actualizar rotación de premios (esto se queda)
    this.loader?.prizes?.forEach((p) => p.update(delta));

    // Optimización física por distancia (esto se queda)
    const playerPos = this.experience.renderer.instance.xr.isPresenting
      ? this.experience.camera.instance.position
      : this.robot?.body?.position;

    this.scene.traverse((obj) => {
      if (obj.userData?.levelObject && obj.userData.physicsBody) {
        const dist = obj.position.distanceTo(playerPos);
        const shouldEnable = dist < 40 && obj.visible;

        const body = obj.userData.physicsBody;
        if (shouldEnable && !body.enabled) {
          body.enabled = true;
        } else if (!shouldEnable && body.enabled) {
          body.enabled = false;
        }
      }
    });
  }

  async loadLevel(level) {
    try {
      // ... (Toda la lógica de fetch de datos se mantiene igual) ...
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const apiUrl = `${backendUrl}/api/blocks?level=${level}`;

      let data;
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Error desde API");
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const preview = (await res.text()).slice(0, 120);
          throw new Error(
            `Respuesta no-JSON desde API (${apiUrl}): ${preview}`
          );
        }
        data = await res.json();
        console.log(`📦 Datos del nivel ${level} cargados desde API`);
      } catch (error) {
        console.warn(
          `⚠️ No se pudo conectar con el backend (${error.message}). Usando datos locales para nivel ${level}...`
        );
        const publicPath = (p) => {
          const base = import.meta.env.BASE_URL || "/";
          return `${base.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
        };

        console.log("PRUEBA DE DEPURACIÓN: ¿Tienen 'role' los premios?", this.loader.prizes);

        const localUrl = publicPath("data/toy_car_blocks.json");
        const localRes = await fetch(localUrl);
        if (!localRes.ok) {
          const preview = (await localRes.text()).slice(0, 120);
          throw new Error(
            `No se pudo cargar ${localUrl} (HTTP ${localRes.status}). Vista previa: ${preview}`
          );
        }
        const localCt = localRes.headers.get("content-type") || "";
        if (!localCt.includes("application/json")) {
          const preview = (await localRes.text()).slice(0, 120);
          throw new Error(
            `Contenido no JSON en ${localUrl}. Vista previa: ${preview}`
          );
        }
        const allBlocks = await localRes.json();
        const filteredBlocks = allBlocks.filter((b) => b.level === level);
        data = {
          blocks: filteredBlocks,
          // Usaremos un spawn fijo en (0,0,0) para todos los niveles
          spawnPoint: { x: 0, y: 0, z: 0 },
        };
      }

      // Ignorar cualquier spawn diferente y forzar el punto (0,0,0) para todos los niveles
      const spawnPoint = { x: 0, y: 0, z: 0 };

      this.finalPrizeActivated = false;

      this.experience.menu.setStatus?.(`🎖️ Puntos: 0`);

      if (data.blocks) {
        const publicPath = (p) => {
          const base = import.meta.env.BASE_URL || "/";
          return `${base.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
        };
        const preciseUrl = publicPath("config/precisePhysicsModels.json");
        const preciseRes = await fetch(preciseUrl);
        if (!preciseRes.ok) {
          const preview = (await preciseRes.text()).slice(0, 120);
          throw new Error(
            `No se pudo cargar ${preciseUrl} (HTTP ${preciseRes.status}). Vista previa: ${preview}`
          );
        }
        const preciseCt = preciseRes.headers.get("content-type") || "";
        if (!preciseCt.includes("application/json")) {
          const preview = (await preciseRes.text()).slice(0, 120);
          throw new Error(
            `Contenido no JSON en ${preciseUrl}. Vista previa: ${preview}`
          );
        }
        const preciseModels = await preciseRes.json();

        // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
        // Aseguramos que las monedas estén cargadas antes de seguir.
        await this.loader._processBlocks(data.blocks, preciseModels);
      } else {
        await this.loader.loadFromURL(apiUrl);
      }
      // ... (Fin de la lógica de fetch) ...

      this.loader.prizes.forEach((p) => {
        if (p.model) p.model.visible = p.role !== "finalPrize";
        p.collected = false;
      });

      // --- Integración LevelManager ---
      const defaultPrizeCount = this.loader.prizes.filter(
        (p) => p.role === "default"
      ).length;

      if (defaultPrizeCount === 0) {
        console.warn(
          "⚠️ ¡Advertencia! No se encontraron premios con 'role: \"default\"'.",
          "El contador de premios del nivel es 0.",
          "Asegúrate de que tus monedas (circle_material) tengan 'role: \"default\"' en tus datos."
        );
      }
      this.levelManager.setLevelPrizeCount(defaultPrizeCount);

      if (this.gameLogic) {
        this.gameLogic.reset();
      }

      this.resetRobotPosition(spawnPoint);
      console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint);
    } catch (error) {
      console.error("❌ Error cargando nivel:", error);
    }
  }

showFinalPrize() {
    if (this.finalPrizeActivated) return;
    console.log("🔥 Activando showFinalPrize() para crear el Portal...");

    // 1. Obtener el recurso GLTF del portal
    const portalResource = this.resources.items.Portal;
    if (!portalResource || !portalResource.scene) {
      console.error("❌ No se encontró el recurso 'Portal'. Revisa tu 'sources.js'.");
      return;
    }
    
    // 2. Instanciar el modelo y la posición
    const portalModel = portalResource.scene.clone();
    
    // --- ¡CAMBIO DE POSICIÓN! ---
    // Lo subimos 1 unidad en Y para que flote sobre el suelo (que está en Y=0)
    const portalPosition = new THREE.Vector3(0, 1, 0); 
    // --- FIN DEL CAMBIO ---

    // 3. Forzamos visibilidad
    portalModel.traverse((child) => {
      child.visible = true;
    });
    
    // 4. Creamos una instancia real de la clase Prize
    const finalPortalPrize = new Prize({
      model: portalModel,
      position: portalPosition, // <-- Pasa la nueva posición Y=1
      scene: this.scene,
      role: "final_prize",
      
      // --- ¡CAMBIO IMPORTANTE! ---
      // No le pasamos las animaciones para evitar el cuelgue.
      // animations: portalResource.animations // <-- LÍNEA DESACTIVADA
    });

    // 5. Hacemos visible el premio
    finalPortalPrize.pivot.visible = true;

    // 6. Añadir el nuevo premio al array que GameLogic revisa
    if (!this.loader || !this.loader.prizes) {
       console.error("❌ this.loader.prizes no está listo.");
       return;
    }
    
    this.loader.prizes = this.loader.prizes.filter(p => p.role !== 'final_prize');
    this.loader.prizes.push(finalPortalPrize);
    
    this.finalPrizeActivated = true;

    // 7. Activar el FXManager (Faro de luz)
    const sourcePos = this.experience.renderer.instance.xr.isPresenting
      ? this.experience.vrDolly?.position ?? this.experience.camera.instance.position
      : this.robot.body.position;

    this.fxManager.showFinalPrizeBeacon(
      finalPortalPrize.pivot.position, 
      sourcePos
    );

    // 8. Sonido del portal
    if (window.userInteracted && this.portalSound) {
      this.portalSound.play();
    }

    console.log("✅ Portal (final_prize) creado en (0, 1, 0) y listo para usar.");
  }

  clearCurrentScene() {
    if (
      !this.experience ||
      !this.scene ||
      !this.experience.physics ||
      !this.experience.physics.world
    ) {
      console.warn("⚠️ No se puede limpiar: sistema de físicas no disponible.");
      return;
    }

    let visualObjectsRemoved = 0;
    let physicsBodiesRemoved = 0;
    const childrenToRemove = [];
    this.scene.children.forEach((child) => {
      if (child.userData && child.userData.levelObject) {
        childrenToRemove.push(child);
      }
    });
    childrenToRemove.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.scene.remove(child);
      if (child.userData.physicsBody) {
        this.experience.physics.world.removeBody(child.userData.physicsBody);
      }
      visualObjectsRemoved++;
    });
    let physicsBodiesRemaining = -1;
    if (
      this.experience.physics &&
      this.experience.physics.world &&
      Array.isArray(this.experience.physics.bodies)
    ) {
      const survivingBodies = [];
      let bodiesBefore = this.experience.physics.bodies.length;
      this.experience.physics.bodies.forEach((body) => {
        if (body.userData && body.userData.levelObject) {
          this.experience.physics.world.removeBody(body);
          physicsBodiesRemoved++;
        } else {
          survivingBodies.push(body);
        }
      });
      this.experience.physics.bodies = survivingBodies;
      console.log(`🧹 Physics Cleanup Report:`);
      console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
      console.log(
        `🎯 Cuerpos físicos sobrevivientes: ${survivingBodies.length}`
      );
      console.log(
        `📦 Estado inicial: ${bodiesBefore} cuerpos → Estado final: ${survivingBodies.length} cuerpos`
      );
    } else {
      console.warn(
        "⚠️ Physics system no disponible o sin cuerpos activos, omitiendo limpieza física."
      );
    }
    console.log(`🧹 Escena limpiada antes de cargar el nuevo nivel.`);
    console.log(`✅ Objetos 3D eliminados: ${visualObjectsRemoved}`);
    console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
    console.log(
      `🎯 Objetos 3D actuales en escena: ${this.scene.children.length}`
    );
    if (physicsBodiesRemaining !== -1) {
      console.log(
        `🎯 Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`
      );
    }

    if (this.loader && this.loader.prizes.length > 0) {
      this.loader.prizes.forEach((prize) => {
        if (prize.model) {
          this.scene.remove(prize.model);
          if (prize.model.geometry) prize.model.geometry.dispose();
          if (prize.model.material) {
            if (Array.isArray(prize.model.material)) {
              prize.model.material.forEach((mat) => mat.dispose());
            } else {
              prize.model.material.dispose();
            }
          }
        }
      });
      this.loader.prizes = [];
      console.log("🎯 Premios del nivel anterior eliminados correctamente.");
    }

    this.finalPrizeActivated = false;

    // NUEVO: Resetear la lógica del juego
    if (this.gameLogic) {
      this.gameLogic.reset();
    }

    // NUEVO: Limpiar los efectos visuales
    this.fxManager.clearFinalPrizeBeacon();

    // --- ¡NUEVO! ---
    // Detenemos y limpiamos el mixer del portal

    // ---
  }

  resetRobotPosition(spawn = { x: 0, y: 0, z: 0 }) {
    if (!this.robot?.body || !this.robot?.group) return;

    this.robot.body.position.set(spawn.x, spawn.y, spawn.z);
    this.robot.body.velocity.set(0, 0, 0);
    this.robot.body.angularVelocity.set(0, 0, 0);
    this.robot.body.quaternion.setFromEuler(0, 0, 0);

    this.robot.group.position.set(spawn.x, spawn.y, spawn.z);
    this.robot.group.rotation.set(0, 0, 0);
  }

}