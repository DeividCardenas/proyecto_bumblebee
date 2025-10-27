// Experience/Utils/FXManager.js
import * as THREE from "three";
import FinalPrizeParticles from "./FinalPrizeParticles.js";

export default class FXManager {
  constructor(scene, experience) {
    this.scene = scene;
    this.experience = experience;
    this.discoRaysGroup = null;
  }

  /**
   * Muestra el faro de luz y las partículas para el premio final.
   */
  showFinalPrizeBeacon(targetPosition, sourcePosition) {
    // 1. Limpia cualquier efecto anterior
    this.clearFinalPrizeBeacon();

    // 2. Partículas
    new FinalPrizeParticles({
      scene: this.scene,
      targetPosition: targetPosition,
      sourcePosition: sourcePosition,
      experience: this.experience,
    });

    // 3. Faro de luz ("discoRays")
    this.discoRaysGroup = new THREE.Group();
    this.scene.add(this.discoRaysGroup);

    const rayMaterial = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });

    const rayCount = 4;
    for (let i = 0; i < rayCount; i++) {
      const cone = new THREE.ConeGeometry(0.2, 4, 6, 1, true);
      const ray = new THREE.Mesh(cone, rayMaterial);

      ray.position.set(0, 2, 0);
      ray.rotation.x = Math.PI / 2;
      ray.rotation.z = (i * Math.PI * 2) / rayCount;

      const spot = new THREE.SpotLight(0xaa00ff, 2, 12, Math.PI / 7, 0.2, 0.5);
      spot.castShadow = false;
      spot.shadow.mapSize.set(1, 1);
      spot.position.copy(ray.position);
      spot.target.position.set(
        Math.cos(ray.rotation.z) * 10,
        2,
        Math.sin(ray.rotation.z) * 10
      );

      ray.userData.spot = spot;
      this.discoRaysGroup.add(ray);
      this.discoRaysGroup.add(spot);
      this.discoRaysGroup.add(spot.target);
    }

    this.discoRaysGroup.position.copy(targetPosition);
  }

  /**
   * Limpia y elimina los efectos del premio final.
   */
  clearFinalPrizeBeacon() {
    if (this.discoRaysGroup) {
      this.discoRaysGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.scene.remove(this.discoRaysGroup);
      this.discoRaysGroup = null;
    }
  }

  /**
   * Actualiza los efectos (ej. rotación del faro)
   */
  update(delta) {
    if (this.discoRaysGroup) {
      this.discoRaysGroup.rotation.y += delta * 0.5;
    }
  }
}