import { db } from '$lib/db/conn';
import { sql } from 'kysely';
import {
	CORE_COLUMNS,
	WARRANTY_COLUMNS,
	HISTORY_COLUMNS,
	PED_COLUMNS,
	NETWORK_COLUMNS
} from './columnDefinitions';

export async function getAssetsByView(viewName: string) {
    switch (viewName) {
        case 'audit':
            return getAuditAssets();
        case 'ped':
            return getPedAssets();
        case 'galaxy':
            return getGalaxyAssets();
        case 'network':
            return getNetworkAssets();
        default:
            return getDefaultAssets();
    }
}

async function getDefaultAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS])
        .orderBy('ai.id')
        .execute();
}

async function getAuditAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .leftJoin('asset_audit as aa', 'ai.id', 'aa.asset_id')
        .leftJoin('users as au', 'aa.assigned_to', 'au.id')
        .select([
            ...CORE_COLUMNS,
            ...HISTORY_COLUMNS,
            'aa.audit_start_date',
            sql<string | null>`CONCAT(au.lastname, ', ', au.firstname)`.as('assigned_to'),
            'aa.completed_at',
            'aa.result',
        ])
        .orderBy('ai.id')
        .execute();
}

async function getPedAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .leftJoin('asset_ped_details as apd', 'ai.id', 'apd.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            ...PED_COLUMNS,
            ...HISTORY_COLUMNS,
        ])
        .where('ai.asset_type', '=', 'PED / EMV')
        .orderBy('ai.id')
        .execute();
}

// Temporary filter-based view for Galaxy assets.
// No extension table yet — uses hardcoded WHERE filters on base columns.
// When a Galaxy extension table is created, this should be updated to join it.
async function getGalaxyAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS])
        .where('ai.asset_set_type', '=', 'Admission POS set')
        .where('ai.asset_type', '=', 'POS')
        .orderBy('ai.id')
        .execute();
}

async function getNetworkAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .innerJoin('asset_network_details as and_', 'ai.id', 'and_.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            ...NETWORK_COLUMNS,
            ...HISTORY_COLUMNS,
        ])
        .orderBy('ai.id')
        .execute();
}
