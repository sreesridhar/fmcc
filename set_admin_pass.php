<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$password = 'admin123';
$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $db->query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [$hash]);
    echo "Password for 'admin' reset to '$password'\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
