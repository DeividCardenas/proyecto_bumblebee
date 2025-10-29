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
    // ... (Esta función está perfecta, no se necesita ningún cambio) ...
    // [Tu código original de _applyTextureToMeshes va aquí]
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
      
      // --- ¡CORRECCIÓN 1! ---
      // Ahora debemos esperar (await) a que _processBlocks termine.
      await this._processBlocks(blocks, precisePhysicsModels);

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
      
      // --- ¡CORRECCIÓN 2! ---
      // También debemos esperar (await) aquí.
      await this._processBlocks(blocks, precisePhysicsModels);

    } catch (err) {
      console.error("Error al cargar bloques desde URL:", err);
    }
  }

  // --- ¡CORRECCIÓN 3! ---
  // Convertimos _processBlocks en una función que devuelve una Promesa,
  // para que 'await' realmente funcione.
  _processBlocks(blocks, precisePhysicsModels) {
    return new Promise((resolve, reject) => {
      try {
        blocks.forEach((block) => {
          if (!block.name) {
            console.warn("Bloque sin nombre:", block);
            return; // Continúa con el siguiente bloque
          }

          const resourceKey = block.name;
          const glb = this.resources.items[resourceKey];

          if (!glb) {
            console.warn(`Modelo no encontrado: ${resourceKey}`);
            return; // Continúa
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
          );

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
                    child.rotation.y += 0.00;
                  });
                }
              }
            });
          }

          // Lógica de detección de premios
          if (block.name.startsWith("circle_material_")) {
            const prizeRole = block.role || "default";
            const prize = new Prize({
              model,
              // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
              position: new THREE.Vector3(block.x, block.y, block.z), // <-- ¡CORREGIDO! (era block.ax)
              // --- FIN DE LA CORRECCIÓN ---
              scene: this.scene,
              role: prizeRole,
            });
            prize.pivot.userData.levelObject = true;
            this.prizes.push(prize);
            return; // No crearle físicas
          }

          if (block.role === "final_prize") {
            const prize = new Prize({
              model,
              position: new THREE.Vector3(block.x, block.y, block.z),
              scene: this.scene,
              role: "final_prize",
            });
            prize.pivot.userData.levelObject = true;
            this.prizes.push(prize);
            return; // No crearle físicas
          }
          
          // Si no es un premio, añade el modelo a la escena y crea físicas
          this.scene.add(model);

          // --- Físicas (Sin cambios) ---
          let shape;
          let position = new THREE.Vector3();
          const nameLower = (block.name || "").toLowerCase();
          const floorNameHints = [
            "floortile", "rooftile", "floor", "ground", "platform", "plataforma",
            "base", "pavement", "road", "street", "walk", "walkway", "plane",
            "groundplane", "suelo", "piso",
          ];
          let isFloorTile = floorNameHints.some((h) => nameLower.includes(h));
          const bboxProbe = new THREE.Box3().setFromObject(model);
          const probeSize = new THREE.Vector3();
          bboxProbe.getSize(probeSize);
          const minXZ = Math.min(probeSize.x, probeSize.z);
          const thinThreshold = Math.max(0.6, minXZ * 0.12);
          const isThinY = probeSize.y <= thinThreshold;
          if (!isFloorTile && isThinY) isFloorTile = true;
          if (precisePhysicsModels.includes(block.name) && !isFloorTile) {
            shape = createTrimeshShapeFromModel(model);
            if (!shape) {
              console.warn(`No se pudo crear Trimesh para ${block.name}`);
              return;
            }
            position.set(0, 0, 0);
          } else {
            const scaleFactor = isFloorTile ? 0.98 : 0.9;
            shape = createBoxShapeFromModel(model, scaleFactor);
            const bbox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bbox.getCenter(center);
            bbox.getSize(size);
            center.y -= size.y / 2;
            position.copy(center);
          }
          const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: isFloorTile
              ? this.physics.floorMaterial
              : this.physics.obstacleMaterial,
          });
          body.userData = { levelObject: true };
          model.userData.physicsBody = body;
          body.userData.linkedModel = model;
          this.physics.world.addBody(body);
        }); // Fin de blocks.forEach

        // ¡Importante! Resuelve la promesa DESPUÉS de que el bucle termine.
        resolve();

      } catch (error) {
        console.error("❌ Error fatal dentro de _processBlocks", error);
        reject(error);
      }
    });
  }
}