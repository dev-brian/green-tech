interface AlertBadgeProps {
  count: number;
}

/**
 * Pastilla numérica roja que se superpone sobre el ícono de "Alertas"
 * en la navegación, mostrando el conteo de alertas no atendidas.
 * No se muestra si count === 0.
 */
export default function AlertBadge({ count }: AlertBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} alerta${count !== 1 ? 's' : ''} sin atender`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        borderRadius: 'var(--radius-full)',
        background: 'var(--status-red)',
        color: '#fff',
        fontSize: '0.625rem',
        fontWeight: 800,
        lineHeight: 1,
        padding: '0 4px',
        boxShadow: '0 0 6px var(--status-red-glow)',
        pointerEvents: 'none',
        flexShrink: 0,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
