// ============================================================
// SCRIPT DE CONFIGURACIÓN SMTP - MentorIApp / educacionmanantial.com
// ============================================================
// 
// Propósito: Verificar y configurar SMTP en Supabase Auth usando Resend
// Proyecto: fssjgpqisfnmnkavsyld
// Dominio: mail.resendcegmas.com
// 
// PASOS:
// 1. Ejecutar: node scripts/verify-smtp-config.js
// 2. Verificar app_settings en la base de datos
// 3. Acceder a: https://supabase.com/dashboard/project/fssjgpqisfnmnkavsyld/settings/auth#smtp
// 4. Configurar SMTP con los valores indicados
// 5. Verificar con una prueba de envío
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURACIÓN - ACTUALIZA ESTOS VALORES
// ============================================================
const SUPABASE_URL = 'https://fssjgpqisfnmnkavsyld.supabase.co';
// Reemplaza con tus claves reales del proyecto
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'TU_ANON_KEY_AQUI';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'TU_SERVICE_ROLE_KEY_AQUI';

// ============================================================
// VALORES ESPERADOS PARA SMTP
// ============================================================
const SMTP_CONFIG = {
  host: 'smtp.resend.com',
  port: 587,
  username: 'resend',
  sender_email: 'no-reply@mail.resendcegmas.com',
  sender_name: 'MentorIApp'
};

async function main() {
  console.log('========================================='.repeat(2));
  console.log('VERIFICADOR DE CONFIGURACIÓN SMTP - MentorIApp');
  console.log('========================================='.repeat(2));
  console.log('');
  
  // Verificar credenciales
  if (SUPABASE_ANON_KEY.includes('TU_') || SUPABASE_SERVICE_ROLE_KEY.includes('TU_')) {
    console.log('⚠️  CONFIGURACIÓN INCOMPLETA');
    console.log('');
    console.log('Debes reemplazar las credenciales en este archivo:');
    console.log('');
    console.log(`  SUPABASE_ANON_KEY = ${SUPABASE_ANON_KEY}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY = ${SUPABASE_SERVICE_ROLE_KEY}`);
    console.log('');
    console.log('O ejecutar con variables de entorno:');
    console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_key>');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=<tu_key>');
    console.log('');
    return;
  }

  // Crear cliente Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log(`📍 Proyecto: ${SUPABASE_URL}`);
  console.log('');

  // ========================================
  // PASO 1: Verificar resend_from_address
  // ========================================
  // El schema `private` no está expuesto vía REST (solo `public` y
  // `graphql_public`, ver supabase/config.toml → [api].schemas), así que
  // no se puede leer con supabase.from('private.app_settings'). Se usa la
  // función private.get_app_setting(), la misma que ya usa
  // supabase/functions/notify-attendance/index.ts.
  console.log('📋 PASO 1: Verificando resend_from_address...');
  console.log('-'.repeat(50));

  const { data, error } = await supabase
    .schema('private')
    .rpc('get_app_setting', { setting_key: 'resend_from_address' });

  if (error) {
    console.log(`  ⚠️  Error al leer resend_from_address: ${error.message}`);
  } else if (!data) {
    console.log('  ⚠️  resend_from_address: No configurado');
  } else {
    console.log(`  ✅ resend_from_address: ${data}`);
  }

  // ========================================
  // PASO 2: Verificar configuración SMTP esperada
  // ========================================
  console.log('');
  console.log('⚙️  PASO 2: Configuración SMTP esperada');
  console.log('-'.repeat(50));
  console.log(`  Host:         ${SMTP_CONFIG.host}`);
  console.log(`  Port:         ${SMTP_CONFIG.port}`);
  console.log(`  Username:     ${SMTP_CONFIG.username}`);
  console.log(`  Sender email: ${SMTP_CONFIG.sender_email}`);
  console.log(`  Sender name:  ${SMTP_CONFIG.sender_name}`);

  // ========================================
  // PASO 3: Pasos para completar
  // ========================================
  console.log('');
  console.log('✅ PASO 3: Acción requerida');
  console.log('-'.repeat(50));
  console.log('');
  console.log('1. Entra a Resend Dashboard: https://resend.com/api-keys');
  console.log('2. Crea una nueva API key llamada: "supabase-auth-smtp"');
  console.log('3. Copia el valor de la API key');
  console.log('');
  console.log('4. Entra al Dashboard de Supabase:');
  console.log('   https://supabase.com/dashboard/project/fssjgpqisfnmnkavsyld/settings/auth#smtp');
  console.log('');
  console.log('5. Activa "Enable Custom SMTP" con estos valores:');
  console.log(`   - Host: ${SMTP_CONFIG.host}`);
  console.log(`   - Port: ${SMTP_CONFIG.port}`);
  console.log(`   - Username: ${SMTP_CONFIG.username}`);
  console.log(`   - Password: [LA_API_KEY_DE_RESEND]`);
  console.log(`   - Sender email: ${SMTP_CONFIG.sender_email}`);
  console.log(`   - Sender name: ${SMTP_CONFIG.sender_name}`);
  console.log('');
  console.log('6. Haz clic en "Save changes"');
  console.log('');
  console.log('7. Prueba enviando una invitación desde:');
  console.log('   Dashboard → Authentication → Users → Invite user');
  console.log('');
  console.log('8. Verifica en Resend: https://resend.com/emails');
  console.log('');

  // ========================================
  // Resumen
  // ========================================
  console.log('========================================='.repeat(2));
  console.log('✅ CONFIGURACIÓN COMPLETA');
  console.log('========================================='.repeat(2));
}

main().catch(console.error);