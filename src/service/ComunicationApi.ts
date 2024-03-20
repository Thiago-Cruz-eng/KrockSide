import { api } from "./Api";

interface CreateUserRequest {
    userName: string;
    email: string;
    password: string;
    passwordConfirmation: string;
    dateBirth: Date;
    phoneNumber: string;
}

interface LoginRequest {
    email: string;
    password: string;
}

interface UserResponse {
    userName: string;
    email: string;
}

interface LoginResponse {
    Success: boolean;
    email: string;
    AccessToken: string;
    message: string;
    userId: string;
}

class UserController {
    static async createUser(userData: CreateUserRequest): Promise<UserResponse> {
        try {
            const response = await api.post<UserResponse>('create', userData);
            return response.data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async loginUser(loginData: LoginRequest): Promise<LoginResponse> {
        try {
            const response = await api.post<LoginResponse>('login', loginData);
            return response.data;
        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }
}

export default UserController;
