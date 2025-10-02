Plugins.ais_overlay.no_css = true;

// Initialize the plugin
Plugins.ais_overlay.init = async function () {

    setTimeout(function () {

        var vesselLayer = L.layerGroup().addTo(map);

        // Cache for vessel trails
        var vesselCache = {};  // MMSI -> array of {lat, lon, timestamp}
        var closeTimers = {}; // store timers per vessel

        function getBoatIcon(isMoving, mmsi) {
            // Special buoys for specific MMSI
            if (mmsi === 992371913 || mmsi === 992371821) {
                return L.icon({
                    iconUrl: '/static/plugins/map/ais_overlay/buoy.png',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }
            // Normal boat icons
            return L.icon({
                iconUrl: isMoving
                    ? '/static/plugins/map/ais_overlay/boat.png'
                    : '/static/plugins/map/ais_overlay/boat_black.png',
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });
        }

        // Draw trail from cached positions
        function drawTrail(trail) {
            if (!trail || trail.length < 2) return null;

            const now = Date.now() / 1000;
            let segments = [];

            for (let i = 1; i < trail.length; i++) {
                const p1 = trail[i - 1];
                const p2 = trail[i];
                const age = now - p2.timestamp;
                const alpha = Math.max(0.1, 1 - age / 1200); // fade over 20 min

                const seg = L.polyline(
                    [[p1.lat, p1.lon], [p2.lat, p2.lon]],
                    { color: "blue", weight: 3, opacity: alpha }
                );
                segments.push(seg);
            }
            return L.layerGroup(segments);
        }

        function updateVessel(data) {
            if (!data.lat || !data.lon) return;

            var isMoving = data.sog && data.sog > 0;

            // --- Update cache ---
            const now = Date.now() / 1000;
            if (!vesselCache[data.mmsi]) vesselCache[data.mmsi] = [];
            vesselCache[data.mmsi].push({
                lat: data.lat,
                lon: data.lon,
                timestamp: now
            });

            // Keep only last 20 minutes of positions
            const cutoff = now - 1200;
            vesselCache[data.mmsi] = vesselCache[data.mmsi].filter(p => p.timestamp > cutoff);

            // --- Marker popup (original full info) ---
            var popup = `
                <b>${data.name || "Unknown Vessel"}</b><br>
                MMSI: <a href="https://www.vesselfinder.com/vessels/details/${data.mmsi}" target="_blank">
                    ${data.mmsi}
                </a><br>
                Callsign: ${data.callsign || "-"}<br>
                Type: ${data.ship_type_text || "-"}<br>
                Destination: ${data.destination || "-"}<br>
                Speed: ${data.sog != null ? data.sog + " kn" : "-"}<br>
                Course: ${data.cog != null ? data.cog + "°" : "-"}
            `;

            var marker = L.marker([data.lat, data.lon], {
                icon: getBoatIcon(isMoving, data.mmsi),
                rotationAngle: data.cog || 0
            }).bindPopup(popup);

            // --- Auto-open popup on hover with 2s delayed close ---
            marker.on("mouseover", function () {
                if (closeTimers[data.mmsi]) {
                    clearTimeout(closeTimers[data.mmsi]);
                    closeTimers[data.mmsi] = null;
                }
                this.openPopup();
            });
            marker.on("mouseout", function () {
                closeTimers[data.mmsi] = setTimeout(() => {
                    this.closePopup();
                }, 2000); // delay close by 2 seconds
            });

            // --- Draw trail ---
            var trailLayer = drawTrail(vesselCache[data.mmsi]);
            if (trailLayer) vesselLayer.addLayer(trailLayer);

            vesselLayer.addLayer(marker);
        }

        function fetchAIS() {
            fetch("http://192.168.10.201:8081/ais/data.json")
                .then(r => r.json())
                .then(vessels => {
                    vesselLayer.clearLayers();
                    vessels.forEach(updateVessel);
                })
                .catch(err => console.error("Error fetching AIS:", err));
        }

        // Add to extra layers menu
        $('#openwebrx-map-extralayers').append(
            $('<label><input type="checkbox" ' +
                'name="ais_overlay" ' +
                'idx="5" ' +
                'id="openwebrx-map-layer-ais-trails" checked>AIS Reciever Overlay</label>')
                .on('change', function (e) {
                    if (e.target.checked) map.addLayer(vesselLayer);
                    else map.removeLayer(vesselLayer);
                })
        );

        fetchAIS();
        setInterval(fetchAIS, 5000);

    }, 1000);

    // return true, to indicate the plugin is loaded correctly
    return true;
}
