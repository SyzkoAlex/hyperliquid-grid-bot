import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';

@Injectable()
export class HttpService {
    private readonly client: AxiosInstance;
    private readonly logger = logger.child({ context: HttpService.name });

    constructor(configService: ConfigService<Config, true>) {
        const { requestTimeout } = configService.get('hyperliquid', { infer: true });

        this.client = axios.create({
            timeout: requestTimeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                this.logger.debug(
                    {
                        method: config.method,
                        url: config.url,
                    },
                    'HTTP request',
                );
                return config;
            },
            (error) => {
                this.logger.error({ error }, 'HTTP request error');
                return Promise.reject(error);
            },
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                this.logger.debug(
                    {
                        status: response.status,
                        url: response.config.url,
                    },
                    'HTTP response',
                );
                return response;
            },
            (error) => {
                this.logger.error(
                    {
                        status: error.response?.status,
                        url: error.config?.url,
                        message: error.message,
                    },
                    'HTTP response error',
                );
                return Promise.reject(error);
            },
        );
    }

    async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.get<T>(url, config);
    }

    async post<T>(
        url: string,
        data?: unknown,
        config?: AxiosRequestConfig,
    ): Promise<AxiosResponse<T>> {
        return this.client.post<T>(url, data, config);
    }

    async put<T>(
        url: string,
        data?: unknown,
        config?: AxiosRequestConfig,
    ): Promise<AxiosResponse<T>> {
        return this.client.put<T>(url, data, config);
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.delete<T>(url, config);
    }

    getClient(): AxiosInstance {
        return this.client;
    }
}
