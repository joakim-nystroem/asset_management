import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createUser } from '$lib/db/auth/createUser';
import { findUserByUsername } from '$lib/db/auth/findUserByUsername';
import bcrypt from 'bcrypt';

export const load = (async () => {
    return {};
}) satisfies PageServerLoad;

export const actions = {
    register: async ({ request }) => {
        const formData = await request.formData();
        const username = formData.get('username')?.toString();
        const firstname = formData.get('firstname')?.toString();
        const lastname = formData.get('lastname')?.toString();
        const password = formData.get('password')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();

        // Validation
        if (!username || !password || !firstname || !lastname) {
            return fail(400, { 
                username,
                firstname,
                lastname,
                message: 'All fields are required' 
            });
        }

        if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            return fail(400, { 
                username,
                firstname,
                lastname,
                message: 'Username must be at least 3 characters and contain only letters, numbers, and underscores' 
            });
        }

        if (password !== confirmPassword) {
            return fail(400, { 
                username,
                firstname,
                lastname,
                message: 'Passwords do not match' 
            });
        }

        if (password.length < 8) {
            return fail(400, { 
                username,
                firstname,
                lastname,
                message: 'Password must be at least 8 characters long' 
            });
        }

        try {
            // Check if username already exists
            const existingUser = await findUserByUsername(username);
            if (existingUser) {
                return fail(400, { 
                    message: 'Username already exists' 
                });
            }

            const password_hash = await bcrypt.hash(password, 10);
            await createUser({ username, firstname, lastname, password_hash });
            return { success: true, message: 'User registered successfully!' }; 
        } catch (error) {
            console.error('Registration error:', error);
            return fail(500, { message: 'Failed to register user' });
        }
    }
} satisfies Actions;