<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pass = password_hash('password123', PASSWORD_DEFAULT);
$db->query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [$pass]);
echo "Password reset for admin to 'password123'";
