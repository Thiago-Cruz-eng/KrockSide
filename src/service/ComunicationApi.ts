import {api} from "./Api";

interface CreateUserRequest {
    userName: string;
    email: string;
    password: string;
    passwordConfirmation: string;
    dateBirth: Date;
    address: string;
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

class UserController {
    static async createUser(userData: CreateUserRequest): Promise<UserResponse> {
        try {
            const response = await api.post<UserResponse>('user/create', userData);
            return response.data.data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async loginUser(loginData: LoginRequest): Promise<{ token: string } | undefined> {
        try {
            const response = await api.post<{ token: string }>('user/login', loginData);
            return response.data.data;
        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }
}

export default UserController;
