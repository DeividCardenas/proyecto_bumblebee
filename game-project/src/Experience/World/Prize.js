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

    // 2. Centramos el modelo clonado
    const bbox = new THREE.Box3().setFromObject(this.model);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    this.model.position.sub(center); // Movemos el modelo para que su centro esté en el (0,0,0) local

    // 3. Añadimos el modelo ya centrado al pivot
    this.pivot.add(this.model);

    // 4. Asignamos la posición final al PIVOT
    this.pivot.position.copy(position);

    // Asignar userData a los hijos
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.userData.interactivo = true;
      }
    });

    // Ejes para depuración
    const helper = new THREE.AxesHelper(0.5);
    this.pivot.add(helper);

    // 5. Añadir el pivot (que contiene el modelo) a la escena
    this.scene.add(this.pivot);

    // Ocultar si es el premio final (World.js lo hará visible si es necesario)
    this.pivot.visible = role !== "finalPrize";

  }

  /**
   * ACTUALIZADO: El método update ahora maneja ambos casos.
   * CRÍTICO: El portal (final_prize) NO debe rotar - permanece completamente estático
   */
  update(delta) {
    if (this.collected) return;

    // ¡IMPORTANTE! El portal final NO debe rotar ni animarse
    // Solo las monedas (role === "default") rotan
    if (this.role === "final_prize") {
      // Portal completamente estático - no hacer nada
      return;
    }

    if (this.mixer) {
      // Si tenemos un mixer (para animaciones), actualizamos el mixer
      this.mixer.update(delta);
    } else {
      // Si no (es una moneda normal), solo giramos el pivot
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

    // --- ¡CAMBIO! Comentamos la limpieza del mixer ---
    // if (this.mixer) {
    //   this.mixer.stopAllAction();
    //   this.mixer = null;
    // }
    // ---

    // Eliminamos el pivot de la escena.
    this.scene.remove(this.pivot);
    
    // (Opcional: Limpieza de memoria)
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
  }
}