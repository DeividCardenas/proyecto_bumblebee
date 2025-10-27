import * as THREE from 'three'

export default class ThirdPersonCamera {
    /**
     * @param {object} experience El objeto principal de la experiencia
     * @param {THREE.Group} targetGroup El "group" del robot que debe seguir
     */
    constructor(experience, targetGroup) {
        this.experience = experience
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas
        
        // 1. Obtenemos la cámara principal (la que renderiza la escena)
        this.cameraInstance = this.experience.camera.instance 

        // 2. Asignamos el objetivo a seguir
        this.target = targetGroup 

        // --- Configuración de la cámara ---
        // Qué tan lejos/arriba del robot debe estar
        this.idealOffset = new THREE.Vector3(0, 4, -8) // (x: 0, y: 4, z: -8) -> Detrás y arriba

        // A qué parte del robot mirar (un poco arriba de sus pies)
        this.idealLookAt = new THREE.Vector3(0, 1, 0)
        
        // --- Estado de la cámara (para suavizado) ---
        this.currentPosition = new THREE.Vector3()
        this.currentLookAt = new THREE.Vector3()
        this.rotationQuaternion = new THREE.Quaternion()
        this.lerpFactor = 0.05 // Factor de suavizado (más bajo = más suave)

        // --- Estado del ratón ---
        this.isMouseDown = false
        this.lastMouseX = 0
        this.rotationSpeed = 1.0 // Velocidad de rotación con el mouse

        this.setMouseListeners()

        // Inicializar la posición de la cámara para que no salte al inicio
        const initialPos = this.idealOffset.clone().add(this.target.position)
        this.currentPosition.copy(initialPos)
        this.cameraInstance.position.copy(initialPos)

        const initialLookAt = this.idealLookAt.clone().add(this.target.position)
        this.currentLookAt.copy(initialLookAt)
        this.cameraInstance.lookAt(initialLookAt)
    }

    /**
     * Configura los listeners del mouse en el canvas
     */
    setMouseListeners() {
        this.onMouseDown = (e) => this.handleMouseDown(e)
        this.onMouseUp = (e) => this.handleMouseUp(e)
        this.onMouseMove = (e) => this.handleMouseMove(e)

        this.canvas.addEventListener('mousedown', this.onMouseDown)
        this.canvas.addEventListener('mouseup', this.onMouseUp)
        this.canvas.addEventListener('mousemove', this.onMouseMove)
        
        // Prevenir el menú contextual al hacer clic derecho
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    }
    
    handleMouseDown(event) {
        // Clic izquierdo (0) o derecho (2)
        if (event.button === 0 || event.button === 2) { 
            this.isMouseDown = true
            this.lastMouseX = event.clientX
        }
    }

    handleMouseUp() {
        this.isMouseDown = false
    }

    handleMouseMove(event) {
        // Solo rotar si el mouse está presionado y tenemos un objetivo
        if (!this.isMouseDown || !this.target) return 

        const deltaX = event.clientX - this.lastMouseX
        this.lastMouseX = event.clientX

        // Calcular la rotación alrededor del eje Y (vertical)
        const rotationY = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), // Eje Y
            -deltaX * this.rotationSpeed * 0.005 // Ángulo de rotación
        )

        // Aplicar la nueva rotación a la rotación acumulada
        this.rotationQuaternion.multiplyQuaternions(rotationY, this.rotationQuaternion)
    }

    /**
     * Esta es la función que se llama desde World.js en cada frame
     * cuando la cámara en tercera persona está activa.
     */
    update() {
        if (!this.target) return 

        // --- ¡AQUÍ ESTÁ LA MODIFICACIÓN! ---
        // 1. Combinamos la rotación del robot con la rotación del mouse
        const finalRotation = new THREE.Quaternion()
            .copy(this.target.quaternion)       // Empezamos con la rotación del robot
            .multiply(this.rotationQuaternion); // Le aplicamos la rotación del mouse

        // 2. Calcular la posición ideal de la cámara
        const idealPosition = this.idealOffset.clone()
        
        // ANTES: idealPosition.applyQuaternion(this.rotationQuaternion)
        idealPosition.applyQuaternion(finalRotation) // Aplicar la rotación COMBINADA
        
        idealPosition.add(this.target.position)      // Mover la cámara a la posición del robot

        // 3. Calcular el punto ideal a donde mirar (esto no cambia)
        const idealLookAt = this.idealLookAt.clone()
        idealLookAt.add(this.target.position) // El punto de mira se mueve con el robot

        // 4. Suavizar (Lerp) el movimiento de la cámara
        this.currentPosition.lerp(idealPosition, this.lerpFactor)

        // 5. Suavizar (Lerp) el punto de mira
        this.currentLookAt.lerp(idealLookAt, this.lerpFactor)

        // 6. Aplicar las posiciones a la CÁMARA PRINCIPAL de la experiencia
        this.cameraInstance.position.copy(this.currentPosition)
        this.cameraInstance.lookAt(this.currentLookAt)
    }
}