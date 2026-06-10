import './App.css'

function App() {
  return (
    <div className="container">
      <header className="page-header">
        <div className="header-brand">
          <span className="brand-mark">🌱</span>
          <div>
            <strong>HydroSmart</strong>
            <p>Automatización inteligente para invernaderos multiplanta</p>
          </div>
        </div>

        <nav className="header-nav">
          <a href="#problema" className="nav-link"><span>🚨</span> Problema</a>
          <a href="#solucion" className="nav-link"><span>💡</span> Solución</a>
          <a href="#tecnologia" className="nav-link"><span>⚙️</span> Tecnología</a>
          <a href="#contacto" className="header-cta"><span>📞</span> Contactar</a>
        </nav>
      </header>

      {/* HERO */}
      <section className="hero">
        <h1>🌱 HydroSmart</h1>
        <p>Sistema inteligente de automatización para invernaderos multiplanta</p>
        <button>Ver Demo</button>
      </section>

      {/* PROBLEMA */}
      <section id="problema" className="section">
        <h2>🚨 Problema</h2>
        <p>
          En un invernadero con diferentes cultivos, cada planta requiere condiciones
          específicas. El control manual provoca errores, desperdicio de agua
          y baja eficiencia.
        </p>
      </section>

      {/* SOLUCIÓN */}
      <section id="solucion" className="section">
        <h2>💡 Solución</h2>
        <p>
          HydroSmart automatiza el riego, monitoreo y control ambiental
          usando sensores, IoT y una plataforma web + móvil en tiempo real.
        </p>
      </section>

      {/* FEATURES */}
      <section className="section grid">
        <div className="card">
          <h3>🌡️ Monitoreo</h3>
          <p>Temperatura, humedad y pH en tiempo real</p>
        </div>

        <div className="card">
          <h3>💧 Riego automático</h3>
          <p>Sistema inteligente según cada planta</p>
        </div>

        <div className="card">
          <h3>📱 App móvil</h3>
          <p>Control desde cualquier lugar</p>
        </div>

        <div className="card">
          <h3>☁️ API</h3>
          <p>Datos en la nube y alertas en tiempo real</p>
        </div>
      </section>

      {/* TECNOLOGÍA */}
      <section id="tecnologia" className="section">
        <h2>⚙️ Tecnologías</h2>
        <p>
          React + Vite + Firebase + IoT (sensores) + API REST
        </p>
      </section>

      {/* CTA */}
      <section id="contacto" className="hero">
        <h2>🚀 Empieza ahora</h2>
        <button>Contactar</button>
      </section>

    </div>
  )
}

export default App