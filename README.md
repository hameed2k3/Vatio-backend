# VATIO Solar IoT Monitoring System: Backend

A high-performance, resilient IoT backend designed to monitor 1000+ solar devices with sub-second precision.

## 🚀 Architectural Excellence

This backend is engineered for maximum throughput on a single VPS (2 vCPU, 8GB RAM), handling **2000 messages per second** (~2MB/sec) through a decoupled, multi-stage pipeline.

- **Ingestion Layer**: Mosquitto MQTT Broker (Native)
- **Buffering Layer**: Redis Streams (In-memory)
- **Processing Layer**: NestJS (Fastify) with 5s Tumbling Window Aggregator
- **Database Layer**: Neon DB (Serverless PostgreSQL)
- **Real-Time Layer**: Throttled WebSocket Gateway (Socket.io)

## 🏗️ Data Flow

`Device (500ms pub) → Mosquitto (Ingestion) → Redis Stream (Buffer) → Aggregator (5s window) → Neon DB (Store) & WebSockets (Push)`

## 📚 Comprehensive Documentation
Detailed project documentation can be found in the [docs/](file:///c:/Users/acer/Desktop/vatio/docs) folder:
- [Architecture Overview](file:///c:/Users/acer/Desktop/vatio/docs/ARCHITECTURE.md)
- [Native Setup Guide](file:///c:/Users/acer/Desktop/vatio/docs/SETUP_GUIDE.md)
- [Data Flow & Aggregation](file:///c:/Users/acer/Desktop/vatio/docs/DATA_FLOW.md)
- [API & Event Reference](file:///c:/Users/acer/Desktop/vatio/docs/API_REFERENCE.md)

## 🛠️ Key Features

- **Decoupled Architecture**: Ingestion is separated from processing for sub-millisecond ACK latency.
- **Resource Efficiency**: Optimized for native execution to bypass Docker overhead.
- **Batched Persistence**: Aggregates 10 messages into 1 DB record, reducing database IOPS by 90%.
- **Throttled Real-time**: Dashboard updates are pushed every 5s to ensure frontend stability.

## 🚀 Production Deployment (Render)

This repository includes a **Render Blueprint** for a seamless "one-click" deployment:

1. **Go to Render Dashboard** and select **Blueprints**.
2. **Connect this repository** (`Vatio-backend`).
3. Render will automatically detect the [render.yaml](file:///c:/Users/Hameed/Desktop/Enarxi/Vatio/Vatio-backend/render.yaml) file and provision the entire stack:
   - **vatio-redis**: Private Redis service.
   - **vatio-mqtt**: Self-hosted Mosquitto (via Docker).
   - **vatio-backend**: This NestJS service.
4. **Configuration**: 
   - Set your Neon `DATABASE_URL` in the Render dashboard for the `vatio-backend` service.
   - The Root Directory for the Web Service should be `.` or empty (since this is the root of the repo).

### 🔒 Secure Infrastructure
Redis and MQTT are provisioned as **Private Services**. They are NOT exposed to the internet. The backend connects to them internally via `vatio-redis:6379` and `vatio-mqtt:1883`, ensuring maximum security and zero latency.

## 🏁 Getting Started

1. **Environment Setup**: 
   Configure `.env` with your Neon `DATABASE_URL`.
2. **Infrastructure**:
   Ensure Mosquitto and Redis are running natively on your VPS.
3. **Execution**:
   ```bash
   npm install
   npx prisma db push
   npm run start:dev
   ```

## 📈 Scalability Roadmap

- **Horizontal**: Use Redis Consumer Groups to distribute the Aggregator workload.
- **Persistence**: Easily switch to specialized time-series storage (TimescaleDB) when data exceeds 100M records.
- **Broker**: Upgrade to EMQX cluster for >50k concurrent device connections.

---

## 🚀 Production Deployment (Render)

For the easiest production setup, use the **Render Blueprint**:

1. **Go to Render Dashboard** and select **Blueprints**.
2. **Connect your repository**.
3. Render will automatically detect the [render.yaml](file:///c:/Users/Hameed/Desktop/Enarxi/Vatio/render.yaml) file and provision:
   - **vatio-redis** (Private Service)
   - **vatio-mqtt** (Private Service with Docker)
   - **vatio-backend** (Web Service)
4. **Environment Variables**:
   Set `DATABASE_URL` (your Neon DB link) in the Render dashboard for the `vatio-backend` service.

### 🔒 Self-Hosted (Private) Infrastructure
The Redis and MQTT services are deployed as **Private Services**. This means they are only accessible to the backend service via their internal hostnames (`vatio-redis` and `vatio-mqtt`). This is more secure as they are not exposed to the public internet.
