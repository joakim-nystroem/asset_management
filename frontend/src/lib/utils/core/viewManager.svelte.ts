// src/lib/utils/core/viewManager.svelte.ts

export type ViewConfig = {
  name: string;
  label: string;
  filter?: { column: string; values: string[] } | null;
  columnOrder?: string[];
  extraColumns?: string[];
  columnWidths?: Record<string, number>;
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
    ],
    columnWidths: {
      hardware_ped_emv: 180,
      appm_ped_emv: 170,
      vfop_ped_emv: 160,
      vfsred_ped_emv: 170,
      vault_ped_emv: 160,
      physical_security_method_ped_emv: 250,
    }
  },
  {
    name: 'computer',
    label: 'Computer',
    filter: null,
    extraColumns: ['operating_system', 'os_version', 'in_cmdb'],
    columnWidths: {
      operating_system: 170,
      os_version: 140,
      in_cmdb: 100,
      galaxy_version: 160,
      galaxy_role: 130,
      retail_software: 160,
      retail_version: 150,
      terminal_id: 130,
    }
  },
  {
    name: 'network',
    label: 'Network',
    filter: null,
    extraColumns: [
      'ip_address', 'mac_address', 'ip_configuration',
      'network_connection_type', 'ssid', 'network_vpn',
      'ethernet_patch_port', 'switch_port'
    ],
    columnWidths: {
      ip_address: 150,
      mac_address: 170,
      ip_configuration: 170,
      network_connection_type: 210,
      ssid: 120,
      network_vpn: 140,
      ethernet_patch_port: 180,
      switch_port: 140,
    }
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
