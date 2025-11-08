const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private (requiere token)
 */
router.get('/profile', auth, authController.getProfile);

/**
 * @route   PUT /api/auth/game-stats
 * @desc    Actualizar estadísticas del juego
 * @access  Private (requiere token)
 */
router.put('/game-stats', auth, authController.updateGameStats);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar si el token es válido
 * @access  Private (requiere token)
 */
router.get('/verify', auth, authController.verifyToken);

module.exports = router;
