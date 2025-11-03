import * as THREE from "three";

export default class Prize {
  /**
   * Constructor de la clase Prize.
   * @param {Object} options
   * @param {THREE.Object3D} options.model - El modelo 3D (clonado) para el premio.
   * @param {THREE.Vector3} options.position - La posición en el mundo.
   * @param {THREE.Scene} options.scene - La escena principal.
   * @param {string} [options.role="default"] - El rol del premio ('default' o 'final_prize').
   * @param {Audio} [options.sound=null] - El sonido a reproducir al recolectar.
   */
  constructor({ model, position, scene, role = "default", sound = null,  }) {
    this.scene = scene;
    this.collected = false;
    this.role = role;
    this.sound = sound;

    /**
     * El 'pivot' es el objeto principal.
     * Su posición (this.pivot.position) es el centro exacto
     * que usará World.js para medir la distancia.
     */
    this.pivot = new THREE.Group();
    this.pivot.userData.interactivo = true;
    this.pivot.userData.collected = false;

    // 1. Asignamos el modelo (ya no lo clonamos, asumimos que viene clonado)
    this.model = model;

    // 2. Centramos el modelo SOLO si NO es el portal final
    // El portal ya viene bien posicionado y centrarlo es muy costoso
    if (this.role !== "final_prize") {
      try {
        const bbox = new THREE.Box3().setFromObject(this.model);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        this.model.position.sub(center);
      } catch (error) {
        // Si falla, dejamos el modelo en su posición original
        // No hacer nada - el modelo se renderiza en su posición original
      }
    }

    // 3. Añadimos el modelo al pivot
    this.pivot.add(this.model);

    // 4. Asignamos la posición final al PIVOT
    this.pivot.position.copy(position);

    // Asignar userData a los hijos (solo si no es el portal para evitar costo)
    if (this.role !== "final_prize") {
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.userData.interactivo = true;
        }
      });

      // Ejes para depuración (solo para premios normales)
      const helper = new THREE.AxesHelper(0.5);
      this.pivot.add(helper);
    } else {
      // Para el portal: OPTIMIZACIÓN EXTREMA
      // El modelo ya está configurado en World.js
      this.pivot.userData.interactivo = true;
      this.pivot.userData.isPortal = true; // Marcador especial
    }

    // 5. Añadir el pivot (que contiene el modelo) a la escena
    this.scene.add(this.pivot);

    // Ocultar si es el premio final (World.js lo hará visible si es necesario)
    this.pivot.visible = role !== "finalPrize";

  }

  /**
   * ACTUALIZADO: El método update ahora maneja ambos casos.
   * CRÍTICO: El portal (final_prize) NO debe hacer NADA - completamente estático
   */
  update(delta) {
    // Si está recolectado, no hacer nada
    if (this.collected) return;

    // ¡IMPORTANTE! El portal final es completamente estático
    // Retornar inmediatamente para evitar cualquier procesamiento
    if (this.role === "final_prize") {
      return;
    }

    // Solo las monedas (role === "default") pueden tener animaciones o rotaciones
    if (this.mixer) {
      // Si tenemos un mixer (para animaciones), actualizamos el mixer
      this.mixer.update(delta);
    } else {
      // Monedas normales: rotar el pivot
      this.pivot.rotation.y += delta * 1.5;
    }
  }

  collect() {
    if (this.collected) return;

    this.collected = true;
    this.pivot.userData.collected = true;

    if (this.sound && typeof this.sound.play === "function") {
      this.sound.play();
    }

    // Limpieza del mixer si existe
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    // Eliminamos el pivot de la escena.
    this.scene.remove(this.pivot);
    
    // Limpieza profunda de memoria
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}