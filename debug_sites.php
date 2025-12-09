<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
try {
    $sites = $db->fetchAll("SELECT * FROM sites");
    echo "Count: " . count($sites) . "\n";
    print_r($sites);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
