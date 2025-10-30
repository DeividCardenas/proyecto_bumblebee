/**
 * Sistema de logging centralizado
 *
 * Proporciona una interfaz consistente para logs en toda la aplicación.
 * Permite activar/desactivar logs según el entorno y nivel de verbosidad.
 *
 * @author Optimizado por Claude Code
 * @version 2.0
 */

import { FEATURES } from '../config/FeatureFlags.js';

/**
 * Niveles de logging
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

class Logger {
    constructor() {
        // Determinar nivel de log según entorno
        this.currentLevel = this._determineLogLevel();

        // Cache de estadísticas (opcional)
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        };
    }

    /**
     * Determina el nivel de log según el entorno y feature flags
     * @private
     */
    _determineLogLevel() {
        if (FEATURES.VERBOSE_LOGGING) {
            return LOG_LEVELS.DEBUG;
        }

        if (FEATURES.DEV_MODE) {
            return LOG_LEVELS.INFO;
        }

        // En producción, solo warnings y errores
        return LOG_LEVELS.WARN;
    }

    /**
     * Verifica si un nivel de log debe ser mostrado
     * @private
     */
    _shouldLog(level) {
        return level >= this.currentLevel;
    }

    /**
     * Log de debug (solo en modo verbose)
     * @param {string} message - Mensaje
     * @param  {...any} args - Argumentos adicionales
     */
    debug(message, ...args) {
        if (!this._shouldLog(LOG_LEVELS.DEBUG)) return;

        console.debug(`🔍 [Debug] ${message}`, ...args);
        this.stats.debug++;
    }

    /**
     * Log informativo (desarrollo)
     * @param {string} emoji - Emoji representativo
     * @param {string} message - Mensaje
     * @param  {...any} args - Argumentos adicionales
     */
    info(emoji, message, ...args) {
        if (!this._shouldLog(LOG_LEVELS.INFO)) return;

        console.log(`${emoji} ${message}`, ...args);
        this.stats.info++;
    }

    /**
     * Log estándar sin emoji
     * @param {string} message - Mensaje
     * @param  {...any} args - Argumentos adicionales
     */
    log(message, ...args) {
        if (!this._shouldLog(LOG_LEVELS.INFO)) return;

        console.log(`[Game] ${message}`, ...args);
        this.stats.info++;
    }

    /**
     * Advertencias (siempre visible excepto en producción)
     * @param {string} message - Mensaje
     * @param  {...any} args - Argumentos adicionales
     */
    warn(message, ...args) {
        if (!this._shouldLog(LOG_LEVELS.WARN)) return;

        console.warn(`⚠️ ${message}`, ...args);
        this.stats.warn++;
    }

    /**
     * Errores (siempre visible)
     * @param {string} message - Mensaje
     * @param  {...any} args - Argumentos adicionales
     */
    error(message, ...args) {
        if (!this._shouldLog(LOG_LEVELS.ERROR)) return;

        console.error(`❌ ${message}`, ...args);
        this.stats.error++;
    }

    /**
     * Log de grupo (para agrupar logs relacionados)
     * @param {string} title - Título del grupo
     * @param {Function} callback - Función que ejecuta logs dentro del grupo
     */
    group(title, callback) {
        if (!this._shouldLog(LOG_LEVELS.INFO)) return;

        console.group(title);
        try {
            callback();
        } finally {
            console.groupEnd();
        }
    }

    /**
     * Log de tabla (útil para arrays de objetos)
     * @param {Array|Object} data - Datos a mostrar
     */
    table(data) {
        if (!this._shouldLog(LOG_LEVELS.INFO)) return;
        console.table(data);
    }

    /**
     * Timing - Inicia un temporizador
     * @param {string} label - Etiqueta del temporizador
     */
    time(label) {
        if (!this._shouldLog(LOG_LEVELS.DEBUG)) return;
        console.time(label);
    }

    /**
     * Timing - Finaliza un temporizador
     * @param {string} label - Etiqueta del temporizador
     */
    timeEnd(label) {
        if (!this._shouldLog(LOG_LEVELS.DEBUG)) return;
        console.timeEnd(label);
    }

    /**
     * Assert - Lanza un error si la condición es falsa
     * @param {boolean} condition - Condición a verificar
     * @param {string} message - Mensaje de error
     */
    assert(condition, message) {
        if (!this._shouldLog(LOG_LEVELS.ERROR)) return;
        console.assert(condition, `❌ ${message}`);
    }

    /**
     * Imprime estadísticas de logs (debugging)
     */
    printStats() {
        this.group('📊 Logger Statistics', () => {
            console.log('Debug logs:', this.stats.debug);
            console.log('Info logs:', this.stats.info);
            console.log('Warnings:', this.stats.warn);
            console.log('Errors:', this.stats.error);
            console.log('Total:', Object.values(this.stats).reduce((a, b) => a + b, 0));
        });
    }

    /**
     * Resetea estadísticas
     */
    resetStats() {
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        };
    }

    /**
     * Cambia el nivel de logging en runtime
     * @param {string} level - 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'
     */
    setLevel(level) {
        if (level in LOG_LEVELS) {
            this.currentLevel = LOG_LEVELS[level];
            this.info('🎛️', `Nivel de logging cambiado a: ${level}`);
        } else {
            this.warn(`Nivel de logging inválido: ${level}`);
        }
    }
}

// Exportar instancia singleton
const logger = new Logger();

// En desarrollo, hacer disponible globalmente para debugging desde consola
if (FEATURES.DEV_MODE) {
    window.logger = logger;
}

export default logger;
