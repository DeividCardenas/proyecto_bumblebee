import * as THREE from "three";

export default class Prize {
  constructor({ model, position, scene, role = "default", sound = null }) {
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
    this.pivot.userData.collected = false; // 1. Clonamos el modelo original

    this.model = model.clone(); // 2. Centramos el modelo clonado

    const bbox = new THREE.Box3().setFromObject(this.model);
    const center = new THREE.Vector3();
    bbox.getCenter(center); // Movemos el modelo para que su centro esté en el (0,0,0) local
    this.model.position.sub(center); // 3. Añadimos el modelo ya centrado al pivot

    this.pivot.add(this.model); // 4. Asignamos la posición final al PIVOT

    this.pivot.position.copy(position); // Asignar userData a los hijos (útil para raycasting si lo usaras)

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.userData.interactivo = true;
      }
    }); // Ejes para depuración: Deben aparecer justo en el centro de la moneda

    const helper = new THREE.AxesHelper(0.5);
    this.pivot.add(helper); // 5. Añadir el pivot (que contiene el modelo) a la escena

    this.scene.add(this.pivot); // Ocultar si es el premio final
    this.pivot.visible = role !== "finalPrize"; // (Opcional: puedes descomentar esto para depurar, pero genera mucho log) // console.log(`🎯 Premio en: (${position.x}, ${position.y}, ${position.z}) [role: ${this.role}]`)
  }

  update(delta) {
    if (this.collected) return; // El pivot gira, y el modelo (que está dentro) gira con él
    this.pivot.rotation.y += delta * 1.5;
  }

  collect() {
    if (this.collected) return;

    this.collected = true;
    this.pivot.userData.collected = true;

    if (this.sound && typeof this.sound.play === "function") {
      this.sound.play();
    } // Eliminamos el pivot de la escena. // (No es necesario recorrer los hijos, al eliminar el padre se van todos)
    this.scene.remove(this.pivot); // (Opcional: Limpieza de memoria si tienes muchas monedas)
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
  }
}
