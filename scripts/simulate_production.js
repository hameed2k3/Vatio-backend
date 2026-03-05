/**
 * Production Simulation Script
 * Pushes simulated data directly into Redis Streams — no MQTT needed.
 * 
 * Usage:
 *   REDIS_HOST=<render-redis-host> REDIS_PORT=6379 BACKEND_URL=<render-backend-url> node scripts/simulate_production.js
 * 
 * For Render: run this locally pointing at your deployed Redis/Backend.
 */
const Redis = require('ioredis');
const axios = require('axios');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const STREAM_NAME = process.env.REDIS_STREAM_NAME || 'vatio:telemetry:stream';
const SIMULATION_INTERVAL_MS = parseInt(process.env.SIM_INTERVAL || '2000', 10);
const DISCOVERY_INTERVAL_MS = 15000;

let redis;
let deviceIds = [];

async function connectRedis() {
    redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: 3 });
    redis.on('connect', () => console.log(`[ProdSim] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`));
    redis.on('error', (err) => console.error(`[ProdSim] Redis error: ${err.message}`));
}

async function discoverDevices() {
    try {
        const { data } = await axios.get(`${BACKEND_URL}/ingestion/devices`);
        deviceIds = data.map(d => d.id);
        console.log(`[ProdSim] Found ${deviceIds.length} devices: ${deviceIds.join(', ')}`);
    } catch (e) {
        console.error(`[ProdSim] Discovery failed: ${e.message}`);
        if (deviceIds.length === 0) {
            // Seed a default device if none exist
            try {
                await axios.post(`${BACKEND_URL}/ingestion/devices`, {
                    id: 'NEWDEV_01', name: 'Simulated Meter', type: 'energy_meter', location: 'Main Panel'
                });
                deviceIds = ['NEWDEV_01'];
                console.log(`[ProdSim] Seeded default device: NEWDEV_01`);
            } catch (seedErr) {
                console.error(`[ProdSim] Seed failed: ${seedErr.message}`);
            }
        }
    }
}

/* ─── Helpers ─── */
function smoothNoise(t, scale) {
    return Math.sin(t * scale) * 0.5
        + Math.sin(t * scale * 2.3 + 1.7) * 0.25
        + Math.sin(t * scale * 0.7 + 3.1) * 0.25;
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function meanRevert(current, target, speed, noise) {
    return current + (target - current) * speed + (Math.random() - 0.5) * noise;
}

/* ─── Per-device state ─── */
const deviceStates = new Map();

function getOrCreateState(deviceId) {
    if (deviceStates.has(deviceId)) return deviceStates.get(deviceId);

    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
        hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
        hash = hash & hash;
    }
    const seed = Math.abs(hash) / 2147483647;

    const state = {
        voltageBase: [228.5 + seed * 3, 229.0 + seed * 2, 228.8 + seed * 2.5],
        currentBase: [2.8 + seed * 0.5, 5.5 + seed * 1.0, 0.02 + seed * 0.05],
        pfBase: [-0.98, 0.90 + seed * 0.03, 0.99],
        freqBase: 50.00 + seed * 0.02,
        thdBase: [2.0 + seed * 0.5, 2.2 + seed * 0.3, 1.8 + seed * 0.4],
        phaseOffset: seed * Math.PI * 2,
        // Mutable
        vln: [228.5 + seed * 3, 229.0 + seed * 2, 228.8 + seed * 2.5],
        i: [2.8 + seed * 0.5, 5.5 + seed * 1.0, 0.02 + seed * 0.05],
        pf: [-0.98, 0.90 + seed * 0.03, 0.99],
        freq: 50.00 + seed * 0.02,
        energyKwh: 12450 + seed * 100,
        thd: [2.0 + seed * 0.5, 2.2 + seed * 0.3, 1.8 + seed * 0.4],
        tick: 0,
        lastUpdate: Date.now(),
        vDrift: [0, 0, 0],
        freqDrift: 0,
        loadEvent: false, loadEventEnd: 0, loadEventMultiplier: 1.0,
    };
    deviceStates.set(deviceId, state);
    return state;
}

