const mqtt = require('mqtt');
const axios = require('axios');

const BROKER_URL = 'mqtt://localhost:1883';
const BACKEND_URL = 'http://127.0.0.1:3000/ingestion/devices';
const DISCOVERY_INTERVAL_MS = 10000;
const SIMULATION_INTERVAL_MS = 1000; // 1 second per tick (realistic meter read rate)

let clients = new Map();

async function discoverDevices() {
    try {
        const response = await axios.get(BACKEND_URL);
        const devices = response.data;
        const deviceIds = devices.map(d => d.id);

        console.log(`[Simulator] Discovered ${deviceIds.length} devices from backend`);

        for (const [deviceId, clientInfo] of clients.entries()) {
            if (!deviceIds.includes(deviceId)) {
                console.log(`[Simulator] Stopping simulation for ${deviceId}`);
                clearInterval(clientInfo.interval);
                clientInfo.client.end();
                clients.delete(deviceId);
            }
        }

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

/* ─── Perlin-style smooth noise helper ──────────────────────────────────── */
function smoothNoise(t, scale) {
    return Math.sin(t * scale) * 0.5
        + Math.sin(t * scale * 2.3 + 1.7) * 0.25
        + Math.sin(t * scale * 0.7 + 3.1) * 0.25;
}

/* ─── Clamp helper ──────────────────────────────────────────────────────── */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/* ─── Random walk with mean reversion ───────────────────────────────────── */
function meanRevert(current, target, speed, noise) {
    return current + (target - current) * speed + (Math.random() - 0.5) * noise;
}

/* ─── Device Profile Templates ──────────────────────────────────────────── */
// Each device gets a slightly different "personality" based on real data patterns
function createDeviceProfile(deviceId) {
    // Hash deviceId to get deterministic but varied profiles
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
        hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
        hash = hash & hash;
    }
    const seed = Math.abs(hash) / 2147483647;

    // Real data observed from screenshots:
    // Voltage: 383V-402V range (3-phase industrial)
    // Current: Phase-1=2-4A, Phase-2=5-7A, Phase-3≈0A
    // PF: Phase-1≈-1.0 (leading), Phase-2≈0.9, Phase-3≈1.0
    // Frequency: 49.6-50.3 Hz
    // Load: Total ~0.5KW
    return {
        // Voltage baselines per phase (observed: 383-402V, avg ~390V)
        voltageBase: [
            228.5 + seed * 3,        // Phase-1 baseline (single-phase equivalent)
            229.0 + seed * 2,        // Phase-2 baseline
            228.8 + seed * 2.5       // Phase-3 baseline
        ],
        // Current baselines per phase (observed from real data)
        currentBase: [
            2.8 + seed * 0.5,       // Phase-1: 2-4A range
            5.5 + seed * 1.0,       // Phase-2: 5-7A range (higher loaded)
            0.02 + seed * 0.05      // Phase-3: nearly 0A (very lightly loaded)
        ],
        // Power Factor per phase (from PF Analysis screenshot)
        pfBase: [
            -0.98,                   // Phase-1: negative/leading PF (~-1.0)
            0.90 + seed * 0.03,     // Phase-2: lagging PF (~0.9)
            0.99                     // Phase-3: near unity
        ],
        // Frequency baseline
        freqBase: 50.00 + seed * 0.02,
        // Energy starting value
        energyStart: 12450 + seed * 100,
        // THD baselines (from Voltage THD screenshot: 1.5-3.5%)
        thdBase: [
            2.0 + seed * 0.5,      // Phase-1 THD%
            2.2 + seed * 0.3,      // Phase-2 THD%
            1.8 + seed * 0.4       // Phase-3 THD%
        ],
        // Device-specific noise phase offset
        phaseOffset: seed * Math.PI * 2
    };
}

function startSimulation(deviceId) {
    const client = mqtt.connect(BROKER_URL, {
        clientId: `sim_${deviceId}_${Math.random().toString(16).slice(2, 8)}`
    });

    const profile = createDeviceProfile(deviceId);

    // Mutable state that evolves over time
    let state = {
        vln: [...profile.voltageBase],
        i: [...profile.currentBase],
        pf: [...profile.pfBase],
        freq: profile.freqBase,
        energyKwh: profile.energyStart,
        thd: [...profile.thdBase],
        lastUpdate: Date.now(),
        tick: 0,
        // Slow-moving "drift" accumulators for realistic wandering
        vDrift: [0, 0, 0],
        iDrift: [0, 0, 0],
        freqDrift: 0,
        // Event state: occasional load steps / power events
        loadEvent: false,
        loadEventEnd: 0,
        loadEventMultiplier: 1.0
    };

    const interval = setInterval(() => {
        const now = Date.now();
        const dt = (now - state.lastUpdate) / 1000;
        state.tick++;
        const t = state.tick * 0.01; // Slow time base

        /* ── 1) Time-of-Day Load Curve ── */
        const hour = new Date().getHours();
        const minute = new Date().getMinutes();
        const hourFrac = hour + minute / 60;

        // Realistic daily load profile (from Load Analysis screenshot)
        let loadFactor;
        if (hourFrac >= 0 && hourFrac < 6) {
            loadFactor = 0.15 + smoothNoise(t, 0.3) * 0.05; // Night: very low
        } else if (hourFrac >= 6 && hourFrac < 8) {
            // Morning ramp-up
            const ramp = (hourFrac - 6) / 2;
            loadFactor = 0.15 + ramp * 0.55;
        } else if (hourFrac >= 8 && hourFrac < 17) {
            // Daytime: active, with variations
            loadFactor = 0.65 + smoothNoise(t, 0.5) * 0.15 + Math.sin(t * 0.7) * 0.05;
        } else if (hourFrac >= 17 && hourFrac < 20) {
            // Evening ramp-down
            const ramp = (hourFrac - 17) / 3;
            loadFactor = 0.70 - ramp * 0.35 + smoothNoise(t, 0.4) * 0.08;
        } else {
            loadFactor = 0.25 + smoothNoise(t, 0.3) * 0.05; // Late night
        }

        /* ── 2) Random Load Events (spikes/dips like real machinery) ── */
        if (!state.loadEvent && Math.random() < 0.003) {
            // 0.3% chance per tick = ~1 event per 5 minutes
            state.loadEvent = true;
            state.loadEventEnd = now + (3000 + Math.random() * 15000); // 3-15s event
            state.loadEventMultiplier = Math.random() < 0.5
                ? 1.3 + Math.random() * 0.5  // Spike up
                : 0.5 + Math.random() * 0.3; // Dip down
        }
        if (state.loadEvent && now > state.loadEventEnd) {
            state.loadEvent = false;
            state.loadEventMultiplier = 1.0;
        }
        const effectiveLoad = loadFactor * state.loadEventMultiplier;

        /* ── 3) Voltage Simulation (observed: 228-232V per phase, slow drift) ── */
        for (let p = 0; p < 3; p++) {
            // Slow sinusoidal drift (like real grid voltage wandering over hours)
            state.vDrift[p] = smoothNoise(t + profile.phaseOffset + p * 1.2, 0.15) * 2.5;

            // Small fast noise (meter measurement noise)
            const fastNoise = (Math.random() - 0.5) * 0.3;

            // Load-dependent voltage sag (higher load = lower voltage)
            const loadSag = effectiveLoad * 1.5;

            state.vln[p] = clamp(
                profile.voltageBase[p] + state.vDrift[p] - loadSag + fastNoise,
                225.0, 240.0
            );
        }

        /* ── 4) Current Simulation (from Current Profile screenshot) ── */
        // Phase-1: 2-4A with occasional spikes to 5A
        // Phase-2: 5-7A, higher and more stable
        // Phase-3: ~0A (nearly zero, unloaded phase)
        for (let p = 0; p < 3; p++) {
            let targetCurrent;
            if (p === 0) {
                // Phase-1: moderate load, spiky
                targetCurrent = profile.currentBase[0] * effectiveLoad;
                targetCurrent += smoothNoise(t + 0.5, 0.8) * 0.5; // Oscillation
                if (Math.random() < 0.01) targetCurrent *= 1.5; // Rare spike
            } else if (p === 1) {
                // Phase-2: heavier load, more stable
                targetCurrent = profile.currentBase[1] * effectiveLoad;
                targetCurrent += smoothNoise(t + 1.3, 0.6) * 0.3;
            } else {
                // Phase-3: very light load (~0A, just leakage)
                targetCurrent = profile.currentBase[2] + Math.random() * 0.03;
            }

            // Smooth transition (don't jump, ramp toward target)
            state.i[p] = meanRevert(state.i[p], Math.max(0, targetCurrent), 0.08, 0.05);
        }
        const i_avg = (state.i[0] + state.i[1] + state.i[2]) / 3;

        /* ── 5) Power Factor (from PF Analysis screenshot) ── */
        // Phase-1: negative (-0.95 to -1.0), leading
        // Phase-2: positive (0.88 to 0.95), lagging inductive
        // Phase-3: near unity (0.98 to 1.0)
        // Total PF: oscillates, can go negative during reactive events
        state.pf[0] = clamp(
            profile.pfBase[0] + smoothNoise(t, 0.4) * 0.03 + (Math.random() - 0.5) * 0.01,
            -1.0, -0.85
        );
        state.pf[1] = clamp(
            profile.pfBase[1] + smoothNoise(t + 2.0, 0.3) * 0.04 + (Math.random() - 0.5) * 0.01,
            0.82, 0.98
        );
        state.pf[2] = clamp(
            profile.pfBase[2] + smoothNoise(t + 4.0, 0.2) * 0.01,
            0.95, 1.0
        );
        const sysPF = (state.pf[0] + state.pf[1] + state.pf[2]) / 3;

        /* ── 6) Frequency (from Frequency Analysis screenshot) ── */
        // Observed: 49.6-50.3 Hz, slow sinusoidal with occasional dips
        state.freqDrift = smoothNoise(t, 0.08) * 0.2; // Slow wandering ±0.2Hz
        const freqNoise = (Math.random() - 0.5) * 0.02;
        // Rare frequency dip event (like real grid disturbance)
        let freqDip = 0;
        if (Math.random() < 0.001) {
            freqDip = -(0.2 + Math.random() * 0.3); // Dip to ~49.6Hz
        }
        state.freq = clamp(
            profile.freqBase + state.freqDrift + freqNoise + freqDip,
            49.50, 50.35
        );

        /* ── 7) Power Calculations (Physics-based) ── */
        // Per-phase active power (kW) = V * I * PF / 1000
        const phaseKw = [];
        for (let p = 0; p < 3; p++) {
            phaseKw[p] = (state.vln[p] * state.i[p] * state.pf[p]) / 1000;
        }
        const totalKw = phaseKw[0] + phaseKw[1] + phaseKw[2];

        // Per-phase apparent power (kVA)
        const phaseKva = [];
        for (let p = 0; p < 3; p++) {
            phaseKva[p] = (state.vln[p] * state.i[p]) / 1000;
        }
        const totalKva = phaseKva[0] + phaseKva[1] + phaseKva[2];

        // Reactive power
        const totalKvar = Math.sqrt(Math.max(0, totalKva * totalKva - totalKw * totalKw));

        /* ── 8) Energy Accumulation ── */
        // Accelerated accumulation (100x) for better visualization in short demos
        const kwhIncrement = Math.abs(totalKw) * (dt / 3600) * 100;
        state.energyKwh += kwhIncrement;

        /* ── 9) Voltage THD (from THD screenshot: 1.5-3.5%) ── */
        for (let p = 0; p < 3; p++) {
            state.thd[p] = clamp(
                profile.thdBase[p]
                + smoothNoise(t + p * 1.5, 0.6) * 0.5
                + (Math.random() - 0.5) * 0.15
                + effectiveLoad * 0.3, // Higher load = higher THD
                0.8, 4.5
            );
        }

        /* ── 10) Build Hardware Telemetry Payload (81-register Vatio protocol) ── */
        const vln_avg = (state.vln[0] + state.vln[1] + state.vln[2]) / 3;

        let dataMap = {};
        // Index  0: Import Energy (kWh) - high precision to show small increments
        dataMap[0] = state.energyKwh.toFixed(6);
        // Index  1-9: Other energy metrics (export, net, etc.) - low for simulation
        // These stay near 0 for a typical import-only installation

        // Index 10-17: Voltages
        dataMap[10] = state.vln[0].toFixed(2);  // V_L1-N
        dataMap[12] = state.vln[1].toFixed(2);  // V_L2-N
        dataMap[14] = state.vln[2].toFixed(2);  // V_L3-N
        dataMap[16] = vln_avg.toFixed(2);        // AVG VLN

        // Index 26-33: Currents
        dataMap[26] = state.i[0].toFixed(2);     // I_L1
        dataMap[28] = state.i[1].toFixed(2);     // I_L2
        dataMap[30] = state.i[2].toFixed(2);     // I_L3
        dataMap[32] = i_avg.toFixed(2);           // AVG Current

        // Index 39-43: Power Factor
        dataMap[39] = state.pf[0].toFixed(3);    // PF L1
        dataMap[40] = state.pf[1].toFixed(3);    // PF L2
        dataMap[41] = state.pf[2].toFixed(3);    // PF L3
        dataMap[42] = sysPF.toFixed(3);           // System PF
        dataMap[43] = ((Math.abs(state.pf[0]) + state.pf[1] + state.pf[2]) / 3).toFixed(3); // Avg PF

        // Index 44: Frequency
        dataMap[44] = state.freq.toFixed(2);

        // Index 45-50: Per-phase kW
        dataMap[45] = phaseKw[0].toFixed(3);     // L1 kW
        dataMap[47] = phaseKw[1].toFixed(3);     // L2 kW
        dataMap[49] = phaseKw[2].toFixed(3);     // L3 kW

        // Index 51-52: Total kW
        dataMap[51] = totalKw.toFixed(3);

        // Index 53-56: kVA
        dataMap[53] = totalKva.toFixed(3);
        dataMap[55] = totalKvar.toFixed(3);

        // Index 57-60: Per-phase kVA (line)
        dataMap[57] = phaseKva[0].toFixed(1);
        dataMap[59] = phaseKva[1].toFixed(1);

        // Index 69-74: THD
        dataMap[69] = state.thd[0].toFixed(2);   // V_THD L1
        dataMap[70] = state.thd[1].toFixed(2);   // V_THD L2
        dataMap[71] = state.thd[2].toFixed(2);   // V_THD L3

        /* ── 11) Compile and Publish ── */
        const payload = formatPayload(dataMap);
        client.publish(`vatio/telemetry/${deviceId}`, payload);

        state.lastUpdate = now;
    }, SIMULATION_INTERVAL_MS);

    client.on('error', (err) => console.error(`[Sim] ${deviceId} Error:`, err.message));
    clients.set(deviceId, { client, interval });
}

function formatPayload(dataMap) {
    for (let i = 0; i < 81; i++) {
        if (dataMap[i] === undefined) dataMap[i] = "0.00";
    }
    return "[" + Object.entries(dataMap)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([k, v]) => `${k} : ${v}`)
        .join(", ") + "]";
}

discoverDevices();
setInterval(discoverDevices, DISCOVERY_INTERVAL_MS);

console.log(`[Simulator] Starting physics-based realistic simulation...`);
console.log(`[Simulator] Data characteristics:`);
console.log(`  Voltage:   228-232V per phase, slow drift`);
console.log(`  Current:   L1=2-4A, L2=5-7A, L3≈0A`);
console.log(`  PF:        L1≈-1.0 (leading), L2≈0.9, L3≈1.0`);
console.log(`  Frequency: 49.6-50.3 Hz, slow sinusoidal`);
console.log(`  THD:       1.5-3.5% with load correlation`);
console.log(`  Interval:  ${SIMULATION_INTERVAL_MS}ms per sample`);

process.on('SIGINT', () => {
    for (const [_, info] of clients) {
        info.client.end();
    }
    process.exit();
});
