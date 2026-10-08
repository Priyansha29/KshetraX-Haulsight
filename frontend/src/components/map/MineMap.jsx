import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { fetchRoadGraph } from '../../api/client';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useSystemStore } from '../../stores/systemStore';
import { useNodeStore } from '../../stores/nodeStore';
import VehicleMarker from './VehicleMarker';
import RadarBeaconMarker from './RadarBeaconMarker';
import HotspotLayer from './HotspotLayer';

const MINE_CENTER = [22.2540, 85.8360];
const DEFAULT_ZOOM = 15;

const NODE_HEALTH_COLOR = {
  WARNING: '#F59E0B',
  CRITICAL: '#DC2626',
};

function MapUpdater({ vehicles }) {
  const map = useMap();
  return null;
}

export default function MineMap({
  myVehicleId = null,
  conflictVehicleId = null,
  conflictSeverity = null,
  highlightSegmentIds = [],
}) {
  const [roadGraph, setRoadGraph] = useState({ nodes: [], segments: [] });
  const vehicles = useVehicleStore((s) => s.vehicles);
  const radarBeacons = useSystemStore((s) => s.radarBeacons);
  const nodeHealth = useNodeStore((s) => s.nodeHealth);

  useEffect(() => {
    fetchRoadGraph().then(setRoadGraph).catch(console.error);
  }, []);

  const highlightedSegments = useMemo(() => {
    const segmentIds = new Set(
      highlightSegmentIds.filter((segmentId) =>
        segmentId && roadGraph.segments.some((segment) => segment.segment_id === segmentId),
      ),
    );

    return roadGraph.segments.filter((segment) => segmentIds.has(segment.segment_id));
  }, [highlightSegmentIds, roadGraph.segments]);

  const nodeStatusById = (nodeId) => {
    const rec = nodeHealth.find((n) => n.node_id === nodeId);
    return rec?.status || 'NORMAL';
  };

  const segmentColor = (seg) => {
    if (!seg.is_active) return '#9CA3AF';
    if (seg.blind_corner) return '#E76F2E';
    return '#3E2C23';
  };

  return (
    <MapContainer
      center={MINE_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Road segments */}
      {roadGraph.segments.map((seg) => (
        <Polyline
          key={seg.segment_id}
          positions={[
            [seg.start_lat, seg.start_lon],
            [seg.end_lat, seg.end_lon],
          ]}
          pathOptions={{
            color: segmentColor(seg),
            weight: seg.blind_corner ? 5 : 3,
            dashArray: seg.blind_corner ? '8, 6' : null,
            opacity: seg.is_active ? 0.9 : 0.4,
          }}
        >
          <Popup>
            <div className="text-sm font-sans">
              <strong>{seg.segment_id}</strong><br />
              Speed limit: {seg.speed_limit} km/h<br />
              Width: {seg.width}m · Gradient: {seg.gradient}%<br />
              {seg.blind_corner && <span className="text-orange font-semibold">Blind corner</span>}
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Driver-focus road segments */}
      {highlightedSegments.map((seg) => (
        <Polyline
          key={`driver-focus-${seg.segment_id}`}
          positions={[
            [seg.start_lat, seg.start_lon],
            [seg.end_lat, seg.end_lon],
          ]}
          pathOptions={{
            color: '#2FA4D7',
            weight: 8,
            opacity: 0.95,
            dashArray: seg.blind_corner ? '8, 4' : null,
          }}
          zIndexOffset={1200}
        />
      ))}

      {/* Blind corner zones */}
      {roadGraph.segments
        .filter((s) => s.blind_corner)
        .map((seg) => {
          const centerLat = (seg.start_lat + seg.end_lat) / 2;
          const centerLon = (seg.start_lon + seg.end_lon) / 2;
          return (
            <CircleMarker
              key={`zone-${seg.segment_id}`}
              center={[centerLat, centerLon]}
              radius={25}
              pathOptions={{
                color: '#E76F2E',
                fillColor: '#E76F2E',
                fillOpacity: 0.1,
                weight: 1,
                dashArray: '4, 4',
              }}
            />
          );
        })}

      {/* Node markers (colored by node health monitor) */}
      {roadGraph.nodes.map((node) => {
        const status = nodeStatusById(node.node_id);
        const healthColor = NODE_HEALTH_COLOR[status];
        const baseColor = healthColor || (node.node_type === 'blind_corner' ? '#E76F2E' : '#3E2C23');
        return (
          <Fragment key={`node-${node.node_id}`}>
            {status === 'CRITICAL' && (
              <CircleMarker
                center={[node.latitude, node.longitude]}
                radius={10}
                pathOptions={{
                  color: '#DC2626',
                  weight: 2,
                  fill: false,
                  opacity: 0.75,
                  className: 'vehicle-critical-ring',
                }}
              />
            )}
            <CircleMarker
              center={[node.latitude, node.longitude]}
              radius={status === 'CRITICAL' ? 6 : 4}
              pathOptions={{
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: 0.9,
                className: status === 'CRITICAL' ? 'vehicle-marker-cicle' : '',
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{node.name || node.node_id}</strong><br />
                  Type: {node.node_type}<br />
                  {status !== 'NORMAL' && (
                    <span className={status === 'CRITICAL' ? 'text-critical font-semibold' : 'text-warning font-semibold'}>
                      Health: {status}
                    </span>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}

      {/* Radar beacons */}
      {radarBeacons.map((beacon) => (
        <RadarBeaconMarker key={beacon.beacon_id} beacon={beacon} />
      ))}

      {/* Vehicle markers */}
      {vehicles
        .filter((v) => v.latitude !== 0 && v.longitude !== 0)
        .map((vehicle) => {
          const isMyVehicle = myVehicleId && vehicle.vehicle_id === myVehicleId;
          const isConflictVehicle = conflictVehicleId && vehicle.vehicle_id === conflictVehicleId;
          return (
            <VehicleMarker
              key={vehicle.vehicle_id}
              vehicle={vehicle}
              emphasis={isMyVehicle ? 'my-vehicle' : isConflictVehicle ? 'conflict' : 'none'}
              severity={isConflictVehicle ? conflictSeverity || vehicle.risk_level : vehicle.risk_level}
            />
          );
        })}

      {/* AI risk-hotspot layer */}
      <HotspotLayer segments={roadGraph.segments} />

      <MapUpdater vehicles={vehicles} />
    </MapContainer>
  );
}
