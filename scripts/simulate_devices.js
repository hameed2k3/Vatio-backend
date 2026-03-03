const mqtt = require('mqtt');
const axios = require('axios');

const BROKER_URL = 'mqtt://localhost:1883';
const BACKEND_URL = 'http://127.0.0.1:3000/ingestion/devices';
const DISCOVERY_INTERVAL_MS = 10000;
const SIMULATION_INTERVAL_MS = 1000;

let clients = new Map();

async function discoverDevices() {
    try {
        const response = await axios.get(BACKEND_URL);
        const devices = response.data;
        const deviceIds = devices.map(d => d.id);

        console.log(`[Simulator] Discovered ${deviceIds.length} devices from backend`);

        // Remove clients for devices no longer in the list
        for (const [deviceId, clientInfo] of clients.entries()) {
            if (!deviceIds.includes(deviceId)) {
                console.log(`[Simulator] Stopping simulation for ${deviceId}`);
                clearInterval(clientInfo.interval);
                clientInfo.client.end();
                clients.delete(deviceId);
            }
        }

        // Add clients for new devices
        for (const deviceId of deviceIds) {
            if (!clients.has(deviceId)) {
                console.log(`[Simulator] Starting simulation for ${deviceId}`);
                startSimulation(deviceId);
            }
        }
    } catch (error) {
        console.error(`[Simulator] Discovery error: ${error.code || error.message || error}`);
        if (error.code === 'ECONNREFUSED') {
            console.error(`[Simulator] Error: Could not connect to backend at ${BACKEND_URL}. Is the NestJS server running?`);
        }
    }
}

function getLoadFactor() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) return 0.4;
    if (hour >= 10 && hour < 17) return 0.75 + (Math.random() * 0.1);
    if (hour >= 17 && hour < 22) return 0.6;
    return 0.3;
}

