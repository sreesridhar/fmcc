<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$orgs = $db->fetchAll("SELECT * FROM organizations");
echo json_encode($orgs, JSON_PRETTY_PRINT);
