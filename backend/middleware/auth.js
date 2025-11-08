const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para proteger rutas que requieren autenticación
 */
const auth = async (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. No se proporcionó token de autenticación'
            });
        }

        // El formato esperado es: "Bearer TOKEN"
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. Token inválido'
            });
        }

        // Verificar token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'tu_secret_key_super_segura_cambiar_en_produccion'
        );

        // Buscar usuario
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado. Token inválido'
            });
        }

        // Agregar usuario al request
        req.user = {
            id: user._id,
            username: user.username,
            email: user.email
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado. Por favor, inicia sesión nuevamente'
            });
        }

        console.error('Error en middleware de autenticación:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar autenticación',
            error: error.message
        });
    }
};

/**
 * Middleware opcional que agrega información del usuario si hay token,
 * pero no bloquea el acceso si no hay token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            return next();
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'tu_secret_key_super_segura_cambiar_en_produccion'
        );

        const user = await User.findById(decoded.id);

        if (user) {
            req.user = {
                id: user._id,
                username: user.username,
                email: user.email
            };
        }

        next();

    } catch (error) {
        // Si hay error con el token, simplemente continuar sin usuario
        next();
    }
};

module.exports = { auth, optionalAuth };
