import crypto from 'crypto';
import dotenv from 'dotenv';
import { countAdminUsers, createAdminUser, findAdminByUsername } from '../services/adminAuthService.js';
import { initDatabase } from '../db/database.js';
import { initNeonTables } from '../db/neon.js';

dotenv.config();

function generateSecureRandomPassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*_-';
  const bytes = crypto.randomBytes(length);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

async function run() {
  console.log('\n======================================================');
  console.log('🛡️  URBAN STYLE — INICIALIZACIÓN DE ADMINISTRADOR');
  console.log('======================================================\n');

  // Inicializar tablas si hiciera falta
  initDatabase();
  await initNeonTables();

  const args = process.argv.slice(2);
  const isForce = args.includes('--force');
  const nonFlagArgs = args.filter((a) => !a.startsWith('--'));

  const count = await countAdminUsers();

  let targetUsername = nonFlagArgs[0] || process.env.ADMIN_INIT_USER || 'admin';
  let targetPassword = nonFlagArgs[1] || process.env.ADMIN_INIT_PASSWORD;
  let isGenerated = false;

  const existingAdmin = await findAdminByUsername(targetUsername);

  if (count > 0 && existingAdmin && !isForce) {
    console.log(`⚠️  Ya existe un administrador registrado con el usuario "${targetUsername}".`);
    console.log('Por seguridad, la inicialización está bloqueada para evitar sobreescritura accidental.');
    console.log('Si deseas restablecer la contraseña, ejecuta:');
    console.log(`npm run admin:init -- ${targetUsername} [nueva_contraseña] --force\n`);
    process.exit(0);
  }

  if (!targetPassword) {
    targetPassword = generateSecureRandomPassword(16);
    isGenerated = true;
  }

  if (targetPassword.length < 8) {
    console.error('❌ Error: La contraseña debe tener al menos 8 caracteres por seguridad.');
    process.exit(1);
  }

  try {
    const result = await createAdminUser({
      username: targetUsername,
      password: targetPassword,
      role: 'superadmin'
    });

    console.log('✅ Administrador configurado exitosamente:');
    console.log(`   • Usuario: ${result.username}`);
    console.log(`   • Contraseña ${isGenerated ? '(Generada aleatoriamente)' : '(Ingresada)'}: ${targetPassword}`);
    console.log(`   • Rol: ${result.role}`);
    console.log(`   • Almacenamiento: Neon PostgreSQL (${result.createdInNeon ? 'Conectado' : 'Pendiente reconexión'}) + Base Local`);
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   Guarda estas credenciales en tu gestor de contraseñas.');
    console.log('   La contraseña ha sido protegida con PBKDF2 (120.000 iteraciones SHA-512 + Sal de 256 bits).');
    console.log('   Nunca se almacena en texto plano ni se muestra en los registros del servidor.\n');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error configurando administrador:', err.message);
    process.exit(1);
  }
}

run();
