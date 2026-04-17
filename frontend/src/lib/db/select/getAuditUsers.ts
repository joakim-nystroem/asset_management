import { db } from '$lib/db/conn';

export async function getAuditUsers() {
	return await db.selectFrom('users')
		.select(['id', 'firstname', 'lastname', 'username'])
		.where('username', '!=', 'admin')
		.orderBy('lastname')
		.execute();
}
