export interface User {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    password_hash: string;
    created_at: Date;
    last_login_at: Date | null;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface Session {
    session_id: string;
    user_id: number;
    created_at: Date;
    expires_at: Date;
}