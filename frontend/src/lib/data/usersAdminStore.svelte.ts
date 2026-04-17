import type { SafeUser } from '$lib/types';

export const usersAdminStore = $state<{ users: SafeUser[] }>({
    users: [],
});
