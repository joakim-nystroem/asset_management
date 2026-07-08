import { db } from '$lib/db/conn';
import { sql } from 'kysely';
import {
    CORE_COLUMNS, WARRANTY_COLUMNS, HISTORY_COLUMNS,
    PED_COLUMNS, NETWORK_COLUMNS
} from './columnDefinitions';
import { DATE_COLUMNS } from '$lib/grid/validation';
import { parseDateFilter, nextDayIso } from '$lib/grid/dateFilter';

export async function queryAssets(searchTerm: string | null, filters: Record<string, string[]>, view: string = 'default', hiddenStatuses: string[] = []) {
  // Start with base query — all views share these joins
  let query = db.selectFrom('asset_inventory as ai')
    .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
    .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
    .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
    .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
    .leftJoin('asset_applications as app', 'ai.application_id', 'app.id') as any;

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
        .leftJoin('asset_galaxy_details as agd', 'agd.asset_id', 'ai.id')
        .select([
          'ai.id',
          'ad.department_name as department',
          sql<string>`CASE ast.status_name WHEN 'In use - Prod' THEN 'PROD' WHEN 'In use - Stage/UAT' THEN 'STAGE' WHEN 'In use - Dev' THEN 'DEV' ELSE '' END`.as('environment'),
          'ai.node',
          'agd.node_number',
          'agd.node_type',
          'agd.node_link',
          'agd.license_number',
          'agd.hostname',
          'agd.galaxy_module',
          ...HISTORY_COLUMNS,
        ])
        // Galaxy application tag is the source of truth; type check excludes
        // peripherals (keyboards, monitors, etc.) tagged Galaxy by mistake.
        .where('app.application_name', '=', 'Galaxy')
        .where('ai.asset_type', 'in', ['Laptop', 'POS', 'Virtual Machine']);
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
    'application': 'app.application_name',
  };

  const directColumns = new Set([
    'id',
    'asset_type', 'asset_set_type', 'manufacturer', 'model',
    'node', 'bu_estate', 'shelf_cabinet_table',
    'wbd_tag', 'serial_number', 'comment',
    'under_warranty_until', 'warranty_details',
    'modified', 'created',
  ]);

  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue;
    const columnName = filterColumnMap[key] ?? (directColumns.has(key) ? `ai.${key}` : null);
    if (!columnName) continue;

    if (DATE_COLUMNS.has(key)) {
      const parsed = parseDateFilter(values[0]);
      if (!parsed) continue;
      // Half-open ranges keep the column unwrapped → index-friendly.
      // For DATETIME cols (`modified`, `created`), this also captures the
      // full day for `=` instead of relying on DATE() per-row coercion.
      if (parsed.op === '=') {
        query = query
          .where(columnName as any, '>=', parsed.iso)
          .where(columnName as any, '<', nextDayIso(parsed.iso));
      } else if (parsed.op === '<=') {
        query = query.where(columnName as any, '<', nextDayIso(parsed.iso));
      } else {
        query = query.where(columnName as any, '>=', parsed.iso);
      }
      continue;
    }

    const hasBlank = values.includes('__BLANK__');
    const realValues = values.filter(v => v !== '__BLANK__');

    if (hasBlank) {
      query = query.where((eb: any) => {
        const branches = [
          eb(columnName as any, 'is', null),
          eb(columnName as any, '=', ''),
        ];
        if (realValues.length > 0) {
          branches.push(eb(columnName as any, 'in', realValues));
        }
        return eb.or(branches);
      });
    } else {
      query = query.where(columnName as any, 'in', realValues);
    }
  }

  return await query.orderBy('ai.id').execute();
}
