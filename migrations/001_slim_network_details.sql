-- Slim asset_network_details to only ip_address and mac_address
-- Run against MariaDB before deploying the updated code

ALTER TABLE asset_network_details
    DROP COLUMN ip_configuration,
    DROP COLUMN network_connection_type,
    DROP COLUMN ssid,
    DROP COLUMN network_vpn,
    DROP COLUMN ethernet_patch_port,
    DROP COLUMN switch_port;
