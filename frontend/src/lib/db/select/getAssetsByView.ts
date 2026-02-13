import { db } from '$lib/db/conn';
import {
	CORE_COLUMNS,
	WARRANTY_COLUMNS,
	AUDIT_COLUMNS,
	HISTORY_COLUMNS,
	PED_COLUMNS,
	COMPUTER_COLUMNS,
	NETWORK_COLUMNS
} from './columnDefinitions';

export async function getAssetsByView(viewName: string) {
    switch (viewName) {
        case 'audit':
            return getAuditAssets();
        case 'ped':
            return getPedAssets();
        case 'computer':
            return getComputerAssets();
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
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS])
        .orderBy('ai.id')
        .execute();
}

async function getAuditAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .select([...CORE_COLUMNS, ...HISTORY_COLUMNS, ...AUDIT_COLUMNS])
        .orderBy('ai.id')
        .execute();
}

async function getPedAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
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

async function getComputerAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .innerJoin('asset_computer_details as acd', 'ai.id', 'acd.asset_id')
        .leftJoin('asset_computer_galaxy as acg', 'acd.asset_id', 'acg.asset_id')
        .leftJoin('asset_computer_retail as acr', 'acd.asset_id', 'acr.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            ...COMPUTER_COLUMNS,
            ...HISTORY_COLUMNS,
        ])
        .orderBy('ai.id')
        .execute();
}

async function getNetworkAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
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
