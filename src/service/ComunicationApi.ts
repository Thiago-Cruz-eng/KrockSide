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

interface GetFirstValidationRequest {
    AccessToken: string;
    UserId: string;
}

interface ValidationResponse {
    Id: string;
    AccessToken: string;
    UserId: string;
    Room: string;
    PieceColor: string;
    UserEmail: string;
    DayOfGame: string;
}

interface ValidationRequest{
    AccessToken: string;
    UserId: string;
    Room: string;
    PieceColor: string;
    UserEmail: string;
}

interface UserResponse {
    Success: boolean;
    email: string;
    AccessToken: string;
    message: string;
    userId: string;
}

interface GetUserResponse {
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

    static async getUser(id: string | undefined): Promise<GetUserResponse> {
        try {
            const response = await api.get<GetUserResponse>(`get/${id}`);
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

    static async verifyValidation(validateData: GetFirstValidationRequest): Promise<boolean> {
        try {
            const response = await api.get<boolean>(`get-validation/${validateData.UserId}/${validateData.AccessToken}`);
            return !!response;

        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }

    static async getValidation(validateData: GetFirstValidationRequest): Promise<ValidationResponse> {
        try {
            const response = await api.get<ValidationResponse>(`get-validation/${validateData.UserId}/${validateData.AccessToken}`);
            return response.data;

        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }

    static async updateValidation(id: string, validateData: ValidationRequest): Promise<boolean> {
        try {
            const response = await api.put<boolean>(`update-validation/${id}`, validateData);
            return response.data;

        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }
}

export default UserController;
