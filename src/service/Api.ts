// api.ts
import axios, { AxiosRequestConfig} from 'axios';

interface ApiResponse<T> {
    data: T;
}

const baseURL = 'https://localhost:44380/';

const axiosInstance = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const api = {
    get: <T>(url: string, config?: AxiosRequestConfig) => axiosInstance.get<T>(url, config),
    post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => axiosInstance.post<T>(url, data, config),
    put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => axiosInstance.put<T>(url, data, config),
    delete: <T>(url: string, config?: AxiosRequestConfig) => axiosInstance.delete<T>(url, config),
};
