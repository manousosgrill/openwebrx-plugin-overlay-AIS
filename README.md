This is a pluing for openwebrx to overlay local AIS data from marine traffic local reciever.

<img width="846" height="587" alt="image" src="https://github.com/user-attachments/assets/6f10638d-9990-4e38-ba06-a28d2cce56d6" />



1. Data must be in this format : 
[
  {
    "mmsi": 219825000,
    "last_seen": 1759422209.19298,
    "lat": 35.49165,
    "lon": 24.086483,
    "sog": 4.7,
    "cog": 281.8,
    "name": "BRITANNIA SEAWAYS",
    "callsign": "OZTS2",
    "ship_type": 79,
    "ship_type_text": "Unknown",
    "destination": "SOUDA BAY",
    "imo": 9153032
  },
  {
    "mmsi": 241698000,
    "last_seen": 1759422206.87291,
    "lat": 35.496293,
    "lon": 24.139698,
    "sog": 0,
    "cog": 6.1,
    "name": "AKTOR",
    "callsign": "SVA9768",
    "ship_type": 52,
    "ship_type_text": "Tug",
    "destination": "SOUDA    H",
    "imo": 8811285
  }
]  



2. Files go in map folder of openwebrx in my ubuntu system it is on

   /usr/lib/python3/dist-packages/htdocs/plugins/map/ais_overlay/

   in ais_overlay folder we put the files.


   consult https://github.com/0xAF/openwebrxplus-plugins for more info.

3. In order for the ships to be able to show an angle you must edit the file:
   /usr/lib/python3/dist-packages/htdocs# cd /usr/lib/python3/dist-packages/htdocs/map-leaflet.js


   find the lines that are like this:

        await $.getScript('https://cdn.jsdelivr.net/npm/leaflet.geodesic');
        await $.getScript('https://cdn.jsdelivr.net/npm/leaflet-textpath@1.2.3/leaflet.textpath.min.js');

        and add under
        await $.getScript('https://cdn.jsdelivr.net/gh/bbecquet/Leaflet.RotatedMarker/leaflet.rotatedMarker.js');


4. Moving ships will be colorfull and stationary will be blacked out.

5. I have encorporated a buoy icon for known stationary buoy's.

6. If you have a MT reciever and have to push data like i have done then:

6a. setup your reciever to push data to a computer on your network. i have a raspberry pi to do the work
<img width="1267" height="296" alt="image" src="https://github.com/user-attachments/assets/9c3c2c26-3252-4f75-9104-93f719bff72f" />

6b. load the ais_to_openwebrx_map.py python program on your pi and make it a service with ais2openwebrx.service files.
  sudo mv ais2openwebrx.service /etc/systemd/system/
  sudo systemctl enable ais2openwebrx.service

  Run service (will be automatically started on next reboot):

  sudo systemctl start ais2openwebrx.service
   
   if any problems contact me at sv9tnf@gmail.com
   Many 73's !!!
