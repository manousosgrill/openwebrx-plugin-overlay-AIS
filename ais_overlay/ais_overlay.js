Plugins.ais_overlay.no_css = true;

// Initialize the plugin
Plugins.ais_overlay.init = async function () {

    setTimeout(function () {

        const vesselLayer = L.layerGroup().addTo(map);

        // Caches
        const vesselCache = {};  // MMSI -> array of {lat, lon, timestamp}
        const closeTimers = {};  // MMSI -> timeout IDs

        function getBoatIcon(isMoving, mmsi, shipType, course) {
            const type = shipType ? shipType.toLowerCase() : "";

            // Special buoys
            if (mmsi === 992371913 || mmsi === 992371821) {
                return L.icon({
                    iconUrl: '/static/plugins/map/ais_overlay/buoy.png',
                    iconSize: [22, 22],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }

            function pickIcon(baseName) {
                if (course != null) {
                    if (course >= 0 && course <= 180) {
                        return `/static/plugins/map/ais_overlay/${baseName}2.png`;
                    } else if (course > 180 && course < 360) {
                        return `/static/plugins/map/ais_overlay/${baseName}.png`;
                    }
                }
                return `/static/plugins/map/ais_overlay/${baseName}.png`; // fallback
            }

            if (type.includes("tug")) {
                return L.icon({
                    iconUrl: pickIcon("tug"),
                    iconSize: [22, 22],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }

            if (type.includes("passenger")) {
                return L.icon({
                    iconUrl: pickIcon("passenger"),
                    iconSize: [22, 22],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }

            if (type.includes("cargo")) {
                return L.icon({
                    iconUrl: pickIcon("cargo"),
                    iconSize: [22, 22],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }

            if (type.includes("tanker")) {
                return L.icon({
                    iconUrl: pickIcon("tanker"),
                    iconSize: [22, 22],
                    iconAnchor: [14, 14],
                    popupAnchor: [0, -14]
                });
            }

            // Default boats
            return L.icon({
                iconUrl: pickIcon(isMoving ? "boat" : "boat_black"),
                iconSize: [22, 22],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });
        }

        function drawTrail(trail) {
            if (!trail || trail.length < 2) return null;

            const now = Date.now() / 1000;
            const segments = [];

            for (let i = 1; i < trail.length; i++) {
                const p1 = trail[i - 1];
                const p2 = trail[i];
                const age = now - p2.timestamp;
                const alpha = Math.max(0.1, 1 - age / 1200); // 20 minutes fade

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

            const isMoving = data.sog && data.sog > 0;
            const now = Date.now() / 1000;

            // --- Update cache ---
            if (!vesselCache[data.mmsi]) vesselCache[data.mmsi] = [];
            vesselCache[data.mmsi].push({
                lat: data.lat,
                lon: data.lon,
                timestamp: now
            });

            // Keep last 20 minutes
            const cutoff = now - 1200;
            vesselCache[data.mmsi] = vesselCache[data.mmsi].filter(p => p.timestamp > cutoff);

            // --- Assign custom names for specific MMSIs ---
            let displayName = data.name || "Unknown Vessel";
            if (data.mmsi === 992371913) {
                displayName = "FORACS BUOY 1";
            } else if (data.mmsi === 992371821) {
                displayName = "FORACS BUOY";
            }

            // --- Create marker ---
            const marker = L.marker([data.lat, data.lon], {
                icon: getBoatIcon(isMoving, data.mmsi, data.ship_type_text, data.cog),
                rotationAngle: data.cog || 0
            }).bindPopup(`
                <b>${displayName}</b><br>
                MMSI: <a href="https://www.vesselfinder.com/vessels/details/${data.mmsi}" target="_blank">
                    ${data.mmsi}
                </a><br>
                Callsign: ${data.callsign || "-"}<br>
                Type: ${data.ship_type_text || "-"}<br>
                Destination: ${data.destination || "-"}<br>
                Speed: ${data.sog != null ? data.sog + " kn" : "-"}<br>
                Course: ${data.cog != null ? data.cog + "°" : "-"}
            `);

            // --- Hover popup behavior ---
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
                }, 2000);
            });

            // --- Draw trail ---
            const trailLayer = drawTrail(vesselCache[data.mmsi]);
            if (trailLayer) vesselLayer.addLayer(trailLayer);

            // --- Add marker ---
            vesselLayer.addLayer(marker);
        }

        function updateShipCount(count) {
            const label = document.getElementById("ais-ship-count");
            const checkbox = document.getElementById("openwebrx-map-layer-ais-trails");
            if (label && checkbox) {
                label.textContent = checkbox.checked ? `(${count})` : '';
            }
        }

        function fetchAIS() {
            fetch("http://sv9tnf.ham.gd:8081/ais/data.json")
                .then(r => r.json())
                .then(vessels => {
                    const activeMMSIs = new Set();
                    const now = Date.now() / 1000;

                    vessels.forEach(vessel => {
                        if (!vessel.mmsi) return;
                        activeMMSIs.add(vessel.mmsi);
                    });

                    // Cleanup stale vessels
                    for (const mmsi of Object.keys(vesselCache)) {
                        if (!activeMMSIs.has(parseInt(mmsi))) {
                            delete vesselCache[mmsi];
                            if (closeTimers[mmsi]) {
                                clearTimeout(closeTimers[mmsi]);
                                delete closeTimers[mmsi];
                            }
                        }
                    }

                    // Redraw layer
                    vesselLayer.clearLayers();
                    vessels.forEach(updateVessel);

                    // Update ship count label
                    updateShipCount(activeMMSIs.size);
                })
                .catch(err => console.error("Error fetching AIS:", err));
        }

        // Add checkbox to UI with ship count span
        $('#openwebrx-map-extralayers').append(
            $('<label><input type="checkbox" ' +
                'name="ais_overlay" ' +
                'idx="5" ' +
                'id="openwebrx-map-layer-ais-trails" checked>' +
                'AIS Receiver <span id="ais-ship-count">(0)</span></label>')
                .on('change', function (e) {
                    if (e.target.checked) {
                        map.addLayer(vesselLayer);
                        // Restore ship count display
                        updateShipCount(Object.keys(vesselCache).length);
                    } else {
                        map.removeLayer(vesselLayer);
                        // Hide ship count
                        updateShipCount(0);
                    }
                })
        );

        // Start polling
        fetchAIS();
        setInterval(fetchAIS, 5000);

    }, 1000);

    return true;
};
