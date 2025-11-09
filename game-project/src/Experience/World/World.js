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
import BossEnemy from "./BossEnemy.js";
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

      // Enemigos múltiples: spawn basado en configuración del nivel
      this.enemyTemplate = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );

      // Obtener cantidad de enemigos desde GameConfig (nivel 1 por defecto)
      const enemiesCount = GAME_CONFIG.enemy.spawnCount[1] || 0;
      logger.info('🎮', `Spawneando ${enemiesCount} enemigos para nivel 1 desde GameConfig`);

      // Spawn inicial para nivel 1
      this.spawnEnemies(enemiesCount, 1);

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

  /**
   * Crear varios enemigos en posiciones alejadas del jugador
   * @param {number} count - Número de enemigos a spawnear
   * @param {number} level - Nivel actual (determina el tipo de enemigo)
   *   - Niveles 1-2: Decepticon_Soldier (Enemy)
   *   - Nivel 3: Shockwave (BossEnemy)
   */
  spawnEnemies(count = 0, level = 1) {
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

    // Determinar tipo de enemigo basado en el nivel
    const isBossLevel = level >= 3;
    const EnemyClass = isBossLevel ? BossEnemy : Enemy;
    const enemyType = isBossLevel ? "Boss (Shockwave)" : "Normal (Decepticon)";

    logger.info('👹', `Spawneando ${count} enemigos tipo ${enemyType} para nivel ${level}`);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;
      const y = 1.5;

      const enemy = new EnemyClass({
        experience: this.experience,
        playerRef: this.robot,
        position: new THREE.Vector3(x, y, z),
      });

      // Pequeño delay para que no ataquen todos a la vez
      enemy.delayActivation = 1.0 + i * config.delayBetween;
      this.enemies.push(enemy);
    }

    logger.debug(`✅ ${count} enemigos tipo ${enemyType} spawneados correctamente`);
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

    // Animar el portal si está activo
    if (this.portalPrize && this.finalPrizeActivated) {
      // Rotar el portal lentamente
      if (this.portalPrize.pivot) {
        this.portalPrize.pivot.rotation.y += delta * 0.3;
      }
    }

    // Animar partículas del portal
    if (this.portalParticles && this.portalParticlesOriginalPositions) {
      this.portalParticlesTime += delta;
      const positions = this.portalParticles.geometry.attributes.position.array;

      for (let i = 0; i < positions.length / 3; i++) {
        const i3 = i * 3;
        const originalX = this.portalParticlesOriginalPositions[i3];
        const originalY = this.portalParticlesOriginalPositions[i3 + 1];
        const originalZ = this.portalParticlesOriginalPositions[i3 + 2];

        // Movimiento en espiral ascendente
        const angle = this.portalParticlesTime + i * 0.1;
        const radius = 0.2;

        positions[i3] = originalX + Math.cos(angle) * radius;
        positions[i3 + 1] = originalY + Math.sin(this.portalParticlesTime * 2 + i * 0.5) * 0.2;
        positions[i3 + 2] = originalZ + Math.sin(angle) * radius;
      }

      this.portalParticles.geometry.attributes.position.needsUpdate = true;

      // Rotar el sistema de partículas
      this.portalParticles.rotation.y += delta * 0.5;
    }

    // Animar luz del portal (efecto de pulso)
    if (this.portalLight) {
      this.portalLightPulse += delta * 3;
      const pulse = Math.sin(this.portalLightPulse) * 0.5 + 1.5;
      this.portalLight.intensity = pulse;
    }

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
        const apiData = await res.json();

        // Si la API devuelve un array vacío, usar archivo local
        if (!apiData || (Array.isArray(apiData) && apiData.length === 0)) {
          throw new Error("API devolvió datos vacíos");
        }

        data = apiData;
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

        // Seleccionar el archivo correcto según el nivel
        const levelFiles = {
          1: "data/toy_car_blocks.json",
          2: "data/toy_car_blocks2.json",
          3: "data/toy_car_blocks3.json"
        };
        const localUrl = publicPath(levelFiles[level] || "data/toy_car_blocks.json");
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

      // Respawnear enemigos apropiados para el nivel desde GameConfig
      const enemiesCount = GAME_CONFIG.enemy.spawnCount[level] || 0;

      if (enemiesCount > 0) {
        logger.info('🎮', `Nivel ${level}: spawneando ${enemiesCount} enemigos desde GameConfig`);
        this.spawnEnemies(enemiesCount, level);
      } else {
        logger.info('🎮', `Nivel ${level}: sin enemigos configurados`);
      }

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
        // NO congelar para permitir rotación del portal
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

    // Escalar el portal (NO congelar para permitir animación)
    portalModel.scale.set(1.5, 1.5, 1.5);

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

    // NO congelar el pivot para permitir animación
    finalPortalPrize.pivot.position.copy(portalPosition);

    // 6. Añadir al array de premios
    if (!this.loader || !this.loader.prizes) {
       logger.error("this.loader.prizes no está listo.");
       return;
    }

    this.loader.prizes = this.loader.prizes.filter(p => p.role !== 'final_prize');
    this.loader.prizes.push(finalPortalPrize);

    this.finalPrizeActivated = true;

    // =================================================================
    // 7. EFECTOS VISUALES Y SONIDO DEL PORTAL
    // =================================================================

    // Reproducir sonido del portal
    if (this.portalSound && typeof this.portalSound.play === "function") {
      this.portalSound.play();
      logger.info('🔊', 'Sonido del portal reproducido');
    }

    // Guardar referencia al portal para animarlo
    this.portalPrize = finalPortalPrize;

    // Crear partículas alrededor del portal
    this.createPortalParticles(portalPosition);

    // Crear luz pulsante en el portal
    const portalLight = new THREE.PointLight(0x00ffff, 2, 20);
    portalLight.position.copy(portalPosition);
    this.scene.add(portalLight);

    // Guardar referencia a la luz
    this.portalLight = portalLight;
    this.portalLightIntensity = 2;
    this.portalLightPulse = 0;

    logger.info('✅', `Portal creado en (${portalPosition.x}, ${portalPosition.y}, ${portalPosition.z}) con efectos visuales`);
    logger.info('🌟', 'Portal con partículas, luz pulsante y sonido activados');
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

    // Limpiar efectos del portal
    if (this.portalParticles) {
      this.scene.remove(this.portalParticles);
      this.portalParticles.geometry.dispose();
      this.portalParticles.material.dispose();
      this.portalParticles = null;
      this.portalParticlesOriginalPositions = null;
    }

    if (this.portalLight) {
      this.scene.remove(this.portalLight);
      this.portalLight = null;
    }

    this.portalPrize = null;

    // NUEVO: Resetear la lógica del juego
    if (this.gameLogic) {
      this.gameLogic.reset();
    }

    // NUEVO: Limpiar los efectos visuales
    this.fxManager.clearFinalPrizeBeacon();
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

  /**
   * Crear sistema de partículas alrededor del portal
   */
  createPortalParticles(portalPosition) {
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Inicializar posiciones y colores de partículas
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Posiciones aleatorias en forma de espiral alrededor del portal
      const angle = (i / particleCount) * Math.PI * 4;
      const radius = 2 + Math.random() * 1;
      const height = Math.random() * 4 - 2;

      positions[i3] = portalPosition.x + Math.cos(angle) * radius;
      positions[i3 + 1] = portalPosition.y + height;
      positions[i3 + 2] = portalPosition.z + Math.sin(angle) * radius;

      // Colores cyan/azul brillante
      colors[i3] = 0.0 + Math.random() * 0.3;     // R
      colors[i3 + 1] = 0.8 + Math.random() * 0.2; // G (cyan)
      colors[i3 + 2] = 1.0;                       // B
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    this.portalParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.portalParticles);

    // Guardar posición inicial y datos para animación
    this.portalParticlesTime = 0;
    this.portalParticlesOriginalPositions = positions.slice();
    this.portalParticlesPosition = portalPosition;

    logger.info('✨', 'Sistema de partículas del portal creado');
  }

}