<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();

echo "Migrating organizations table to add 'logo' column...\n";

try {
    // Check if column exists
    $cols = $db->fetchAll("DESCRIBE organizations");
    $hasLogo = false;
    foreach ($cols as $col) {
        if ($col['Field'] === 'logo') {
            $hasLogo = true;
            break;
        }
    }

    if (!$hasLogo) {
        $db->query("ALTER TABLE organizations ADD COLUMN logo VARCHAR(255) NULL AFTER name");
        echo "Added 'logo' column.\n";
    } else {
        echo "'logo' column already exists.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
