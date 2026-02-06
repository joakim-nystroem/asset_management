// src/lib/utils/core/viewManager.svelte.ts

export type ViewConfig = {
  name: string;
  label: string;
  filter?: { column: string; values: string[] } | null;
  columnOrder?: string[];
  extraColumns?: string[];
};

const VIEW_CONFIGS: ViewConfig[] = [
  { name: 'default', label: 'Default', filter: null },
  { name: 'audit', label: 'Audit', filter: null },
  {
    name: 'ped',
    label: 'PED',
    filter: { column: 'asset_type', values: ['PED / EMV'] },
    extraColumns: [
      'hardware_ped_emv', 'appm_ped_emv', 'vfop_ped_emv',
      'vfsred_ped_emv', 'vault_ped_emv', 'physical_security_method_ped_emv'
    ]
  },
  {
    name: 'computer',
    label: 'Computer',
    filter: null,
    extraColumns: ['operating_system', 'os_version', 'in_cmdb']
  },
  {
    name: 'network',
    label: 'Network',
    filter: null,
    extraColumns: [
      'ip_address', 'mac_address', 'ip_configuration',
      'network_connection_type', 'ssid', 'network_vpn',
      'ethernet_patch_port', 'switch_port'
    ]
  },
];

function createViewManager() {
  let currentView = $state('default');

  function setView(viewName: string) {
    const config = VIEW_CONFIGS.find(v => v.name === viewName);
    if (config) {
      currentView = viewName;
    }
  }

  function getConfig(): ViewConfig {
    return VIEW_CONFIGS.find(v => v.name === currentView) ?? VIEW_CONFIGS[0];
  }

  return {
    get currentView() { return currentView; },
    get currentLabel() {
      return VIEW_CONFIGS.find(v => v.name === currentView)?.label ?? 'Default';
    },
    get views() { return VIEW_CONFIGS; },
    get needsServerData() {
      return currentView !== 'default';
    },

    setView,
    getConfig,
  };
}

export type ViewManager = ReturnType<typeof createViewManager>;

// Export singleton instance
export const viewManager = createViewManager();
