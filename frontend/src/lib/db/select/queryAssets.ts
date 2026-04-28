import { db } from '$lib/db/conn';
import { sql } from 'kysely';
import {
    CORE_COLUMNS, WARRANTY_COLUMNS, HISTORY_COLUMNS,
    PED_COLUMNS, NETWORK_COLUMNS, GALAXY_COLUMNS
} from './columnDefinitions';

export async function queryAssets(searchTerm: string | null, filters: Record<string, string[]>, view: string = 'default', hiddenStatuses: string[] = []) {
  // Start with base query — all views share these joins
  let query = db.selectFrom('asset_inventory as ai')
    .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
    .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
    .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
    .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id') as any;

  // Add view-specific joins and select columns
  switch (view) {
    case 'audit':
      query = query
        .leftJoin('asset_audit as aa', 'ai.id', 'aa.asset_id')
        .leftJoin('users as au', 'aa.assigned_to', 'au.id')
        .select([
            ...CORE_COLUMNS,
            ...HISTORY_COLUMNS,
            sql<string>`DATE_FORMAT(aa.audit_start_date, '%Y-%m-%d %H:%i:%s')`.as('audit_start_date'),
            sql<string | null>`CONCAT(au.lastname, ', ', au.firstname)`.as('assigned_to'),
            sql<string | null>`DATE_FORMAT(aa.completed_at, '%Y-%m-%d %H:%i:%s')`.as('completed_at'),
            'aa.result',
        ]);
      break;
    case 'ped':
      query = query
        .leftJoin('asset_ped_details as apd', 'ai.id', 'apd.asset_id')
        .leftJoin('asset_network_details as and_', 'ai.id', 'and_.asset_id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...PED_COLUMNS, ...NETWORK_COLUMNS, ...HISTORY_COLUMNS])
        .where('ai.asset_type', '=', 'PED / EMV');
      break;
    case 'galaxy':
      query = query
        .innerJoin('asset_galaxy_details as agd', 'agd.asset_id', 'ai.id')
        .select([
          'ai.id',
          'ad.department_name as department',
          'agd.environment',
          'ai.node',
          'agd.node_number',
          'agd.node_type',
          'agd.node_link',
          'agd.license_number',
          'agd.hostname',
          'agd.galaxy_module',
          ...HISTORY_COLUMNS,
        ])
        .where('ast.status_name', '!=', 'Retired');
      break;
    default:
      query = query
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS])
        .where('ai.asset_type', '!=', 'Virtual Machine');
      break;
  }

  if (hiddenStatuses.length > 0) {
    query = query.where('ast.status_name', 'not in', hiddenStatuses);
  }

  if (searchTerm) {
    const escaped = searchTerm.replace(/[%_\\]/g, '\\$&');
    const searchTermLike = `%${escaped}%`;
    query = query.where((eb: any) => eb.or([
      eb('ai.id', 'like', searchTermLike),
      eb('ai.serial_number', 'like', searchTermLike),
      eb('ai.wbd_tag', 'like', searchTermLike),
      eb('ai.manufacturer', 'like', searchTermLike),
      eb('ad.department_name', 'like', searchTermLike),
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
    'department': 'ad.department_name',
  };

  const directColumns = new Set([
    'id',
    'asset_type', 'asset_set_type', 'manufacturer', 'model',
    'node', 'bu_estate', 'shelf_cabinet_table',
    'wbd_tag', 'serial_number', 'comment',
    'under_warranty_until', 'warranty_details',
  ]);

  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue;
    const columnName = filterColumnMap[key] ?? (directColumns.has(key) ? `ai.${key}` : null);
    if (!columnName) continue;
    query = query.where(columnName as any, 'in', values);
  }

  return await query.orderBy('ai.id').execute();
}
