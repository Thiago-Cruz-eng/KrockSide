// api.ts
import axios, { AxiosRequestConfig} from 'axios';

interface ApiResponse<T> {
    data: T;
}

const baseURL = 'https://api.example.com'; // Replace with your API base URL

const axiosInstance = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const api = {
    get: <T>(url: string, config?: AxiosRequestConfig) => axiosInstance.get<ApiResponse<T>>(url, config),
    post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => axiosInstance.post<ApiResponse<T>>(url, data, config),
    put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => axiosInstance.put<ApiResponse<T>>(url, data, config),
    delete: <T>(url: string, config?: AxiosRequestConfig) => axiosInstance.delete<ApiResponse<T>>(url, config),
};