function generatePayload(deviceId) {
    const state = getOrCreateState(deviceId);
    const now = Date.now();
    const dt = (now - state.lastUpdate) / 1000;
    state.tick++;
    const t = state.tick * 0.01;

    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const hourFrac = hour + minute / 60;

    let loadFactor;
    if (hourFrac < 6) loadFactor = 0.15 + smoothNoise(t, 0.3) * 0.05;
    else if (hourFrac < 8) loadFactor = 0.15 + ((hourFrac - 6) / 2) * 0.55;
    else if (hourFrac < 17) loadFactor = 0.65 + smoothNoise(t, 0.5) * 0.15;
    else if (hourFrac < 20) loadFactor = 0.70 - ((hourFrac - 17) / 3) * 0.35;
    else loadFactor = 0.25 + smoothNoise(t, 0.3) * 0.05;

    if (!state.loadEvent && Math.random() < 0.003) {
        state.loadEvent = true;
        state.loadEventEnd = now + 3000 + Math.random() * 15000;
        state.loadEventMultiplier = Math.random() < 0.5 ? 1.3 + Math.random() * 0.5 : 0.5 + Math.random() * 0.3;
    }
    if (state.loadEvent && now > state.loadEventEnd) { state.loadEvent = false; state.loadEventMultiplier = 1.0; }
    const effectiveLoad = loadFactor * state.loadEventMultiplier;

    for (let p = 0; p < 3; p++) {
        state.vDrift[p] = smoothNoise(t + state.phaseOffset + p * 1.2, 0.15) * 2.5;
        state.vln[p] = clamp(state.voltageBase[p] + state.vDrift[p] - effectiveLoad * 1.5 + (Math.random() - 0.5) * 0.3, 225, 240);
    }

    for (let p = 0; p < 3; p++) {
        let target = p === 2 ? state.currentBase[2] + Math.random() * 0.03 : state.currentBase[p] * effectiveLoad + smoothNoise(t + p, 0.7) * 0.4;
        state.i[p] = meanRevert(state.i[p], Math.max(0, target), 0.08, 0.05);
    }

    state.pf[0] = clamp(state.pfBase[0] + smoothNoise(t, 0.4) * 0.03, -1.0, -0.85);
    state.pf[1] = clamp(state.pfBase[1] + smoothNoise(t + 2, 0.3) * 0.04, 0.82, 0.98);
    state.pf[2] = clamp(state.pfBase[2] + smoothNoise(t + 4, 0.2) * 0.01, 0.95, 1.0);

    state.freqDrift = smoothNoise(t, 0.08) * 0.2;
    state.freq = clamp(state.freqBase + state.freqDrift + (Math.random() - 0.5) * 0.02, 49.50, 50.35);

    const phaseKw = state.vln.map((v, p) => (v * state.i[p] * state.pf[p]) / 1000);
    const totalKw = phaseKw.reduce((a, b) => a + b, 0);
    const phaseKva = state.vln.map((v, p) => (v * state.i[p]) / 1000);
    const totalKva = phaseKva.reduce((a, b) => a + b, 0);
    const totalKvar = Math.sqrt(Math.max(0, totalKva ** 2 - totalKw ** 2));

    state.energyKwh += Math.abs(totalKw) * (dt / 3600);

    for (let p = 0; p < 3; p++) {
        state.thd[p] = clamp(state.thdBase[p] + smoothNoise(t + p * 1.5, 0.6) * 0.5 + effectiveLoad * 0.3, 0.8, 4.5);
    }

    const vln_avg = state.vln.reduce((a, b) => a + b, 0) / 3;
    const i_avg = state.i.reduce((a, b) => a + b, 0) / 3;
    const sysPF = state.pf.reduce((a, b) => a + b, 0) / 3;

    // Build the hardware payload string
    const dm = {};
    dm[0] = state.energyKwh.toFixed(3);
    dm[10] = state.vln[0].toFixed(2); dm[12] = state.vln[1].toFixed(2); dm[14] = state.vln[2].toFixed(2); dm[16] = vln_avg.toFixed(2);
    dm[26] = state.i[0].toFixed(2); dm[28] = state.i[1].toFixed(2); dm[30] = state.i[2].toFixed(2); dm[32] = i_avg.toFixed(2);
    dm[39] = state.pf[0].toFixed(3); dm[40] = state.pf[1].toFixed(3); dm[41] = state.pf[2].toFixed(3);
    dm[42] = sysPF.toFixed(3); dm[43] = ((Math.abs(state.pf[0]) + state.pf[1] + state.pf[2]) / 3).toFixed(3);
    dm[44] = state.freq.toFixed(2);
    dm[45] = phaseKw[0].toFixed(3); dm[47] = phaseKw[1].toFixed(3); dm[49] = phaseKw[2].toFixed(3);
    dm[51] = totalKw.toFixed(3); dm[53] = totalKva.toFixed(3); dm[55] = totalKvar.toFixed(3);
    dm[69] = state.thd[0].toFixed(2); dm[70] = state.thd[1].toFixed(2); dm[71] = state.thd[2].toFixed(2);

    // Fill zeros for undefined indices
    for (let idx = 0; idx < 81; idx++) { if (dm[idx] === undefined) dm[idx] = '0.00'; }

    const payload = '[' + Object.entries(dm).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => `${k} : ${v}`).join(', ') + ']';

    state.lastUpdate = now;
    return payload;
}

async function pushToRedisStream(deviceId, payload) {
    const topic = `vatio/telemetry/${deviceId}`;
    await redis.xadd(STREAM_NAME, 'MAXLEN', '~', 100000, '*', 'data', payload, 'topic', topic);
}

async function simulationLoop() {
    for (const deviceId of deviceIds) {
        const payload = generatePayload(deviceId);
        await pushToRedisStream(deviceId, payload);
    }
}

async function main() {
    console.log('[ProdSim] === Vatio Production Simulator ===');
    console.log(`[ProdSim] Redis: ${REDIS_HOST}:${REDIS_PORT}`);
    console.log(`[ProdSim] Backend: ${BACKEND_URL}`);
    console.log(`[ProdSim] Stream: ${STREAM_NAME}`);
    console.log(`[ProdSim] Interval: ${SIMULATION_INTERVAL_MS}ms`);

    await connectRedis();
    await discoverDevices();

    setInterval(discoverDevices, DISCOVERY_INTERVAL_MS);
    setInterval(simulationLoop, SIMULATION_INTERVAL_MS);

    console.log('[ProdSim] Simulation running. Press Ctrl+C to stop.');
}

process.on('SIGINT', () => {
    console.log('[ProdSim] Shutting down...');
    if (redis) redis.disconnect();
    process.exit();
});

main().catch(console.error);
