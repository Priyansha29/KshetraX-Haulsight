import { useEffect, useState } from 'react';
import { connectWebSocket, onMessage, disconnectWebSocket } from './api/websocket';
import { useVehicleStore } from './stores/vehicleStore';
import { useAlertStore } from './stores/alertStore';
import { useSystemStore } from './stores/systemStore';
import { useAIStore } from './stores/aiStore';
import { useNodeStore } from './stores/nodeStore';
import { fetchRoadGraph, fetchVehicles, fetchActiveAlerts, fetchHealth, fetchBeacons, fetchVisibility, fetchAIHotspots, fetchProduction, fetchRadarAI, fetchScenarioStatus, fetchNodeHealth } from './api/client';
import Header from './components/layout/Header';
import MainLayout from './components/layout/MainLayout';
import DriverSafetyDashboard from './components/driver/DriverSafetyDashboard';

export default function App() {
  const [view, setView] = useState('control-room');
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const setActiveAlerts = useAlertStore((s) => s.setActiveAlerts);
  const addAlert = useAlertStore((s) => s.addAlert);
  const updateAlert = useAlertStore((s) => s.updateAlert);
  const removeAlert = useAlertStore((s) => s.removeAlert);
  const setWsConnected = useSystemStore((s) => s.setWsConnected);
  const setHealth = useSystemStore((s) => s.setHealth);
  const setRadarBeacons = useSystemStore((s) => s.setRadarBeacons);
  const setScenario = useSystemStore((s) => s.setScenario);
  const setVisibility = useAIStore((s) => s.setVisibility);
  const setHotspots = useAIStore((s) => s.setHotspots);
  const setProduction = useAIStore((s) => s.setProduction);
  const addRadarClassification = useAIStore((s) => s.addRadarClassification);
  const setRadarClassifications = useAIStore((s) => s.setRadarClassifications);
  const setNodeHealth = useNodeStore((s) => s.setHealth);
  const setNodeAnomaly = useNodeStore((s) => s.setAnomaly);

  useEffect(() => {
    connectWebSocket();

    // Resync all state from REST on (re)connect. One-shot WS events such as
    // `scenario` can be missed if the socket drops/reconnects at that moment,
    // so every connect we re-pull current state to keep the UI in sync.
    const resync = () => {
      fetchVehicles().then(setVehicles).catch(console.error);
      fetchActiveAlerts().then(setActiveAlerts).catch(console.error);
      fetchHealth().then(setHealth).catch(console.error);
      fetchBeacons().then(setRadarBeacons).catch(console.error);
      fetchVisibility().then(setVisibility).catch(console.error);
      fetchAIHotspots().then(setHotspots).catch(console.error);
      fetchProduction().then(setProduction).catch(console.error);
      fetchRadarAI().then(setRadarClassifications).catch(console.error);
      fetchScenarioStatus().then((s) => setScenario({ name: s.name })).catch(console.error);
      fetchNodeHealth().then(setNodeHealth).catch(console.error);
    };

    const unsub = onMessage((msg) => {
      switch (msg.type) {
        case 'vehicle_update':
          setVehicles(msg.data);
          break;
        case 'alert_new':
          addAlert(msg.data);
          break;
        case 'alert_update':
          if (Array.isArray(msg.data)) {
            setActiveAlerts(msg.data);
          } else {
            updateAlert(msg.data);
          }
          break;
        case 'alert_resolved':
          removeAlert(msg.data.alert_id);
          break;
        case 'system_health':
          setHealth(msg.data);
          break;
        case 'gateway_status':
          setHealth({ ...useSystemStore.getState().health, gateway_status: msg.data.gateway_status });
          break;
        case 'radar_warning':
          console.log('[Radar Warning]', msg.data);
          break;
        case 'scenario':
          setScenario(msg.data);
          break;
        case 'visibility':
          setVisibility(msg.data);
          break;
        case 'hotspots':
          setHotspots(msg.data);
          break;
        case 'production_forecast':
          setProduction(msg.data);
          break;
        case 'radar_ai':
          addRadarClassification(msg.data);
          break;
        case 'node_health':
          setNodeHealth(msg.data);
          break;
        case 'node_anomaly':
          setNodeAnomaly(msg.data);
          break;
        case 'ws_connected':
          setWsConnected(true);
          resync();
          break;
        case 'ws_disconnected':
          setWsConnected(false);
          break;
      }
    });

    // Initial sync on load
    resync();

    return () => {
      unsub();
      disconnectWebSocket();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-cream overflow-hidden">
      <nav className="shrink-0 flex justify-end gap-1 bg-brown px-4 py-2" aria-label="Dashboard view">
        <button
          type="button"
          aria-pressed={view === 'control-room'}
          onClick={() => setView('control-room')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'control-room' ? 'bg-primary text-white' : 'text-cream/75 hover:bg-white/10 hover:text-cream'}`}
        >
          Control Room
        </button>
        <button
          type="button"
          aria-pressed={view === 'driver'}
          onClick={() => setView('driver')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'driver' ? 'bg-primary text-white' : 'text-cream/75 hover:bg-white/10 hover:text-cream'}`}
        >
          Driver View
        </button>
      </nav>
      {view === 'driver' ? (
        <DriverSafetyDashboard />
      ) : (
        <>
          <Header />
          <MainLayout />
        </>
      )}
    </div>
  );
}
