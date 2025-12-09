<?php
require_once __DIR__ . '/core/Database.php';

$db = new Database();
$users = $db->fetchAll("SELECT id, username, role FROM users LIMIT 5");
print_r($users);
