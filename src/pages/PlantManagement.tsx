import { useState, useEffect } from 'react';
import { Leaf, Droplets, ThermometerSun, Plus, ShieldAlert, Pencil, Trash2, X, CloudRain, Sun, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { plantsService, type Plant } from '../lib/plantsService';

export default function PlantManagement() {
  const { isAdmin, activeWorkspace } = useAuth();
  
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    status: 'En Espera',
    tempMin: 18,
    tempMax: 24,
    humidity: 60,
    soilMoisture: 50,
    lightHours: 12
  });

  useEffect(() => {
    if (isAdmin && activeWorkspace) {
      loadPlants();
    }
  }, [isAdmin, activeWorkspace]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPlants = async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await plantsService.getPlants(activeWorkspace.id);
      setPlants(data);
    } catch (error: any) {
      console.error('Error cargando plantas:', error);
      setErrorMsg('No se pudieron cargar las plantas: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plant?: Plant) => {
    setErrorMsg(null);
    if (plant) {
      setEditingPlant(plant);
      setFormData({
        name: plant.name,
        status: plant.status,
        tempMin: plant.reqs.tempMin || 18,
        tempMax: plant.reqs.tempMax || 24,
        humidity: plant.reqs.humidity || 60,
        soilMoisture: plant.reqs.soilMoisture || 50,
        lightHours: plant.reqs.lightHours || 12,
      });
    } else {
      setEditingPlant(null);
      setFormData({
        name: '',
        status: 'En Espera',
        tempMin: 18,
        tempMax: 24,
        humidity: 60,
        soilMoisture: 50,
        lightHours: 12
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlant(null);
    setErrorMsg(null);
  };

  const handleSavePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) {
      alert("No hay un invernadero activo seleccionado.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const plantData = {
        name: formData.name,
        status: formData.status,
        active: editingPlant ? editingPlant.active : false,
        reqs: {
          tempMin: Number(formData.tempMin),
          tempMax: Number(formData.tempMax),
          humidity: Number(formData.humidity),
          soilMoisture: Number(formData.soilMoisture),
          lightHours: Number(formData.lightHours)
        }
      };

      if (editingPlant) {
        await plantsService.updatePlant(activeWorkspace.id, editingPlant.id, plantData);
      } else {
        await plantsService.addPlant(activeWorkspace.id, plantData);
      }
      
      handleCloseModal();
      loadPlants();
    } catch (error: any) {
      console.error('Error guardando planta:', error);
      setErrorMsg('Error al guardar: ' + (error.message || 'Verifica tus permisos de Firebase.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!activeWorkspace) return;
    if (window.confirm('¿Estás seguro de que deseas eliminar esta planta?')) {
      try {
        await plantsService.deletePlant(activeWorkspace.id, plantId);
        loadPlants();
      } catch (error: any) {
        console.error('Error eliminando planta:', error);
        alert('Error al eliminar: ' + (error.message || 'Verifica tus permisos de Firebase.'));
      }
    }
  };

  const handleSetActive = async (plantId: string) => {
    if (!activeWorkspace) return;
    try {
      const allIds = plants.map(p => p.id);
      await plantsService.setActivePlant(activeWorkspace.id, plantId, allIds);
      loadPlants();
    } catch (error: any) {
      console.error('Error activando planta:', error);
      alert('Error al activar cultivo: ' + (error.message || 'Verifica tus permisos de Firebase.'));
    }
  };

  const handleTempMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val <= formData.tempMax) {
      setFormData({ ...formData, tempMin: val });
    }
  };

  const handleTempMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val >= formData.tempMin) {
      setFormData({ ...formData, tempMax: val });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
          <ShieldAlert className="text-amber-400 w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Acceso Restringido</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm sm:text-base">
          La gestión de cultivos y el catálogo de plantas es una función exclusiva para usuarios con rol de <strong>Administrador</strong>.
        </p>
        <Link to="/dashboard" className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl inline-flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/25">
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 animate-fade-in">
      
      {/* Header Responsivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-8 sm:mb-10">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">Catálogo de Cultivos</h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
            Administra los perfiles y requerimientos paramétricos de las plantas de tu invernadero.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-5 rounded-xl inline-flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
        >
          <Plus size={20} />
          <span>Registrar Cultivo</span>
        </button>
      </div>

      {/* Estados de Carga y Vacío */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-medium">Cargando base de datos...</p>
        </div>
      ) : plants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-white/5 px-4">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 shadow-inner">
            <Leaf size={40} className="text-slate-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Aún no hay cultivos</h3>
          <p className="text-slate-400 max-w-sm mx-auto mb-8 text-sm sm:text-base">
            No has registrado ningún perfil de planta en este invernadero. Comienza agregando tu primer cultivo para el monitoreo.
          </p>
          <button 
            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-medium py-2.5 px-6 rounded-xl transition-colors"
            onClick={() => handleOpenModal()}
          >
            Agregar mi primera planta
          </button>
        </div>
      ) : (
        /* Grid de Tarjetas Responsivo */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {plants.map(plant => (
            <div 
              key={plant.id} 
              className={`group flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 transition-all duration-300 relative border ${
                plant.active 
                  ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)] ring-1 ring-emerald-500/50' 
                  : 'border-white/10 hover:border-white/20 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              
              {/* Acciones Hover Absolutas */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={() => handleOpenModal(plant)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/5 shadow-md"
                  aria-label="Editar planta"
                >
                  <Pencil size={15} />
                </button>
                <button 
                  onClick={() => handleDeletePlant(plant.id)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-colors border border-white/5 shadow-md"
                  aria-label="Eliminar planta"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Badge Cultivo Actual */}
              {plant.active && (
                <div className="absolute -top-3 -left-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-lg flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  CULTIVO ACTUAL
                </div>
              )}
              
              {/* Card Header */}
              <div className={`flex items-start gap-4 mb-5 ${plant.active ? 'mt-2' : ''}`}>
                <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  plant.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Leaf size={24} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-lg font-bold text-white truncate pr-16 sm:pr-0 leading-tight mb-1" title={plant.name}>
                    {plant.name}
                  </h3>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md ${
                    plant.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {plant.status}
                  </span>
                </div>
              </div>

              {/* Card Body (Stats) */}
              <div className="bg-slate-950/50 rounded-xl p-4 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  <Info size={14} />
                  Parámetros
                </div>
                <ul className="space-y-3">
                  <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center text-slate-400 gap-2">
                      <ThermometerSun size={16} className="text-amber-400" /> 
                      <span className="hidden xs:inline sm:hidden lg:inline">Temperatura</span>
                      <span className="inline xs:hidden sm:inline lg:hidden">Temp.</span>
                    </span>
                    <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-white/5 shadow-sm whitespace-nowrap">
                      {plant.reqs.tempMin}°C - {plant.reqs.tempMax}°C
                    </strong>
                  </li>
                  <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center text-slate-400 gap-2">
                      <CloudRain size={16} className="text-cyan-400" /> 
                      <span className="hidden xs:inline sm:hidden lg:inline">Humedad (HR)</span>
                      <span className="inline xs:hidden sm:inline lg:hidden">HR</span>
                    </span>
                    <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-white/5 shadow-sm whitespace-nowrap">
                      {plant.reqs.humidity}%
                    </strong>
                  </li>
                  <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center text-slate-400 gap-2">
                      <Droplets size={16} className="text-blue-500" /> 
                      Sustrato
                    </span>
                    <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-white/5 shadow-sm whitespace-nowrap">
                      {plant.reqs.soilMoisture}%
                    </strong>
                  </li>
                  <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center text-slate-400 gap-2">
                      <Sun size={16} className="text-yellow-400" /> 
                      Fotoperiodo
                    </span>
                    <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-white/5 shadow-sm whitespace-nowrap">
                      {plant.reqs.lightHours}h
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Card Footer (Actions) */}
              {!plant.active && (
                <button 
                  onClick={() => handleSetActive(plant.id)} 
                  className="w-full mt-4 bg-transparent hover:bg-slate-800 text-white border border-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:ring-2 focus:ring-emerald-500/50 outline-none"
                >
                  Establecer como Cultivo
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

      {/* Modal 100% Responsivo fuera del contexto de apilamiento para sobreponerse al Navbar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm sm:animate-fade-in transition-all">
          <div className="bg-slate-900 sm:border border-slate-700/50 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] sm:m-auto animate-slide-up sm:animate-none">
            
            {/* Modal Header Fijo */}
            <div className="p-5 sm:p-6 border-b border-white/5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Leaf className="text-emerald-400" size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white m-0">
                  {editingPlant ? 'Editar Cultivo' : 'Nuevo Cultivo'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={handleCloseModal} 
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="overflow-y-auto p-5 sm:p-6 custom-scrollbar flex-1">
              <form id="plant-form" onSubmit={handleSavePlant} className="flex flex-col gap-6">
                
                {/* Info Básica */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Información Básica</h4>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre de la Planta</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                      placeholder="Ej. Lechuga Romana"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Estado Inicial</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'En Espera', title: 'En Espera', desc: 'Aún no se ha plantado en el sistema.', color: 'text-slate-400', bg: 'bg-slate-500', border: 'border-slate-500' },
                        { id: 'Creciendo', title: 'Creciendo', desc: 'Fase de desarrollo y crecimiento temprano.', color: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500' },
                        { id: 'Óptimo', title: 'Óptimo', desc: 'Salud perfecta o madurez vegetativa.', color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500' },
                        { id: 'Cosecha', title: 'Cosecha', desc: 'Lista para ser cortada o recolectada.', color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500' },
                      ].map(state => (
                        <button
                          key={state.id}
                          type="button"
                          onClick={() => setFormData({...formData, status: state.id})}
                          className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                            formData.status === state.id 
                              ? `${state.border} bg-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
                              : 'border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/80 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${formData.status === state.id ? `${state.bg} animate-pulse shadow-[0_0_8px_currentColor]` : 'bg-slate-600'}`} />
                            <span className={`text-sm font-bold ${formData.status === state.id ? state.color : 'text-slate-300'}`}>
                              {state.title}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 pl-4 leading-tight">{state.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Parámetros Ambientales */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parámetros (Microclima)</h4>
                  
                  {/* Temperatura - Sliders */}
                  <div className="bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-white/5">
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                        <ThermometerSun size={18} className="text-amber-400" /> Rango de Temperatura
                      </label>
                      <div className="bg-slate-950 px-3 py-1 rounded-lg text-sm font-mono text-amber-400 border border-amber-500/20">
                        {formData.tempMin}°C - {formData.tempMax}°C
                      </div>
                    </div>
                    
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                          <span>Mínima permitida</span>
                          <span>{formData.tempMin}°C</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="40" step="1"
                          value={formData.tempMin} 
                          onChange={handleTempMinChange}
                          className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                          <span>Máxima permitida</span>
                          <span>{formData.tempMax}°C</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="50" step="1"
                          value={formData.tempMax} 
                          onChange={handleTempMaxChange}
                          className="w-full accent-red-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    {/* Humedad Relativa */}
                    <div className="bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                          <CloudRain size={18} className="text-cyan-400" /> HR
                        </label>
                        <span className="text-sm font-mono text-cyan-400">{formData.humidity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" step="5"
                        value={formData.humidity} 
                        onChange={e => setFormData({...formData, humidity: Number(e.target.value)})}
                        className="w-full accent-cyan-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Humedad Sustrato */}
                    <div className="bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                          <Droplets size={18} className="text-blue-500" /> Sustrato
                        </label>
                        <span className="text-sm font-mono text-blue-500">{formData.soilMoisture}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" step="5"
                        value={formData.soilMoisture} 
                        onChange={e => setFormData({...formData, soilMoisture: Number(e.target.value)})}
                        className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Fotoperiodo */}
                  <div className="bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                        <Sun size={18} className="text-yellow-400" /> Fotoperiodo
                      </label>
                      <span className="text-sm font-mono text-yellow-400">{formData.lightHours}h/día</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="24" step="1"
                      value={formData.lightHours} 
                      onChange={e => setFormData({...formData, lightHours: Number(e.target.value)})}
                      className="w-full accent-yellow-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>0h</span>
                      <span>12h</span>
                      <span>24h</span>
                    </div>
                  </div>

                </div>
              </form>
            </div>

            {/* Modal Footer Fijo */}
            <div className="p-5 sm:p-6 border-t border-white/5 bg-slate-900 shrink-0 flex flex-col sm:flex-row gap-3">
              {errorMsg && (
                <div className="w-full text-red-400 text-sm mb-2 text-center p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  {errorMsg}
                </div>
              )}
              <button 
                type="button" 
                onClick={handleCloseModal} 
                disabled={isSaving}
                className="order-2 sm:order-1 w-full sm:w-1/2 bg-transparent hover:bg-slate-800 text-slate-300 font-medium border border-slate-700 py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="plant-form" 
                disabled={isSaving}
                className="order-1 sm:order-2 w-full sm:w-1/2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cultivo'
                )}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </>
  );
}
