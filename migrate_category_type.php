<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
echo "Migrating categories table...\n";

try {
    // Modify column to be nullable
    $db->query("ALTER TABLE categories MODIFY type ENUM('income', 'expense') NULL");
    echo "Modified type column to be NULLable.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
echo "Migration complete.\n";
