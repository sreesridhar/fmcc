<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "Starting migration for permissions...\n";

try {
    // Add permissions column
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'permissions'");
    if ($stmt->rowCount() == 0) {
        // Use JSON type for permissions. Default NULL.
        $pdo->exec("ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role");
        echo "Added column permissions.\n";
    } else {
        echo "Column permissions already exists.\n";
    }

    echo "Migration completed.\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
