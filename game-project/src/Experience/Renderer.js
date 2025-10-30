import * as THREE from 'three'

export default class Renderer {
    constructor(experience) {
        this.experience = experience
        this.canvas = this.experience.canvas
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.camera = this.experience.camera

        this.setInstance()
    }

    setInstance() {
        // Detectar dispositivo móvil para optimizar rendimiento
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

        this.instance = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: !isMobile, // Desactivar antialiasing en móviles para mejor rendimiento
            powerPreference: isMobile ? 'low-power' : 'high-performance'
        })

        this.instance.shadowMap.enabled = true
        this.instance.setSize(this.sizes.width, this.sizes.height)

        // Limitar pixelRatio en móviles para mejor rendimiento
        const maxPixelRatio = isMobile ? 2 : this.sizes.pixelRatio
        this.instance.setPixelRatio(Math.min(maxPixelRatio, this.sizes.pixelRatio))

        this.instance.outputEncoding = THREE.sRGBEncoding;
        this.instance.toneMapping = THREE.ACESFilmicToneMapping;
        this.instance.toneMappingExposure = 1.3;
        this.instance.setClearColor('#fdeac7');

    }

    resize() {
        this.instance.setSize(this.sizes.width, this.sizes.height)
        this.instance.setPixelRatio(this.sizes.pixelRatio)
    }

    update() {
        this.instance.render(this.scene, this.camera.instance)
    }
}
