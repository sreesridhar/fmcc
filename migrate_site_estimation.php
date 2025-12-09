<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "Starting migration for site estimated_cost...\n";

try {
    try {
        $pdo->exec("ALTER TABLE sites ADD COLUMN estimated_cost DECIMAL(15, 2) DEFAULT 0.00");
        echo "Column estimated_cost added to sites.\n";
    } catch (Exception $e) {
        echo "Column estimated_cost might already exist.\n";
    }
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
