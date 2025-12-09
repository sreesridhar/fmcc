<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
echo "Migrating sites table...\n";

try {
    // Check if column exists
    $cols = $db->fetchAll("SHOW COLUMNS FROM sites LIKE 'client_id'");
    if (empty($cols)) {
        $db->query("ALTER TABLE sites ADD COLUMN client_id INT NULL AFTER org_id");
        $db->query("ALTER TABLE sites ADD CONSTRAINT fk_sites_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL");
        echo "Added client_id column and foreign key.\n";
    } else {
        echo "Column client_id already exists.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
echo "Migration complete.\n";
