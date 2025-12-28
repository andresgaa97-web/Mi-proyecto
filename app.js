// app.js

// CONFIGURACIÓN
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW5keWc5NyIsImEiOiJjbWpwN20zcGoyYjFzM2ZveTIzZ2s5Mm56In0.FsNncSP8DrD6zTXpw0MaEg'; 
let vozActiva = true;
let destino = null; // Coordenadas del destino [longitud, latitud]
let ubicacionActual = null;

// ELEMENTOS DOM
const statusDiv = document.getElementById('status');
const btnVoice = document.getElementById('btn-voice');
const btnStart = document.getElementById('btn-start');
const scene = document.querySelector('a-scene');

// 1. OBTENER UBICACIÓN ACTUAL
if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
        ubicacionActual = [position.coords.longitude, position.coords.latitude];
        statusDiv.innerText = `GPS: ${ubicacionActual[1].toFixed(5)}, ${ubicacionActual[0].toFixed(5)}`;
    }, (err) => {
        console.error("Error GPS:", err);
        alert("Habilita el GPS para usar la app.");
    }, {
        enableHighAccuracy: true
    });
}

// 2. CONFIGURAR VOZ (Web Speech API)
btnVoice.addEventListener('click', () => {
    vozActiva = !vozActiva;
    btnVoice.innerText = vozActiva ? "🔊 Voz: ON" : "🔇 Voz: OFF";
    if (!vozActiva) window.speechSynthesis.cancel();
});

function hablar(texto) {
    if (!vozActiva) return;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES'; // Español
    window.speechSynthesis.speak(utterance);
}

// 3. INICIAR RUTA (Ejemplo estático, podrías añadir inputs para buscar)
btnStart.addEventListener('click', () => {
    if (!ubicacionActual) {
        alert("Esperando señal GPS...");
        return;
    }

    // Ejemplo: Destino fijo (Cámbialo o usa una UI para seleccionar)
    // Coordenadas de ejemplo (Plaza Mayor, Madrid) - CAMBIA ESTO
    const destinoFicticio = [-3.703790, 40.416775]; 
    
    obtenerRuta(ubicacionActual, destinoFicticio);
});

// 4. OBTENER RUTA DE MAPBOX
async function obtenerRuta(inicio, fin) {
    statusDiv.innerText = "Calculando ruta...";
    hablar("Calculando la ruta hacia tu destino.");

    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${inicio[0]},${inicio[1]};${fin[0]},${fin[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const ruta = data.routes[0];
            const pasos = ruta.legs[0].steps;
            const coordenadas = ruta.geometry.coordinates;

            renderizarCaminoAR(coordenadas);
            monitorizarPasos(pasos);
            
            hablar(`Ruta encontrada. La distancia es de ${Math.round(ruta.distance)} metros.`);
        } else {
            alert("No se encontró ruta.");
        }
    } catch (e) {
        console.error(e);
        alert("Error conectando con Mapbox");
    }
}

// 5. RENDERIZAR OBJETOS EN AR
function renderizarCaminoAR(coordenadas) {
    const container = document.getElementById('route-container');
    container.innerHTML = ''; // Limpiar anterior

    // No dibujamos CADA punto porque saturaría el navegador.
    // Dibujamos flechas cada X puntos o en giros clave.
    
    // Simplificación: Dibujar una flecha roja cada 5 puntos de la geometría
    coordenadas.forEach((coord, index) => {
        if (index % 3 !== 0) return; // Saltar algunos puntos para optimizar

        const latitude = coord[1];
        const longitude = coord[0];

        // Crear elemento A-Frame
        const flecha = document.createElement('a-entity');
        
        // Atributo clave de AR.js para ubicar por GPS
        flecha.setAttribute('gps-new-entity-place', `latitude: ${latitude}; longitude: ${longitude}`);
        
        // Geometría visual (Una caja o cono rojo)
        // Nota: Para una flecha real, lo ideal es importar un modelo .gltf
        flecha.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.5; height: 2');
        flecha.setAttribute('material', 'color: red');
        flecha.setAttribute('position', '0 0 0'); // Altura relativa al suelo
        
        // Escalar según distancia (opcional, AR.js lo maneja a veces)
        flecha.setAttribute('scale', '1 1 1');

        container.appendChild(flecha);
    });
}

// 6. MONITORIZAR PASOS E INSTRUCCIONES DE VOZ
function monitorizarPasos(pasos) {
    // Esta función es compleja en producción.
    // Aquí hacemos un loop simple para leer las instrucciones iniciales.
    
    // Lo ideal sería comparar tu GPS actual con el paso siguiente
    // y cuando estés cerca (< 10 metros), leer la instrucción.
    
    let pasoActual = 0;
    
    const intervaloCheck = setInterval(() => {
        if (pasoActual >= pasos.length) {
            clearInterval(intervaloCheck);
            hablar("Has llegado a tu destino.");
            return;
        }

        const paso = pasos[pasoActual];
        const destinoPaso = paso.maneuver.location; // [lon, lat]
        
        // Calcular distancia simple (Fórmula Haversine simplificada o Pitágoras para distancias cortas)
        const dist = distanciaEnMetros(ubicacionActual[1], ubicacionActual[0], destinoPaso[1], destinoPaso[0]);

        statusDiv.innerText = `Siguiente: ${paso.maneuver.instruction} (${Math.round(dist)}m)`;

        // Si estamos cerca del punto de maniobra (ej. 15 metros)
        if (dist < 15) {
            hablar(paso.maneuver.instruction);
            pasoActual++;
        }
    }, 3000); // Chequear cada 3 segundos
}

// Utilidad para calcular distancia
function distanciaEnMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio tierra metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;

}
