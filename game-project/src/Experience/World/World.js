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
import { GAME_CONFIG } from "../../config/GameConfig.js";
import { FEATURES } from "../../config/FeatureFlags.js";
import logger from "../../utils/Logger.js";

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

    // --- CACHE DE OBJETOS FÍSICOS PARA OPTIMIZACIÓN ---
    // Reemplaza scene.traverse() en el loop de update
    this.levelObjects = [];

    this.finalPrizeActivated = false;
    this.gameStarted = false;
    this.enemies = [];

    logger.info('🌍', 'World inicializado');

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
        logger.warn(
          "¡Advertencia (Nivel 1)! No se encontraron premios con 'role: \"default\"'."
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
        logger.error(
          "Sistema de físicas no está inicializado al cargar el mundo."
        );
        return;
      }
    });
  }

  // Crear varios enemigos en posiciones alejadas del jugador para evitar atascos iniciales
  spawnEnemies(count = 0) {
    if (!this.robot?.body?.position) return;
    const playerPos = this.robot.body.position;
    const config = GAME_CONFIG.enemy.spawn;
    const minRadius = config.minRadius;
    const maxRadius = config.maxRadius;

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
      enemy.delayActivation = 1.0 + i * config.delayBetween;
      this.enemies.push(enemy);
    }
    logger.debug(`${count} enemigos spawneados`);
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
      this.experience.isThirdPerson
    ) {
      this.thirdPersonCamera.update();
    }

    // Actualizar rotación de premios (esto se queda)
    this.loader?.prizes?.forEach((p) => p.update(delta));

    // ===================================
    // OPTIMIZACIÓN FÍSICA POR DISTANCIA (CRÍTICO)
    // Usa cache en lugar de scene.traverse() - 50-70% más rápido
    // ===================================
    if (FEATURES.PHYSICS_DISTANCE_OPTIMIZATION && this.levelObjects.length > 0) {
      const playerPos = this.robot?.body?.position;

      if (playerPos) {
        const optimizationRadius = GAME_CONFIG.gameplay.physicsOptimizationRadius;

        // Iterar sobre el cache (mucho más rápido que scene.traverse)
        this.levelObjects.forEach(({ mesh, body }) => {
          const dist = mesh.position.distanceTo(playerPos);
          const shouldEnable = dist < optimizationRadius && mesh.visible;

          if (shouldEnable && !body.enabled) {
            body.enabled = true;
          } else if (!shouldEnable && body.enabled) {
            body.enabled = false;
          }
        });
      }
    }
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
        logger.info('📦', `Datos del nivel ${level} cargados desde API`);
      } catch (error) {
        logger.warn(
          `No se pudo conectar con el backend (${error.message}). Usando datos locales para nivel ${level}...`
        );
        const publicPath = (p) => {
          const base = import.meta.env.BASE_URL || "/";
          return `${base.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
        };

        logger.debug("¿Tienen 'role' los premios?", this.loader.prizes);

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
        logger.warn(
          "¡Advertencia! No se encontraron premios con 'role: \"default\"'. El contador de premios del nivel es 0."
        );
      }
      this.levelManager.setLevelPrizeCount(defaultPrizeCount);

      if (this.gameLogic) {
        this.gameLogic.reset();
      }

      this.resetRobotPosition(spawnPoint);
      logger.info('✅', `Nivel ${level} cargado con spawn en (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z})`);
    } catch (error) {
      logger.error("Error cargando nivel:", error);
    }
  }

showFinalPrize() {
    if (this.finalPrizeActivated) return;
    logger.info('🔥', 'Creando Portal ULTRA-SIMPLIFICADO (sin animaciones, sonidos ni efectos)...');

    // 1. Obtener el recurso GLTF del portal
    const portalResource = this.resources.items.Portal;
    if (!portalResource || !portalResource.scene) {
      logger.error("No se encontró el recurso 'Portal'. Revisa tu 'sources.js'.");
      return;
    }

    // 2. Clonar el modelo
    const portalModel = portalResource.scene.clone();
    const portalPosition = new THREE.Vector3(0, 1.5, -15);

    // =================================================================
    // 3. ULTRA-SIMPLIFICACIÓN: Eliminar TODO lo innecesario
    // =================================================================
    logger.info('🔧', 'Aplicando ultra-simplificación al portal...');

    portalModel.traverse((child) => {
      child.visible = true;
      child.userData.ignoreCamera = true;

      // ========================================
      // CRÍTICO: ELIMINAR ANIMACIONES Y BONES
      // ========================================
      if (child.isSkinnedMesh) {
        logger.debug('🔧', `Convirtiendo SkinnedMesh "${child.name}" a Mesh estático`);

        // Destruir skeleton completamente
        if (child.skeleton) {
          child.skeleton.dispose();
          child.skeleton = null;
        }

        // Convertir a Mesh normal (sin animación)
        child.type = 'Mesh';
        child.isSkinnedMesh = false;

        // Eliminar binding de skeleton
        if (child.bindMatrix) child.bindMatrix = null;
        if (child.bindMatrixInverse) child.bindMatrixInverse = null;
      }

      // Destruir bones completamente
      if (child.isBone) {
        logger.debug('🔧', `Eliminando bone: ${child.name}`);
        if (child.parent) {
          child.parent.remove(child);
        }
        return;
      }

      if (child.isMesh) {
        // Congelar transformaciones para optimizar
        child.matrixAutoUpdate = false;
        child.updateMatrix();
        child.frustumCulled = true;

        // Calcular bounding box/sphere para optimización
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }

        // ========================================
        // ELIMINAR MATERIALES ANIMADOS/EMISSIVE
        // ========================================
        if (child.material) {
          // Desactivar needsUpdate en texturas
          if (child.material.map) {
            child.material.map.needsUpdate = false;
          }

          // Desactivar emisión (los rayos morados animados del profesor)
          if (child.material.emissive) {
            child.material.emissive.set(0x000000); // Negro = sin emisión
          }
          if (child.material.emissiveIntensity !== undefined) {
            child.material.emissiveIntensity = 0;
          }

          // Desactivar mapas emissive si existen
          if (child.material.emissiveMap) {
            child.material.emissiveMap = null;
          }

          child.material.needsUpdate = true;
        }
      }
    });

    // Limpiar bones del array de children (importante)
    portalModel.children = portalModel.children.filter(child => !child.isBone);

    // Escalar y congelar el portal
    portalModel.scale.set(1.5, 1.5, 1.5);
    portalModel.matrixAutoUpdate = false;
    portalModel.updateMatrix();

    logger.info('✅', 'Portal ultra-simplificado: SkinnedMesh → Mesh, bones eliminados, emissive desactivado');

    // 4. Crear instancia de Prize (SIN animaciones)
    const finalPortalPrize = new Prize({
      model: portalModel,
      position: portalPosition,
      scene: this.scene,
      role: "final_prize",
      // ¡CRÍTICO! NO pasar animations - evita crear AnimationMixer
      // animations: portalResource.animations // <-- NUNCA DESCOMENTAR
    });

    // 5. Configurar el premio
    finalPortalPrize.pivot.visible = true;
    finalPortalPrize.pivot.userData.ignoreCamera = true;

    // Congelar el pivot también
    finalPortalPrize.pivot.matrixAutoUpdate = false;
    finalPortalPrize.pivot.position.copy(portalPosition);
    finalPortalPrize.pivot.updateMatrix();

    // 6. Añadir al array de premios
    if (!this.loader || !this.loader.prizes) {
       logger.error("this.loader.prizes no está listo.");
       return;
    }

    this.loader.prizes = this.loader.prizes.filter(p => p.role !== 'final_prize');
    this.loader.prizes.push(finalPortalPrize);

    this.finalPrizeActivated = true;

    // =================================================================
    // 7. SIN EFECTOS VISUALES NI SONIDOS (ULTRA-SIMPLIFICADO)
    // =================================================================
    // NO activar FXManager (faro de luz) - DESACTIVADO PARA SIMPLIFICAR
    // NO reproducir sonido del portal - DESACTIVADO PARA SIMPLIFICAR

    logger.info('✅', `Portal SIMPLE creado en (${portalPosition.x}, ${portalPosition.y}, ${portalPosition.z})`);
    logger.info('ℹ️', 'Portal sin animaciones, sin sonidos, sin efectos - MODO ULTRA-BÁSICO');
    logger.info('ℹ️', `Radio de colección: ${GAME_CONFIG.gameplay.portalCollectionDistance} unidades`);
  }

  clearCurrentScene() {
    if (
      !this.experience ||
      !this.scene ||
      !this.experience.physics ||
      !this.experience.physics.world
    ) {
      logger.warn("No se puede limpiar: sistema de físicas no disponible.");
      return;
    }

    // Limpiar cache de objetos físicos
    this.levelObjects = [];
    logger.debug('Cache de objetos físicos limpiado');

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
      logger.group('🧹 Physics Cleanup Report', () => {
        logger.log(`Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
        logger.log(`Cuerpos físicos sobrevivientes: ${survivingBodies.length}`);
        logger.log(`Estado: ${bodiesBefore} → ${survivingBodies.length} cuerpos`);
      });
    } else {
      logger.warn(
        "Physics system no disponible o sin cuerpos activos, omitiendo limpieza física."
      );
    }
    logger.info('🧹', `Escena limpiada. Objetos eliminados: ${visualObjectsRemoved}, Cuerpos físicos: ${physicsBodiesRemoved}`);
    if (physicsBodiesRemaining !== -1) {
      logger.debug(`Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`);
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
      logger.debug("Premios del nivel anterior eliminados correctamente.");
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