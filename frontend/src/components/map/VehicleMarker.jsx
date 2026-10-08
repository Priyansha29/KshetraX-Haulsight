import { CircleMarker, Popup } from 'react-leaflet';
import { RISK_COLORS, STATE_COLORS } from '../../styles/theme';

const SIZE_MAP = {
  SAFE: 11,
  CAUTION: 13,
  WARNING: 15,
  CRITICAL: 17,
};

export default function VehicleMarker({ vehicle, emphasis = 'none', severity = vehicle.risk_level }) {
  const riskColor = RISK_COLORS[severity || vehicle.risk_level] || RISK_COLORS.SAFE;
  const stateColor = STATE_COLORS[vehicle.state] || STATE_COLORS.UNKNOWN;
  const size = SIZE_MAP[severity || vehicle.risk_level] || 11;
  const isCritical = (severity || vehicle.risk_level) === 'CRITICAL';
  const isMyVehicle = emphasis === 'my-vehicle';
  const isConflictVehicle = emphasis === 'conflict';

  const renderDefaultMarker = () => (
    <>
      {isCritical && (
        <CircleMarker
          center={[vehicle.latitude, vehicle.longitude]}
          radius={size + 7}
          className="vehicle-critical-ring"
          pathOptions={{
            color: riskColor,
            fill: false,
            weight: 3,
            opacity: 0.6,
          }}
        />
      )}
      <CircleMarker
        center={[vehicle.latitude, vehicle.longitude]}
        radius={size}
        className="vehicle-marker-cicle"
        pathOptions={{
          color: '#fff',
          fillColor: riskColor,
          fillOpacity: 0.95,
          weight: isCritical ? 3 : 2,
        }}
      >
        <Popup>
          <div className="text-sm min-w-[180px] font-sans">
            <div className="font-bold text-base mb-0.5">{vehicle.vehicle_id}</div>
            <div className="text-xs text-gray-500 mb-2 capitalize">
              {vehicle.vehicle_type || 'Vehicle'} · {vehicle.is_equipped ? 'Equipped' : 'Radar-only'}
            </div>

            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-gray-500">State</span>
              <span className="font-semibold capitalize" style={{ color: stateColor }}>{vehicle.state}</span>

              <span className="text-gray-500">Speed</span>
              <span>{vehicle.speed != null ? `${vehicle.speed.toFixed(1)} km/h` : '—'}</span>

              <span className="text-gray-500">GPS</span>
              <span className={vehicle.gps_quality === 'poor' ? 'text-orange font-semibold' : 'capitalize'}>
                {vehicle.gps_quality || '—'}
              </span>

              <span className="text-gray-500">Risk</span>
              <span className="font-bold" style={{ color: riskColor }}>{severity || vehicle.risk_level}</span>

              <span className="text-gray-500">Segment</span>
              <span>{vehicle.current_segment || 'N/A'}</span>
            </div>

            {vehicle.risk_reason && (
              <div className="mt-2 text-xs bg-orange/10 p-2 rounded border border-orange/20">
                {vehicle.risk_reason}
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </>
  );

  if (!isMyVehicle && !isConflictVehicle) {
    return renderDefaultMarker();
  }

  const outerColor = isMyVehicle ? '#2FA4D7' : riskColor;
  const outerRadius = isMyVehicle ? size + 8 : size + 9;
  const innerRadius = isMyVehicle ? size + 2 : size + 5;

  return (
    <>
      <CircleMarker
        center={[vehicle.latitude, vehicle.longitude]}
        radius={outerRadius}
        className={isConflictVehicle ? 'vehicle-critical-ring' : ''}
        zIndexOffset={isMyVehicle ? 1000 : 900}
        pathOptions={{
          color: outerColor,
          fill: false,
          weight: isMyVehicle ? 3 : 3,
          opacity: isMyVehicle ? 0.9 : 0.75,
        }}
      />
      <CircleMarker
        center={[vehicle.latitude, vehicle.longitude]}
        radius={innerRadius}
        className="vehicle-marker-cicle"
        zIndexOffset={isMyVehicle ? 1100 : 950}
        pathOptions={{
          color: '#fff',
          fillColor: isMyVehicle ? '#2FA4D7' : riskColor,
          fillOpacity: 0.98,
          weight: 3,
        }}
      >
        <Popup>
          <div className="text-sm min-w-[180px] font-sans">
            <div className="font-bold text-base mb-0.5">{vehicle.vehicle_id}</div>
            <div className="text-xs text-gray-500 mb-2 capitalize">
              {vehicle.vehicle_type || 'Vehicle'} · {vehicle.is_equipped ? 'Equipped' : 'Radar-only'}
            </div>

            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-gray-500">State</span>
              <span className="font-semibold capitalize" style={{ color: stateColor }}>{vehicle.state}</span>

              <span className="text-gray-500">Speed</span>
              <span>{vehicle.speed != null ? `${vehicle.speed.toFixed(1)} km/h` : '—'}</span>

              <span className="text-gray-500">GPS</span>
              <span className={vehicle.gps_quality === 'poor' ? 'text-orange font-semibold' : 'capitalize'}>
                {vehicle.gps_quality || '—'}
              </span>

              <span className="text-gray-500">Risk</span>
              <span className="font-bold" style={{ color: riskColor }}>{severity || vehicle.risk_level}</span>

              <span className="text-gray-500">Segment</span>
              <span>{vehicle.current_segment || 'N/A'}</span>
            </div>

            {vehicle.risk_reason && (
              <div className="mt-2 text-xs bg-orange/10 p-2 rounded border border-orange/20">
                {vehicle.risk_reason}
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}
