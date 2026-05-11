/**
 * LOGIC FRETE - Maps Integration (MapLibre GL JS + Nominatim + OSRM)
 * High performance vector maps.
 */

 const MapService = {
    map: null,
    markers: [],
    routeLayerId: 'route-line',
    routeSourceId: 'route-source',
    
    // Default config
    defaultCenter: [-46.6333, -23.5505], // São Paulo (MapLibre uses [lng, lat])
    defaultZoom: 12,

    // Available themes (OpenFreeMap & MapLibre compatible)
    themes: {
      dark: 'https://tiles.openfreemap.org/styles/dark',
      light: 'https://tiles.openfreemap.org/styles/liberty',
      satellite: 'https://tiles.openfreemap.org/styles/bright' // OpenFreeMap doesn't have true satellite, using Bright as fallback or a custom raster style
    },
  
    init(containerId) {
      if (!document.getElementById(containerId) || this.map) return;
  
      this.map = new maplibregl.Map({
        container: containerId,
        style: this.themes.light, // Default to light mode
        center: this.defaultCenter,
        zoom: this.defaultZoom,
        attributionControl: false
      });
  
      this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      
      this.map.on('load', () => {
        this.locateUser();
      });
    },
  
    setBaseLayer(themeName) {
      if (!this.map || !this.themes[themeName]) return;
      this.map.setStyle(this.themes[themeName]);
    },

    toggleTraffic() {
      if (!this.map) return false;

      const trafficSourceId = 'google-traffic-source';
      const trafficLayerId = 'google-traffic-layer';

      if (this.map.getLayer(trafficLayerId)) {
        this.map.removeLayer(trafficLayerId);
        this.map.removeSource(trafficSourceId);
        return false;
      } else {
        // Add Google Traffic Raster Source
        this.map.addSource(trafficSourceId, {
          type: 'raster',
          tiles: [
            'https://mt1.google.com/vt?lyrs=h,traffic&x={x}&y={y}&z={z}'
          ],
          tileSize: 256
        });

        this.map.addLayer({
          id: trafficLayerId,
          type: 'raster',
          source: trafficSourceId,
          paint: {
            'raster-opacity': 0.7
          }
        });
        return true;
      }
    },
  
    locateUser() {
      if (!this.map) return;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          this.map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 14
          });
        });
      }
    },
  
    clearMap() {
      if (!this.map) return;
      // Remove all markers
      this.markers.forEach(m => m.remove());
      this.markers = [];
      
      // Remove route layer
      if (this.map.getLayer(this.routeLayerId)) {
        this.map.removeLayer(this.routeLayerId);
      }
      if (this.map.getSource(this.routeSourceId)) {
        this.map.removeSource(this.routeSourceId);
      }
    },
  
    // Manual Routing via OSRM + GeoJSON
    async drawRoute(origin, stops, onComplete) {
      if (!this.map || !origin) return;
      this.clearMap();
  
      // Add origin marker
      this.createMarker(origin.lat, origin.lng, 'O', 'planned', true).setPopup(new maplibregl.Popup().setText('Origem: ' + origin.address));
  
      if (!stops || stops.length === 0) {
        this.map.flyTo({ center: [origin.lng, origin.lat], zoom: 14 });
        return;
      }
  
      // Add stop markers
      stops.forEach((s, i) => {
        this.createMarker(s.lat, s.lng, i + 1, s.status)
            .setPopup(new maplibregl.Popup().setText(`${s.recipient}\n${s.address}`));
      });
  
      // Build OSRM coordinates string: lng,lat;lng,lat...
      const coords = [
        [origin.lng, origin.lat],
        ...stops.map(s => [s.lng, s.lat])
      ].map(c => c.join(',')).join(';');
  
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
  
        if (data.code === 'Ok') {
          const route = data.routes[0];
          const geometry = route.geometry;
  
          // Add route to map
          this.map.addSource(this.routeSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: geometry
            }
          });
  
          this.map.addLayer({
            id: this.routeLayerId,
            type: 'line',
            source: this.routeSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.75
            }
          });
  
          // Fit map to route
          const coordinates = geometry.coordinates;
          const bounds = coordinates.reduce((acc, coord) => {
            return acc.extend(coord);
          }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
  
          this.map.fitBounds(bounds, { padding: 50 });
  
          if (onComplete) {
            const distKm = (route.distance / 1000).toFixed(1);
            const timeMin = Math.round(route.duration / 60);
            onComplete(distKm, timeMin);
          }
        }
      } catch (err) {
        console.error("Routing error:", err);
      }
    },
  
    // Geocoding via Nominatim API
    async searchAddress(query) {
      if (!query || query.length < 3) return [];
      
      try {
        // Switching to ArcGIS World Geocoding Service
        // This engine is vastly superior for Brazilian addresses, especially for specific house numbers
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&sourceCountry=BRA&maxLocations=10&outFields=Match_addr,StAddr,Nbrhd,City,Region`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data || !data.candidates || data.candidates.length === 0) return [];

        return data.candidates.map(item => {
          // ArcGIS returns a beautifully formatted address in Match_addr
          // Example: "Rua Augusta, 1000, Consolação, São Paulo, 01305-100"
          let display = item.address;
          
          // Clean up the string to match the requested format: Rua, Número - Bairro, Cidade
          if (item.attributes) {
            const stAddr = item.attributes.StAddr || ''; // Street + Number
            const nbrhd = item.attributes.Nbrhd || '';   // Neighborhood
            const city = item.attributes.City || '';     // City
            const region = item.attributes.Region || ''; // State
            
            let customDisplay = stAddr;
            if (nbrhd) customDisplay += ` - ${nbrhd}`;
            if (city) customDisplay += `, ${city}`;
            if (region) customDisplay += ` (${region})`;
            
            if (customDisplay.length > 5) {
                display = customDisplay;
            }
          }

          return {
            address: display,
            lat: item.location.y,
            lng: item.location.x
          };
        });
      } catch (err) {
        console.error("ArcGIS Geocoding error:", err);
        return [];
      }
    },
  
    createMarker(lat, lng, number, status = 'planned', isOrigin = false) {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      const pinClass = isOrigin ? 'marker-origin' : `marker-${status}`;
      el.innerHTML = `
        <div class="marker-pin ${pinClass}"></div>
        <i class="${isOrigin ? 'ri-map-pin-user-fill' : ''}">${isOrigin ? '' : number}</i>
      `;
  
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(this.map);
        
      this.markers.push(marker);
      return marker;
    },
  
    fitAll() {
      if (this.markers.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      this.markers.forEach(m => bounds.extend(m.getLngLat()));
      this.map.fitBounds(bounds, { padding: 80 });
    }
  };
