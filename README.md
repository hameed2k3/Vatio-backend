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
