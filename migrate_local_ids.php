<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "Starting migration for local_ids...\n";

try {
    // Add local_id columns if they don't exist
    // MySQL 5.7 doesn't support IF NOT EXISTS for columns, so we try and catch
    try {
        $pdo->exec("ALTER TABLE clients ADD COLUMN local_id INT DEFAULT 0");
    } catch (Exception $e) { echo "Column local_id in clients might already exist.\n"; }

    try {
        $pdo->exec("ALTER TABLE sites ADD COLUMN local_id INT DEFAULT 0");
    } catch (Exception $e) { echo "Column local_id in sites might already exist.\n"; }
    
    // Add composite indexes for performance and uniqueness
    // We use a safe try-catch for index creation as 'IF NOT EXISTS' syntax for indexes varies or is missing in some MySQL versions
    try {
        $pdo->exec("CREATE INDEX idx_clients_org_local ON clients(org_id, local_id)");
    } catch (Exception $e) { echo "Index idx_clients_org_local might already exist.\n"; }

    try {
        $pdo->exec("CREATE INDEX idx_sites_org_local ON sites(org_id, local_id)");
    } catch (Exception $e) { echo "Index idx_sites_org_local might already exist.\n"; }

    echo "Columns added. Backfilling data...\n";

    // Backfill Clients
    $orgs = $db->fetchAll("SELECT id FROM organizations");
    foreach ($orgs as $org) {
        $orgId = $org['id'];
        echo "Processing Clients for Org $orgId...\n";
        
        $clients = $db->fetchAll("SELECT id FROM clients WHERE org_id = ? ORDER BY id ASC", [$orgId]);
        $counter = 1;
        foreach ($clients as $client) {
            $db->query("UPDATE clients SET local_id = ? WHERE id = ?", [$counter, $client['id']]);
            $counter++;
        }
        
        echo "Processing Sites for Org $orgId...\n";
        $sites = $db->fetchAll("SELECT id FROM sites WHERE org_id = ? ORDER BY id ASC", [$orgId]);
        $counter = 1;
        foreach ($sites as $site) {
             $db->query("UPDATE sites SET local_id = ? WHERE id = ?", [$counter, $site['id']]);
             $counter++;
        }
    }

    echo "Migration completed successfully.\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
