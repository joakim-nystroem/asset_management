export interface UserSettings {
    row_height?: number;
    hidden_statuses?: string[];
    theme?: 'dark' | 'light';
}

export interface User {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    password_hash: string;
    created_at: Date;
    last_login_at: Date | null;
    is_super_admin: boolean;
    // Optional on the base type because some queries only select a subset of
    // columns (login flow, admin user listing). hooks.server.ts always
    // populates it on locals.user, so consumers reading via page.data.user
    // can treat it as present — with a ?? {} fallback for the strict case.
    settings?: UserSettings;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface Session {
    session_id: string;
    user_id: number;
    created_at: Date;
    expires_at: Date;
}