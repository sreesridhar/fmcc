<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$users = $db->fetchAll("SELECT id, username, role, org_id FROM users");
echo json_encode($users, JSON_PRETTY_PRINT);
