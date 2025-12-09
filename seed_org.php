<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();

echo "Seeding default organization...\n";

// 1. Create Organization
$org = $db->fetch("SELECT * FROM organizations WHERE name = ?", ['Demo Organization']);
if (!$org) {
    $org_id = $db->insert("INSERT INTO organizations (name, status) VALUES (?, ?)", ['Demo Organization', 'active']);
    echo "Created 'Demo Organization' with ID: $org_id\n";
} else {
    $org_id = $org['id'];
    echo "'Demo Organization' already exists (ID: $org_id)\n";
}

// 2. Update User 'sridhar'
$user = $db->fetch("SELECT * FROM users WHERE username = ?", ['sridhar']);
if ($user) {
    $db->query("UPDATE users SET org_id = ? WHERE id = ?", [$org_id, $user['id']]);
    echo "Updated user 'sridhar' with org_id: $org_id\n";
} else {
    echo "User 'sridhar' not found.\n";
}

echo "Seeding complete.\n";
