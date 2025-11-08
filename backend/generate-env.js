const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generar un JWT_SECRET seguro
const jwtSecret = crypto.randomBytes(64).toString('hex');

// Contenido del archivo .env
const envContent = `PORT=3001
MONGO_URI=mongodb://localhost:27017/bumblebee_game

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d
`;

// Ruta del archivo .env
const envPath = path.join(__dirname, '.env');

// Verificar si ya existe un archivo .env
if (fs.existsSync(envPath)) {
    console.log('⚠️  Ya existe un archivo .env');
    console.log('Si quieres reemplazarlo, elimínalo manualmente primero.');
    console.log('\nAquí está tu nuevo JWT_SECRET generado:');
    console.log('─'.repeat(80));
    console.log(jwtSecret);
    console.log('─'.repeat(80));
    console.log('\nPuedes copiarlo y pegarlo manualmente en tu archivo .env');
} else {
    // Crear archivo .env
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Archivo .env creado exitosamente!');
    console.log('\nContenido:');
    console.log('─'.repeat(80));
    console.log(envContent);
    console.log('─'.repeat(80));
    console.log('\n⚠️  IMPORTANTE: No compartas este archivo ni lo subas a Git!');
    console.log('El archivo .env ya está incluido en .gitignore');
}