function startSimulation(deviceId) {
    const client = mqtt.connect(BROKER_URL, { clientId: `sim_${deviceId}_${Math.random().toString(16).slice(2, 8)}` });

    // Initial State (Indian Standard 3-Phase)
    let state = {
        vln: [230.0, 230.0, 230.0], // Phase-Neutral
        i: [10.0, 10.0, 10.0],     // Phase Current
        pf: [0.95, 0.95, 0.95],    // Phase Power Factor
        freq: 50.0,
        energyKwh: 1500.5,
        lastUpdate: Date.now()
    };

    const interval = setInterval(() => {
        const now = Date.now();
        const dt = (now - state.lastUpdate) / 1000;
        const loadFactor = getLoadFactor();
        const baseCapacity = 60.0; // 60A industrial meter

        // 1) Smooth Frequency Transition (49.7Hz - 50.3Hz, delta ±0.02)
        state.freq += (Math.random() - 0.5) * 0.04;
        state.freq = Math.max(49.7, Math.min(50.3, state.freq));

        // 2) Smooth Voltage & Current per phase
        for (let p = 0; p < 3; p++) {
            // Voltage (220V - 240V, delta ±0.8V)
            state.vln[p] += (Math.random() - 0.5) * 1.6;
            state.vln[p] = Math.max(220.0, Math.min(240.0, state.vln[p]));

            // Current (Base on load factor, delta ±2A, imbalance < 10%)
            const targetI = baseCapacity * loadFactor * (1 + (Math.random() - 0.5) * 0.1);
            const deltaI = (targetI - state.i[p]) * 0.1; // Smooth approach
            state.i[p] += Math.max(-2.0, Math.min(2.0, deltaI));
            state.i[p] = Math.max(0.1, state.i[p]); // Never exactly zero

            // Power Factor (0.90 - 0.99, delta ±0.01)
            state.pf[p] += (Math.random() - 0.5) * 0.02;
            state.pf[p] = Math.max(0.90, Math.min(0.99, state.pf[p]));
        }

        // 3) Derived VLL (VLL = VLN * 1.732)
        const vll = state.vln.map(v => v * 1.73205);
        const vll_avg = vll.reduce((a, b) => a + b, 0) / 3;
        const vln_avg = state.vln.reduce((a, b) => a + b, 0) / 3;
        const i_avg = state.i.reduce((a, b) => a + b, 0) / 3;
        const pf_avg = state.pf.reduce((a, b) => a + b, 0) / 3;

        // 4) Neutral Current (Sum of vectors approx: for simulation simplified imbalance)
        const i_max = Math.max(...state.i);
        const i_min = Math.min(...state.i);
        const neutralCurrent = (i_max - i_min) * 0.8 + (Math.random() * 2);

        // 5) Power Calculations (STRICT FORMULAS)
        // Total kVA = (VLL_avg * I_avg * √3) / 1000
        const kva = (vll_avg * i_avg * 1.73205) / 1000;
        // Total kW = kVA * PF
        const kw = kva * pf_avg;
        // Total kVAr = sqrt(kVA^2 - kW^2)
        const kvar = Math.sqrt(Math.max(0, Math.pow(kva, 2) - Math.pow(kw, 2)));

        // 6) Energy Accumulation
        const kwhIncrement = kw * (dt / 3600);
        state.energyKwh += kwhIncrement;

        // 7) THD Logic (Voltage < 5%, Current 5-20%)
        const vThd = 1.0 + Math.random() * 4.0;
        const iThd = 5.0 + Math.random() * 15.0;

        // Map to internal payload format [0 : value, 1 : value, ...]
        let dataMap = {};
        dataMap[0] = state.energyKwh.toFixed(4); // kWh

        // Voltages Line-Neutral
        dataMap[10] = state.vln[0].toFixed(2);
        dataMap[12] = state.vln[1].toFixed(2);
        dataMap[14] = state.vln[2].toFixed(2);
        dataMap[16] = vln_avg.toFixed(2);

        // Voltages Line-Line
        dataMap[18] = vll[0].toFixed(2); // L1-L2
        dataMap[20] = vll[1].toFixed(2); // L2-L3
        dataMap[22] = vll[2].toFixed(2); // L3-L1
        dataMap[24] = vll_avg.toFixed(2);

        // Current
        dataMap[26] = state.i[0].toFixed(2);
        dataMap[28] = state.i[1].toFixed(2);
        dataMap[30] = state.i[2].toFixed(2);
        dataMap[32] = i_avg.toFixed(2);
        dataMap[34] = neutralCurrent.toFixed(2);

        // Power Factor
        dataMap[36] = state.pf[0].toFixed(3);
        dataMap[37] = state.pf[1].toFixed(3);
        dataMap[38] = state.pf[2].toFixed(3);
        dataMap[39] = pf_avg.toFixed(3);

        // Frequency
        dataMap[44] = state.freq.toFixed(2);

        // Powers
        dataMap[51] = kw.toFixed(3);   // Total kW
        dataMap[53] = kva.toFixed(3);  // Total kVA
        dataMap[55] = kvar.toFixed(3); // Total kVAr

        // THD
        dataMap[57] = vThd.toFixed(1);
        dataMap[59] = iThd.toFixed(1);

        for (let i = 0; i < 81; i++) {
            if (dataMap[i] === undefined) dataMap[i] = "0.00";
        }

        const jsonData = "[" + Object.entries(dataMap)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([k, v]) => `${k} : ${v}`)
            .join(", ") + "]";

        client.publish(`vatio/telemetry/${deviceId}`, jsonData);
        state.lastUpdate = now;
    }, SIMULATION_INTERVAL_MS);

    client.on('error', (err) => {
        console.error(`[Simulator] ${deviceId} error:`, err.message);
    });

    clients.set(deviceId, { client, interval });
}

discoverDevices();
setInterval(discoverDevices, DISCOVERY_INTERVAL_MS);

console.log(`[Simulator] Starting Realistic industrial simulation...`);

process.on('SIGINT', () => {
    for (const [_, info] of clients) {
        info.client.end();
    }
    process.exit();
});
