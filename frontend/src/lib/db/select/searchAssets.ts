import { db } from '$lib/db/conn';
import {
    CORE_COLUMNS, WARRANTY_COLUMNS, AUDIT_COLUMNS, HISTORY_COLUMNS,
    PED_COLUMNS, COMPUTER_COLUMNS, NETWORK_COLUMNS
} from './columnDefinitions';

export async function searchAssets(searchTerm: string | null, filters: Record<string, string[]>, view: string = 'default') {
  // Start with base query — all views share these joins
  let query = db.selectFrom('asset_inventory as ai')
    .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
    .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
    .leftJoin('asset_locations as al', 'ai.location_id', 'al.id') as any;

  // Add view-specific joins and select columns
  switch (view) {
    case 'audit':
      query = query.select([...CORE_COLUMNS, ...HISTORY_COLUMNS, ...AUDIT_COLUMNS]);
      break;
    case 'ped':
      query = query
        .leftJoin('asset_ped_details as apd', 'ai.id', 'apd.asset_id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...PED_COLUMNS, ...HISTORY_COLUMNS]);
      break;
    case 'computer':
      query = query
        .innerJoin('asset_computer_details as acd', 'ai.id', 'acd.asset_id')
        .leftJoin('asset_computer_galaxy as acg', 'acd.asset_id', 'acg.asset_id')
        .leftJoin('asset_computer_retail as acr', 'acd.asset_id', 'acr.asset_id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...COMPUTER_COLUMNS, ...HISTORY_COLUMNS]);
      break;
    case 'network':
      query = query
        .innerJoin('asset_network_details as and_', 'ai.id', 'and_.asset_id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...NETWORK_COLUMNS, ...HISTORY_COLUMNS]);
      break;
    default:
      query = query.select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS]);
      break;
  }

  if (searchTerm) {
    const escaped = searchTerm.replace(/[%_\\]/g, '\\$&');
    const searchTermLike = `%${escaped}%`;
    query = query.where((eb: any) => eb.or([
      eb('ai.serial_number', 'like', searchTermLike),
      eb('ai.wbd_tag', 'like', searchTermLike),
      eb('ai.manufacturer', 'like', searchTermLike),
      eb('ai.department', 'like', searchTermLike),
      eb('ai.node', 'like', searchTermLike),
      eb('ai.asset_type', 'like', searchTermLike),
      eb('ai.model', 'like', searchTermLike),
      eb('al.location_name', 'like', searchTermLike),
    ]));
  }

  // Map filter keys to actual database columns
  const filterColumnMap: Record<string, string> = {
    'location': 'al.location_name',
    'status': 'ast.status_name',
    'condition': 'ac.condition_name',
  };

  for (const [key, values] of Object.entries(filters)) {
    if (values.length > 0) {
      const columnName = filterColumnMap[key] || key;
      query = query.where(columnName as any, 'in', values);
    }
  }

  return await query.orderBy('ai.id').execute();
}