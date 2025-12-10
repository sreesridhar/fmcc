<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pass = password_hash('password', PASSWORD_DEFAULT);
$perms = json_encode(['clients.view']); 

// Check if exists
$u = $db->fetch("SELECT id FROM users WHERE username = 'test_restricted'");
if ($u) {
    $db->query("UPDATE users SET permissions = ?, role = 'staff', password_hash = ? WHERE id = ?", [$perms, $pass, $u['id']]);
    echo "Updated test_restricted user.\n";
} else {
    $db->query("INSERT INTO users (username, password_hash, role, permissions, org_id) VALUES ('test_restricted', ?, 'staff', ?, 1)", [$pass, $perms]);
    echo "Created test_restricted user.\n";
}
