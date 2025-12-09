<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$username = 'test_fix_' . time();
$password_hash = '$2y$10$abcdefg'; // Dummy hash
$role = 'staff';
// Simulate the fixed logic:
$input_org_id = ''; 
$org_id = !empty($input_org_id) ? $input_org_id : null;

echo "Attempting to insert user with processed org_id (should be NULL)...\n";

try {
    $id = $db->insert("INSERT INTO users (username, password_hash, role, org_id) VALUES (?, ?, ?, ?)", [
        $username,
        $password_hash,
        $role,
        $org_id
    ]);
    echo "Success! User ID: $id\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
