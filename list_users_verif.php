<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$users = $db->fetchAll("SELECT id, username, role, permissions FROM users");

foreach ($users as $u) {
    echo "ID: {$u['id']}, User: {$u['username']}, Role: {$u['role']}, Perms: {$u['permissions']}\n";
}
