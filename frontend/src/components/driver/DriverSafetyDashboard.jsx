import { useState } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { useAlertStore } from '../../stores/alertStore';
import MineMap from '../map/MineMap';

const STATUS_STYLES = {
  CRITICAL: 'border-critical/30 bg-critical/10 text-critical',
  WARNING: 'border-warning/30 bg-warning/10 text-warning',
  CAUTION: 'border-caution/30 bg-caution/10 text-caution',
  SAFE: 'border-healthy/30 bg-healthy/10 text-healthy',
};

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function getDistanceMeters(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return 2 * EARTH_RADIUS_METERS * Math.atan2(
    Math.sqrt(boundedHaversine),
    Math.sqrt(1 - boundedHaversine),
  );
}

function getBearingDegrees(first, second) {
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(secondLatitude);
  const x =
    Math.cos(firstLatitude) * Math.sin(secondLatitude) -
    Math.sin(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getRelativeDirection(bearing, heading) {
  const difference = ((bearing - heading + 540) % 360) - 180;
  const absoluteDifference = Math.abs(difference);

  if (absoluteDifference <= 45) return 'AHEAD';
  if (absoluteDifference >= 135) return 'BEHIND';
  return difference > 0 ? 'RIGHT' : 'LEFT';
}

function hasValidPosition(vehicle) {
  return Number.isFinite(vehicle.latitude) &&
    Number.isFinite(vehicle.longitude) &&
    Math.abs(vehicle.latitude) <= 90 &&
    Math.abs(vehicle.longitude) <= 180;
}

function isCurrentVehicle(vehicle) {
  const state = vehicle.state?.toUpperCase();
  return state !== 'STALE' && state !== 'OFFLINE';
}

function formatDistance(distanceMeters) {
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}

export default function DriverSafetyDashboard() {
  const vehicles = useVehicleStore((state) => state.vehicles);
  const activeAlerts = useAlertStore((state) => state.activeAlerts);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.vehicle_id === selectedVehicleId) || vehicles[0];
  const closestAlertPair = selectedVehicle &&
    hasValidPosition(selectedVehicle) &&
    isCurrentVehicle(selectedVehicle)
    ? activeAlerts
        .flatMap((alert) => (
          alert.vehicle_ids?.includes(selectedVehicle.vehicle_id)
            ? alert.vehicle_ids
                .filter((vehicleId) => vehicleId !== selectedVehicle.vehicle_id)
                .map((vehicleId) => ({
                  alert,
                  vehicle: vehicles.find((candidate) =>
                    candidate.vehicle_id === vehicleId &&
                    isCurrentVehicle(candidate) &&
                    hasValidPosition(candidate),
                  ),
                }))
            : []
        ))
        .filter((pair) => pair.vehicle)
        .map((pair) => ({
          ...pair,
          distanceMeters: getDistanceMeters(selectedVehicle, pair.vehicle),
        }))
        .reduce((closest, candidate) => (
          !closest || candidate.distanceMeters < closest.distanceMeters ? candidate : closest
        ), null)
    : null;
  const closestVehicle = !closestAlertPair &&
    selectedVehicle &&
    hasValidPosition(selectedVehicle) &&
    isCurrentVehicle(selectedVehicle)
    ? vehicles
        .filter((vehicle) =>
          vehicle.vehicle_id !== selectedVehicle.vehicle_id &&
          isCurrentVehicle(vehicle) &&
          hasValidPosition(vehicle),
        )
        .map((vehicle) => ({
          vehicle,
          distanceMeters: getDistanceMeters(selectedVehicle, vehicle),
        }))
        .reduce((closest, candidate) => (
          !closest || candidate.distanceMeters < closest.distanceMeters ? candidate : closest
        ), null)
    : null;
  const activeAlert = closestAlertPair?.alert || null;
  const otherVehicle = closestAlertPair?.vehicle || (
    closestVehicle?.distanceMeters <= 20 ? closestVehicle.vehicle : null
  );
  const otherVehicleId = otherVehicle?.vehicle_id;
  const hasRelevantPositions = selectedVehicle && otherVehicle &&
    isCurrentVehicle(selectedVehicle) &&
    isCurrentVehicle(otherVehicle) &&
    hasValidPosition(selectedVehicle) &&
    hasValidPosition(otherVehicle);
  const hasValidHeading = hasRelevantPositions &&
    Number.isFinite(selectedVehicle.heading) &&
    selectedVehicle.heading >= 0 &&
    selectedVehicle.heading < 360;
  const distanceMeters = hasRelevantPositions
    ? getDistanceMeters(selectedVehicle, otherVehicle)
    : null;
  const status = Number.isFinite(distanceMeters)
    ? distanceMeters <= 10
      ? 'CRITICAL'
      : distanceMeters <= 20
        ? 'WARNING'
        : 'SAFE'
    : 'SAFE';
  const direction = hasValidHeading && distanceMeters > 0
    ? getRelativeDirection(getBearingDegrees(selectedVehicle, otherVehicle), selectedVehicle.heading)
    : null;
  const driverFocusSegmentIds = otherVehicle
    ? [selectedVehicle?.current_segment, otherVehicle?.current_segment].filter((segmentId) => Boolean(segmentId))
    : [];

  return (
    <main className="flex flex-1 min-h-0 flex-col gap-4 p-4 md:p-6">
      <section className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brown/50">Driver View</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-brown/60">My Vehicle</p>
          <h1 className="text-2xl font-bold text-brown">
            {selectedVehicle?.vehicle_id || 'Waiting for vehicle data'}
          </h1>
        </div>

        <label className="flex min-w-48 flex-col gap-1 text-xs font-semibold text-brown/70">
          Vehicle
          <select
            value={selectedVehicle?.vehicle_id || ''}
            onChange={(event) => setSelectedVehicleId(event.target.value)}
            disabled={vehicles.length === 0}
            className="min-h-10 border border-cream-dark bg-white px-3 text-sm text-brown disabled:text-brown/40"
          >
            {vehicles.length === 0 ? (
              <option value="">Waiting for vehicle data</option>
            ) : (
              vehicles.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                  {vehicle.vehicle_id}
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      <section
        className="flex flex-1 min-h-0 overflow-hidden border border-cream-dark bg-white/40"
        aria-label="Mine map"
      >
        <div className="h-full w-full">
          <MineMap
            myVehicleId={selectedVehicle?.vehicle_id || null}
            conflictVehicleId={otherVehicleId || null}
            conflictSeverity={otherVehicleId ? status : null}
            highlightSegmentIds={driverFocusSegmentIds}
          />
        </div>
      </section>

      <footer
        className={`flex min-h-14 shrink-0 items-center gap-3 border px-4 ${STATUS_STYLES[status] || STATUS_STYLES.WARNING}`}
        role="status"
      >
        <span className="text-lg" aria-hidden="true">{status === 'SAFE' ? '✓' : '!'}</span>
        <span className="font-bold tracking-wide">
          {selectedVehicle ? status : 'WAITING FOR VEHICLE'}
        </span>
        {selectedVehicle && Number.isFinite(distanceMeters) && status === 'SAFE' && (
          <span className="text-sm">No immediate collision risk</span>
        )}
        {selectedVehicle && Number.isFinite(distanceMeters) && status === 'WARNING' && (
          <span className="text-sm">
            Vehicle {otherVehicleId} · {formatDistance(distanceMeters)} · {direction || 'Direction unavailable'} · Maintain safe separation
          </span>
        )}
        {selectedVehicle && Number.isFinite(distanceMeters) && status === 'CRITICAL' && (
          <span className="text-sm">
            Vehicle {otherVehicleId} · {formatDistance(distanceMeters)} · {direction || 'Direction unavailable'} · Immediate collision risk — reduce speed
          </span>
        )}
        {selectedVehicle && !Number.isFinite(distanceMeters) && (
          <span className="text-sm">
            {activeAlert ? 'Vehicle data unavailable' : 'No immediate collision risk'}
          </span>
        )}
      </footer>
    </main>
  );
}