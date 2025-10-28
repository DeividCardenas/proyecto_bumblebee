import * as CANNON from "cannon-es";
import * as THREE from "three";
import {
  createBoxShapeFromModel,
  createTrimeshShapeFromModel,
} from "../Experience/Utils/PhysicsShapeFactory.js";
import Prize from "../Experience/World/Prize.js";

export default class ToyCarLoader {
  constructor(experience) {
    this.experience = experience;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.physics = this.experience.physics;
    this.prizes = []; // --- MEJORA: Instanciar una sola vez y cachear texturas ---

    this.textureLoader = new THREE.TextureLoader();
    this.bakedTexture = null; // Caché para la textura 'baked'
  }

  _applyTextureToMeshes(root, imagePath, matcher, options = {}) {
    // Pre-chequeo: buscar meshes objetivo antes de cargar la textura
    const matchedMeshes = [];
    root.traverse((child) => {
      if (child.isMesh && (!matcher || matcher(child))) {
        matchedMeshes.push(child);
      }
    });

    if (matchedMeshes.length === 0) {
      return;
    }

    this.textureLoader.load(
      imagePath,
      (texture) => {
        if ("colorSpace" in texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
        } else {
          texture.encoding = THREE.sRGBEncoding;
        }
        texture.flipY = false;
        const wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
        const wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
        texture.wrapS = wrapS;
        texture.wrapT = wrapT;
        const maxAniso =
          this.experience?.renderer?.instance?.capabilities?.getMaxAnisotropy?.();
        if (typeof maxAniso === "number" && maxAniso > 0) {
          texture.anisotropy = maxAniso;
        }
        const center = options.center || { x: 0.5, y: 0.5 };
        texture.center.set(center.x, center.y);
        if (typeof options.rotation === "number") {
          texture.rotation = options.rotation;
        }
        if (options.repeat) {
          texture.repeat.set(options.repeat.x || 1, options.repeat.y || 1);
        }
        if (options.mirrorX) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.repeat.x = -Math.abs(texture.repeat.x || 1);
          texture.offset.x = 1;
        }
        if (options.mirrorY) {
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.y = -Math.abs(texture.repeat.y || 1);
          texture.offset.y = 1;
        }
        if (options.offset) {
          texture.offset.set(
            options.offset.x ?? texture.offset.x,
            options.offset.y ?? texture.offset.y
          );
        }
        texture.needsUpdate = true;

        let applied = 0;
        matchedMeshes.forEach((child) => {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.map = texture;
              mat.needsUpdate = true;
            });
          } else if (child.material) {
            child.material.map = texture;
            child.material.needsUpdate = true;
          } else {
            child.material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            });
          }
          applied++;
        });

        if (applied > 0) {
          console.log(
            `🖼️ Textura aplicada (${imagePath}) a ${applied} mesh(es)`
          );
        }
      },
      undefined,
      (err) => {
        console.error("❌ Error cargando textura", imagePath, err);
      }
    );
  }

  async loadFromAPI() {
    try {
      const listRes = await fetch("/config/precisePhysicsModels.json");
      const precisePhysicsModels = await listRes.json();
      let blocks = [];
      try {
        const apiUrl = import.meta.env.VITE_API_URL + "/api/blocks";
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Conexión fallida");
        blocks = await res.json();
        console.log("Datos cargados desde la API:", blocks.length);
      } catch {
        console.warn(
          "No se pudo conectar con la API. Cargando desde archivo local..."
        );
        const localRes = await fetch("/data/toy_car_blocks.json");
        const allBlocks = await localRes.json();
        blocks = allBlocks.filter((b) => b.level === 1);
        console.log(
          `Datos cargados desde archivo local (nivel 1): ${blocks.length}`
        );
      }
      this._processBlocks(blocks, precisePhysicsModels);
    } catch (err) {
      console.error("Error al cargar bloques o lista Trimesh:", err);
    }
  }

  async loadFromURL(apiUrl) {
    try {
      const listRes = await fetch("/config/precisePhysicsModels.json");
      const precisePhysicsModels = await listRes.json();

      const res = await fetch(apiUrl);
      if (!res.ok)
        throw new Error("Conexión fallida al cargar bloques de nivel.");

      const data = await res.json();
      const blocks = data.blocks || []; // Asegurarse de que 'blocks' sea un array
      console.log(`📦 Bloques cargados (${blocks.length}) desde ${apiUrl}`);

      this._processBlocks(blocks, precisePhysicsModels);
    } catch (err) {
      console.error("Error al cargar bloques desde URL:", err);
    }
  }

  _processBlocks(blocks, precisePhysicsModels) {
    blocks.forEach((block) => {
      if (!block.name) {
        console.warn("Bloque sin nombre:", block);
        return;
      }

      const resourceKey = block.name;
      const glb = this.resources.items[resourceKey];

      if (!glb) {
        console.warn(`Modelo no encontrado: ${resourceKey}`);
        return;
      }

      const model = glb.scene.clone();
      model.userData.levelObject = true;

      model.traverse((child) => {
        if (child.isCamera || child.isLight) {
          child.parent.remove(child);
        }
      });

      this._applyTextureToMeshes(
        model,
        "/textures/ima1.jpg",
        (child) =>
          child.name === "Cylinder001" ||
          (child.name && child.name.toLowerCase().includes("cylinder")),
        { rotation: -Math.PI / 2, center: { x: 0.5, y: 0.5 }, mirrorX: true }
      ); // --- MEJORA: Caching de textura 'baked' ---

      if (block.name.includes("baked")) {
        if (!this.bakedTexture) {
          console.log('🔥 Cargando textura "baked" por primera vez...');
          this.bakedTexture = this.textureLoader.load("/textures/baked.jpg");
          this.bakedTexture.flipY = false;
          if ("colorSpace" in this.bakedTexture) {
            this.bakedTexture.colorSpace = THREE.SRGBColorSpace;
          } else {
            this.bakedTexture.encoding = THREE.sRGBEncoding;
          }
        }

        model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({
              map: this.bakedTexture,
            });
            child.material.needsUpdate = true;
            if (child.name.toLowerCase().includes("portal")) {
              this.experience.time.on("tick", () => {
                child.rotation.y += 0.01;
              });
            }
          }
        });
      } // --- FIN DE LA MEJORA ---

      // --- INICIO DE LA CORRECCIÓN CRÍTICA ---
      const isPrize =
        (block.role === "default" &&
          block.name.startsWith("circle_material_")) ||
        block.role === "final_prize" ||
        block.name.startsWith("coin");

      if (isPrize) {
        // Es un premio (moneda)
        const prizeRole =
          block.role ||
          (block.name.includes("final") ? "final_prize" : "default");
        const prize = new Prize({
          model,
          position: new THREE.Vector3(block.x, block.y, block.z),
          scene: this.scene,
          role: prizeRole,
        });

        prize.pivot.userData.levelObject = true;
        this.prizes.push(prize); // Salimos para no crearle un cuerpo físico
        return; // Importante: No continuar para no crearle físicas
      } // --- FIN DE LA CORRECCIÓN ---

      // Si no es un premio, añade el modelo a la escena y crea físicas
      this.scene.add(model);

      // --- Físicas ---
      let shape;
      let position = new THREE.Vector3();
      const nameLower = (block.name || '').toLowerCase();
      // Considerar como PISO por nombre (niveles 1-2 usan una plataforma grande)
      const floorNameHints = [
        'floortile', 'rooftile', 'floor', 'ground', 'platform', 'plataforma',
        'base', 'pavement', 'road', 'street', 'walk', 'walkway', 'plane',
        'groundplane', 'suelo', 'piso'
      ];
      let isFloorTile = floorNameHints.some(h => nameLower.includes(h));

      // Heurística adicional: si el modelo es delgado en Y en relación a XZ, tratar como piso
      const bboxProbe = new THREE.Box3().setFromObject(model);
      const probeSize = new THREE.Vector3();
      bboxProbe.getSize(probeSize);
      const minXZ = Math.min(probeSize.x, probeSize.z);
      const thinThreshold = Math.max(0.6, minXZ * 0.12);
      const isThinY = probeSize.y <= thinThreshold;
      if (!isFloorTile && isThinY) isFloorTile = true;

      // Fuerza colision simple (caja) para pisos, aunque estén listados como 'precise'
      if (precisePhysicsModels.includes(block.name) && !isFloorTile) {
        shape = createTrimeshShapeFromModel(model);
        if (!shape) {
          console.warn(`No se pudo crear Trimesh para ${block.name}`);
          return;
        }
        position.set(0, 0, 0); // Trimesh usa la posición del modelo
      } else {
        // Usar BoxShape por defecto (para piso casi exacta; para otros con padding)
        const scaleFactor = isFloorTile ? 0.98 : 0.9;
        shape = createBoxShapeFromModel(model, scaleFactor);
        const bbox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);
        // Apoyar la caja en la base del modelo (evita dejar huecos que generen caídas)
        center.y -= size.y / 2;
        position.copy(center);
      }

      const body = new CANNON.Body({
        mass: 0, // Estático
        shape: shape,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        // Si es piso, usa material de piso para tener más agarre y estabilidad
        material: isFloorTile ? this.physics.floorMaterial : this.physics.obstacleMaterial,
      });

      body.userData = { levelObject: true };
      model.userData.physicsBody = body; // Vincular modelo al cuerpo
      body.userData.linkedModel = model; // Vincular cuerpo al modelo
      this.physics.world.addBody(body);
    });
  }
}
