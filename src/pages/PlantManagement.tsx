import { Leaf, Droplets, ThermometerSun, Plus } from 'lucide-react';

const plants = [
  {
    id: 1,
    name: 'Lechuga Romana',
    status: 'Óptimo',
    reqs: { water: 'Alta', light: 'Media', temp: '18-22°C' },
    active: true
  },
  {
    id: 2,
    name: 'Jitomate Saladette',
    status: 'Creciendo',
    reqs: { water: 'Media', light: 'Alta', temp: '20-28°C' },
    active: false
  },
  {
    id: 3,
    name: 'Fresa',
    status: 'En Espera',
    reqs: { water: 'Media', light: 'Alta', temp: '15-25°C' },
    active: false
  }
];

export default function PlantManagement() {
  return (
    <div className="container animate-fade-in">
      <div className="flex justify-between items-center flex-col-mobile" style={{ marginBottom: '2rem' }}>
        <div>
          <h2>Gestión de Plantas</h2>
          <p className="text-muted" style={{ margin: 0 }}>Administra los perfiles de cultivo del sistema inteligente.</p>
        </div>
        <button className="btn-primary">
          <Plus size={20} /> Nueva Planta
        </button>
      </div>

      <div className="grid grid-cards" style={{ gap: '2rem' }}>
        {plants.map(plant => (
          <div key={plant.id} className="glass-panel" style={{ border: plant.active ? '1px solid var(--accent-green)' : '1px solid var(--panel-border)', position: 'relative' }}>
            {plant.active && (
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--accent-green)', color: '#fff', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                Cultivo Actual
              </div>
            )}
            
            <div className="flex items-center" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: plant.active ? 'var(--accent-green-glow)' : 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '50%' }}>
                <Leaf className={plant.active ? 'text-green' : 'text-muted'} size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{plant.name}</h3>
                <span className={plant.active ? 'text-green' : 'text-muted'} style={{ fontSize: '0.9rem' }}>{plant.status}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Requerimientos:</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.8rem' }}>
                <li className="flex justify-between items-center">
                  <span className="flex items-center" style={{ gap: '0.5rem' }}><Droplets size={16} className="text-blue" /> Agua</span>
                  <strong>{plant.reqs.water}</strong>
                </li>
                <li className="flex justify-between items-center">
                  <span className="flex items-center" style={{ gap: '0.5rem' }}><ThermometerSun size={16} className="text-amber" /> Temp</span>
                  <strong>{plant.reqs.temp}</strong>
                </li>
                <li className="flex justify-between items-center">
                  <span className="flex items-center" style={{ gap: '0.5rem' }}><Leaf size={16} className="text-green" /> Luz</span>
                  <strong>{plant.reqs.light}</strong>
                </li>
              </ul>
            </div>

            {!plant.active && (
              <button className="btn-secondary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Establecer como Cultivo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
