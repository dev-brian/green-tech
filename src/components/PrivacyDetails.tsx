import { CONTACT_EMAIL } from '../lib/brand';

const p: React.CSSProperties = { fontSize: '0.875rem', lineHeight: 1.65, margin: '0 0 var(--space-xs)' };
const h: React.CSSProperties = { fontSize: '0.875rem', fontWeight: 700, margin: 'var(--space-sm) 0 4px', color: 'var(--text-primary)' };

/**
 * Texto completo del aviso de privacidad. Lo usan el aviso del login
 * ("Leer más") y el pie de la landing, para que digan lo mismo.
 */
export default function PrivacyDetails() {
  return (
    <>
      <p style={h}>Quién es responsable</p>
      <p style={p}>Palarix, el equipo que desarrolla GreenTech. Contacto: {CONTACT_EMAIL}.</p>

      <p style={h}>Qué datos guardamos</p>
      <ul style={{ ...p, paddingLeft: '1.25rem' }}>
        <li>De tu cuenta de Google: nombre, correo y foto de perfil.</li>
        <li>Los invernaderos, zonas y cultivos que registras, y tu rol (admin u operador).</li>
        <li>Las lecturas de los sensores, las alertas y quién marcó cada alerta como revisada.</li>
        <li>Si activas las notificaciones, un identificador del dispositivo para enviarte avisos.</li>
      </ul>

      <p style={h}>Para qué los usamos</p>
      <p style={p}>
        Para iniciar sesión, mostrarte el estado de tu invernadero, avisarte cuando una lectura sale
        de rango y que tu equipo vea quién atendió cada alerta. No los usamos para publicidad.
      </p>

      <p style={h}>Dónde se guardan</p>
      <p style={p}>
        En Firebase, el servicio de Google Cloud que usa la app. Los datos viajan cifrados y solo los
        ven las personas de tu invernadero. Una copia queda en tu dispositivo para que la app funcione
        sin internet.
      </p>

      <p style={h}>Tus derechos</p>
      <p style={p}>
        Puedes pedir ver, corregir o borrar tus datos, u oponerte a su uso, escribiendo a{' '}
        {CONTACT_EMAIL}. Te respondemos en un máximo de 20 días hábiles. Si borramos tu cuenta,
        dejas de tener acceso a los invernaderos.
      </p>

      <p style={h}>Cambios a este aviso</p>
      <p style={p}>Si cambia, te lo mostraremos otra vez al iniciar sesión.</p>
    </>
  );
}
