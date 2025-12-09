<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();

try {
    // Add status column to sites
    $db->query("ALTER TABLE sites ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER location");
    echo "Added status column to sites table.\n";
} catch (PDOException $e) {
    echo "Error (might already exist): " . $e->getMessage() . "\n";
}
