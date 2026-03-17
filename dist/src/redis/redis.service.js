"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = class RedisService {
    configService;
    client;
    streamName;
    constructor(configService) {
        this.configService = configService;
        this.streamName = this.configService.get('REDIS_STREAM_NAME', 'vatio:telemetry:stream');
    }
    isConnected = false;
    onModuleInit() {
        this.client = new ioredis_1.default({
            host: this.configService.get('REDIS_HOST', 'localhost'),
            port: this.configService.get('REDIS_PORT', 6379),
            password: this.configService.get('REDIS_PASSWORD'),
            maxRetriesPerRequest: 3,
        });
        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('Successfully connected to Redis');
        });
        this.client.on('error', (err) => {
            this.isConnected = false;
            console.error('Redis Error:', err.message);
        });
    }
    onModuleDestroy() {
        this.client.disconnect();
    }
    getIsConnected() {
        return this.isConnected;
    }
    async pushToQueue(data, topic) {
        const payload = JSON.stringify({ data, topic });
        await this.client.rpush(this.streamName, payload);
    }
    async setStatus(deviceId, status, ttl = 30) {
        await this.client.set(`vatio:device:${deviceId}:status`, status, 'EX', ttl);
    }
    async getStatus(deviceId) {
        return (await this.client.get(`vatio:device:${deviceId}:status`)) || 'offline';
    }
    getClient() {
        return this.client;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map