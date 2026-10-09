from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import get_config
from ..models import TelemetryPacket, VehicleResponse, VehicleProfile, VehicleType
from ..state import vehicle_store
from ..database import get_db
from ..services.road_graph import road_graph, haversine

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])


@router.post("")
async def ingest_telemetry(packet: TelemetryPacket) -> dict[str, Any]:
    config = get_config()
    db = await get_db()

    # Check for duplicate message_id
    cursor = await db.execute(
        "SELECT id FROM telemetry_log WHERE message_id = ?", (packet.message_id,)
    )
    if await cursor.fetchone():
        return {"status": "duplicate", "message_id": packet.message_id}

    # Get current state to check for GPS jumps
    current = await vehicle_store.get(packet.vehicle_id)
    if current and current.latitude != 0 and current.longitude != 0:
        dist = haversine(current.latitude, current.longitude, packet.latitude, packet.longitude)
        if dist > config["gps_jump_max_meters"] and current.state.value != "UNKNOWN":
            return {
                "status": "rejected",
                "reason": f"GPS jump detected: {dist:.0f}m from last position",
                "message_id": packet.message_id,
            }

    # Check for out-of-order packets
    if current and current.last_sequence >= packet.sequence_number:
        return {
            "status": "rejected",
            "reason": "Out-of-order packet",
            "message_id": packet.message_id,
        }

    # Find nearest road segment
    seg, seg_dist = road_graph.find_nearest_segment(packet.latitude, packet.longitude)

    now = datetime.utcnow()

    # Update in-memory state
    from ..models import VehicleStateRecord, VehicleState, GpsQuality
    gps_quality = packet.gps_quality
    state = VehicleState.LIVE
    if gps_quality == GpsQuality.POOR:
        state = VehicleState.DEGRADED
    elif gps_quality == GpsQuality.INVALID:
        state = VehicleState.DEGRADED

    record = VehicleStateRecord(
        vehicle_id=packet.vehicle_id,
        state=state,
        latitude=packet.latitude,
        longitude=packet.longitude,
        speed=packet.speed,
        heading=packet.heading,
        gps_quality=gps_quality,
        current_segment=seg.segment_id if seg else None,
        last_seen=now,
        last_sequence=packet.sequence_number,
    )

    # Preserve vehicle_type from existing record
    if current:
        record.vehicle_type = current.vehicle_type
        record.is_equipped = current.is_equipped
    else:
        # New vehicle — check DB or create default
        cursor = await db.execute(
            "SELECT vehicle_type, is_equipped FROM vehicles WHERE vehicle_id = ?",
            (packet.vehicle_id,),
        )
        row = await cursor.fetchone()
        if row:
            record.vehicle_type = VehicleType(row[0])
            record.is_equipped = bool(row[1])
        else:
            await db.execute(
                "INSERT OR IGNORE INTO vehicles (vehicle_id) VALUES (?)",
                (packet.vehicle_id,),
            )

    await vehicle_store.upsert(record)

    # Log to database
    await db.execute(
        """INSERT INTO telemetry_log
           (vehicle_id, latitude, longitude, speed, heading, gps_quality, message_id, sequence_number, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (packet.vehicle_id, packet.latitude, packet.longitude, packet.speed,
         packet.heading, gps_quality.value, packet.message_id, packet.sequence_number, now.isoformat()),
    )
    await db.commit()

    return {"status": "ok", "segment": seg.segment_id if seg else None}


@router.post("/batch")
async def ingest_batch(packets: list[TelemetryPacket]) -> dict[str, Any]:
    results = []
    for p in packets:
        r = await ingest_telemetry(p)
        results.append(r)
    return {"processed": len(results), "results": results}
