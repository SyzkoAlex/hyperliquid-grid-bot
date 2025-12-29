import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../logger/logger';

@Injectable()
export class HttpService {
    private readonly client: AxiosInstance;
    private readonly logger = logger.child({ context: HttpService.name });

    constructor() {
        this.client = axios.create({
            timeout: 30000,
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

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.post<T>(url, data, config);
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.put<T>(url, data, config);
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.delete<T>(url, config);
    }

    getClient(): AxiosInstance {
        return this.client;
    }
}
