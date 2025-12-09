<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "Starting migration for users local_id...\n";

try {
    // Add local_id column
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'local_id'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE users ADD COLUMN local_id INT DEFAULT 0 AFTER org_id");
            echo "Added column local_id.\n";
        } else {
            echo "Column local_id already exists.\n";
        }
    } catch (Exception $e) { echo "Error checking/adding column: " . $e->getMessage() . "\n"; }

    // Add index
    try {
        // Simple check if index exists is hard in generic SQL without querying information_schema, 
        // relying on try-catch for "Duplicate key name" error is common in migration scripts here.
        $pdo->exec("CREATE INDEX idx_users_org_local ON users(org_id, local_id)");
        echo "Added index idx_users_org_local.\n";
    } catch (Exception $e) { echo "Index might already exist.\n"; }

    echo "Backfilling data...\n";

    // Group 1: Users with Org ID
    $orgs = $db->fetchAll("SELECT id FROM organizations");
    foreach ($orgs as $org) {
        $orgId = $org['id'];
        echo "Processing Users for Org $orgId...\n";
        
        $users = $db->fetchAll("SELECT id FROM users WHERE org_id = ? ORDER BY id ASC", [$orgId]);
        $counter = 1;
        foreach ($users as $u) {
            $db->query("UPDATE users SET local_id = ? WHERE id = ?", [$counter, $u['id']]);
            $counter++;
        }
    }
    
    // Group 2: Super Admins or specific cases (org_id IS NULL)
    echo "Processing Users without Org (Super Admins)...\n";
    $admins = $db->fetchAll("SELECT id FROM users WHERE org_id IS NULL ORDER BY id ASC");
    $counter = 1;
    foreach ($admins as $u) {
        $db->query("UPDATE users SET local_id = ? WHERE id = ?", [$counter, $u['id']]);
        $counter++;
    }

    echo "Migration completed.\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
