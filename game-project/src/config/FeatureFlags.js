/**
 * Feature Flags para activar/desactivar funcionalidades
 *
 * Útil para:
 * - Desarrollo y debugging
 * - Despliegue progresivo de features
 * - A/B testing
 * - Desactivar features problemáticas temporalmente
 *
 * @author Optimizado por Claude Code
 * @version 2.0
 */

export const FEATURES = {
    // ========================================
    // SISTEMA MULTIJUGADOR
    // ========================================
    /**
     * Habilitar sistema multijugador (SocketManager)
     * NOTA: Actualmente deshabilitado por issues no resueltos
     */
    MULTIPLAYER_ENABLED: false,

    // ========================================
    // DEBUG Y DESARROLLO
    // ========================================
    /**
     * Mostrar debugger visual de física (cannon-es-debugger)
     * Muestra líneas verdes con las colisiones
     */
    PHYSICS_DEBUG: false,

    /**
     * Mostrar panel de debug (lil-gui)
     * Panel lateral para ajustar parámetros en tiempo real
     */
    DEBUG_PANEL: false,

    /**
     * Logs verbosos en consola
     * Muestra información detallada de debugging
     */
    VERBOSE_LOGGING: false,

    // ========================================
    // EXPERIENCIA VR
    // ========================================
    /**
     * Habilitar soporte VR (WebXR)
     * Permite jugar con dispositivos de realidad virtual
     */
    VR_ENABLED: true,

    // ========================================
    // GAMEPLAY
    // ========================================
    /**
     * Habilitar enemigos en el juego
     * Controlado por variable de entorno VITE_ENEMIES_COUNT
     */
    ENEMIES_ENABLED: parseInt(import.meta.env.VITE_ENEMIES_COUNT || '0', 10) > 0,

    /**
     * Número de enemigos a spawnear
     * Solo se usa si ENEMIES_ENABLED es true
     */
    ENEMIES_COUNT: parseInt(import.meta.env.VITE_ENEMIES_COUNT || '0', 10),

    // ========================================
    // AUDIO
    // ========================================
    /**
     * Habilitar audio ambiente
     * Música de fondo y efectos ambientales
     */
    AMBIENT_AUDIO: true,

    /**
     * Habilitar efectos de sonido
     * Sonidos de acciones (salto, monedas, etc.)
     */
    SOUND_EFFECTS: true,

    // ========================================
    // OPTIMIZACIONES
    // ========================================
    /**
     * Optimización de física por distancia
     * Desactiva cuerpos físicos lejanos para mejorar FPS
     */
    PHYSICS_DISTANCE_OPTIMIZATION: true,

    /**
     * Debouncing de detección de colisiones
     * Revisa colisiones cada N frames en lugar de cada frame
     */
    COLLISION_DEBOUNCING: true,

    // ========================================
    // EFECTOS VISUALES
    // ========================================
    /**
     * Partículas del portal final
     * Sistema de partículas cuando aparece el portal
     */
    PORTAL_PARTICLES: true,

    /**
     * Faro de luz hacia el premio final
     * Rayo de luz que apunta al portal
     */
    FINAL_PRIZE_BEACON: true,

    // ========================================
    // DESARROLLO
    // ========================================
    /**
     * Modo desarrollo (auto-detectado)
     * True cuando se ejecuta con 'npm run dev'
     */
    DEV_MODE: import.meta.env.DEV || false,

    /**
     * Modo producción (auto-detectado)
     */
    PROD_MODE: import.meta.env.PROD || false
};

/**
 * Verifica si una feature está habilitada
 * @param {string} featureName - Nombre de la feature
 * @returns {boolean}
 *
 * @example
 * if (isFeatureEnabled('MULTIPLAYER_ENABLED')) {
 *   // Inicializar socket manager
 * }
 */
export function isFeatureEnabled(featureName) {
    if (!(featureName in FEATURES)) {
        console.warn(`⚠️ Feature flag desconocido: "${featureName}"`);
        return false;
    }
    return FEATURES[featureName] === true;
}

/**
 * Verifica múltiples features a la vez
 * @param {...string} featureNames - Nombres de features
 * @returns {boolean} - True si TODAS están habilitadas
 *
 * @example
 * if (areAllFeaturesEnabled('VR_ENABLED', 'SOUND_EFFECTS')) {
 *   // Código que requiere ambas features
 * }
 */
export function areAllFeaturesEnabled(...featureNames) {
    return featureNames.every(name => isFeatureEnabled(name));
}

/**
 * Verifica si al menos una feature está habilitada
 * @param {...string} featureNames - Nombres de features
 * @returns {boolean} - True si AL MENOS UNA está habilitada
 */
export function isAnyFeatureEnabled(...featureNames) {
    return featureNames.some(name => isFeatureEnabled(name));
}

/**
 * Obtiene el valor de una feature (útil para features numéricas)
 * @param {string} featureName - Nombre de la feature
 * @returns {*} - Valor de la feature
 */
export function getFeatureValue(featureName) {
    return FEATURES[featureName];
}

/**
 * Lista todas las features habilitadas (útil para debugging)
 * @returns {string[]} - Array con nombres de features habilitadas
 */
export function getEnabledFeatures() {
    return Object.entries(FEATURES)
        .filter(([_, value]) => value === true)
        .map(([key, _]) => key);
}

/**
 * Imprime reporte de features en consola (solo en desarrollo)
 */
export function printFeatureReport() {
    if (!FEATURES.DEV_MODE) return;

    console.group('🎛️ Feature Flags Status');
    Object.entries(FEATURES).forEach(([key, value]) => {
        const icon = value === true ? '✅' : value === false ? '❌' : '🔢';
        console.log(`${icon} ${key}: ${value}`);
    });
    console.groupEnd();
}

export default FEATURES;
