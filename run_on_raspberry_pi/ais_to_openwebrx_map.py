#!/usr/bin/env python3
import socket
import threading
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pyais import NMEAMessage

# === CONFIG ===
UDP_IP = "0.0.0.0"
UDP_PORT = 11111
HTTP_PORT = 8081
VESSEL_TIMEOUT = 600  # seconds (10 minutes)

# === Ship type mapping (partial) ===
SHIP_TYPE_MAP = {
    0: "Not available",
    20: "Wing in ground",
    30: "Fishing",
    31: "Towing",
    32: "Towing (large)",
    33: "Dredging/Underwater ops",
    34: "Diving ops",
    35: "Military ops",
    36: "Sailing",
    37: "Pleasure craft",
    40: "High-speed craft",
    50: "Pilot vessel",
    51: "SAR vessel",
    52: "Tug",
    53: "Port tender",
    54: "Anti-pollution",
    55: "Law enforcement",
    58: "Medical transport",
    59: "Special craft",
    60: "Passenger ship",
    70: "Cargo ship",
    80: "Tanker",
    90: "Other"
}

# === Vessel storage ===
vessels = {}  # MMSI -> vessel info
lock = threading.Lock()

# === AIS UDP Listener ===
def udp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    print(f"[AIS] Listening for UDP on port {UDP_PORT}...")

    while True:
        data, _ = sock.recvfrom(1024)
        line = data.decode("utf-8", errors="replace").strip()

        try:
            # Parse and decode AIS message (multi-fragment handled internally)
            msg = NMEAMessage.from_string(line)
            decoded = msg.decode()

            mmsi = getattr(decoded, "mmsi", None)
            if not mmsi:
                continue

            with lock:
                vessel = vessels.get(mmsi, {})
                vessel["mmsi"] = mmsi
                vessel["last_seen"] = time.time()

                # --- Position reports ---
                if hasattr(decoded, "lat") and hasattr(decoded, "lon"):
                    vessel["lat"] = decoded.lat
                    vessel["lon"] = decoded.lon
                    vessel["sog"] = getattr(decoded, "speed", None)
                    vessel["cog"] = getattr(decoded, "course", None)

                # --- Static / voyage data ---
                if hasattr(decoded, "shipname"):
                    vessel["name"] = decoded.shipname.strip()
                if hasattr(decoded, "callsign"):
                    vessel["callsign"] = decoded.callsign.strip()
                if hasattr(decoded, "ship_type"):
                    vessel["ship_type"] = decoded.ship_type
                    vessel["ship_type_text"] = SHIP_TYPE_MAP.get(decoded.ship_type, "Unknown")
                if hasattr(decoded, "destination"):
                    vessel["destination"] = decoded.destination.strip()
                if hasattr(decoded, "imo"):
                    vessel["imo"] = decoded.imo

                vessels[mmsi] = vessel

        except Exception as e:
            print("[DECODE ERROR]", e, "RAW:", line)

# === Cleanup Thread (remove old vessels) ===
def cleanup_vessels():
    while True:
        now = time.time()
        with lock:
            stale = [mmsi for mmsi, v in vessels.items() if now - v.get("last_seen", 0) > VESSEL_TIMEOUT]
            for mmsi in stale:
                del vessels[mmsi]
                print(f"[CLEANUP] Removed vessel {mmsi} (no updates in {VESSEL_TIMEOUT} seconds)")
        time.sleep(60)  # check every minute

# === HTTP JSON API ===
class AISHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ais/data.json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")  # Allow CORS
            self.end_headers()
            with lock:
                data = [v for v in vessels.values() if "lat" in v and "lon" in v]
            self.wfile.write(json.dumps(data).encode())
        else:
            self.send_response(404)
            self.end_headers()

def http_server():
    server = HTTPServer(("0.0.0.0", HTTP_PORT), AISHandler)
    print(f"[HTTP] Server running on port {HTTP_PORT}...")
    server.serve_forever()

# === Run listener + cleanup + server ===
if __name__ == "__main__":
    threading.Thread(target=udp_listener, daemon=True).start()
    threading.Thread(target=cleanup_vessels, daemon=True).start()
    http_server()
