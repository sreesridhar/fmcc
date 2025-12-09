<?php

require_once __DIR__ . '/core/Database.php';

echo "Setting up database...\n";

try {
    $db = Database::getInstance()->getConnection();
    
    // Read schema
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    if (!$sql) {
        die("Error: Could not read schema.sql\n");
    }

    // Execute multi-query
    $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, 0); // Important for multi-query
    $db->exec($sql);
    
    echo "Database schema imported successfully.\n";
    
    // Create a default super admin if not exists
    $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE username = 'admin'");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $password = password_hash('admin123', PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'super_admin')");
        $stmt->execute([$password]);
        echo "Default super admin created (User: admin, Pass: admin123)\n";
    }

} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
    echo "Please check config/database.php\n";
}
