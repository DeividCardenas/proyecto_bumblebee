const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Función auxiliar para generar token JWT
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET || 'tu_secret_key_super_segura_cambiar_en_produccion',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Registro de nuevo usuario
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validar que todos los campos estén presentes
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, proporciona todos los campos requeridos (username, email, password)'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: existingUser.email === email
                    ? 'El email ya está registrado'
                    : 'El nombre de usuario ya está en uso'
            });
        }

        // Crear nuevo usuario
        const user = new User({
            username,
            email,
            password
        });

        await user.save();

        // Generar token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    gameStats: user.gameStats
                }
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);

        // Manejo de errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Error de validación',
                errors: messages
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario',
            error: error.message
        });
    }
};

// Login de usuario
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar campos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, proporciona email y contraseña'
            });
        }

        // Buscar usuario por email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Verificar contraseña
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Actualizar último login
        user.lastLogin = new Date();
        await user.save();

        // Generar token
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    gameStats: user.gameStats,
                    lastLogin: user.lastLogin
                }
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión',
            error: error.message
        });
    }
};

// Obtener perfil del usuario autenticado
exports.getProfile = async (req, res) => {
    try {
        // req.user viene del middleware de autenticación
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    gameStats: user.gameStats,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener perfil',
            error: error.message
        });
    }
};

// Actualizar estadísticas del juego
exports.updateGameStats = async (req, res) => {
    try {
        const { highScore, level, totalGamesPlayed, totalPlayTime } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Actualizar solo los campos proporcionados
        if (highScore !== undefined && highScore > user.gameStats.highScore) {
            user.gameStats.highScore = highScore;
        }
        if (level !== undefined) {
            user.gameStats.level = level;
        }
        if (totalGamesPlayed !== undefined) {
            user.gameStats.totalGamesPlayed = totalGamesPlayed;
        }
        if (totalPlayTime !== undefined) {
            user.gameStats.totalPlayTime = totalPlayTime;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Estadísticas actualizadas exitosamente',
            data: {
                gameStats: user.gameStats
            }
        });

    } catch (error) {
        console.error('Error al actualizar estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar estadísticas',
            error: error.message
        });
    }
};

// Verificar token
exports.verifyToken = async (req, res) => {
    try {
        // Si llegamos aquí, el token es válido (verificado por el middleware)
        res.status(200).json({
            success: true,
            message: 'Token válido',
            data: {
                userId: req.user.id
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al verificar token',
            error: error.message
        });
    }
};
