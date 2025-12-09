<?php
require_once __DIR__ . '/core/Database.php';

echo "Resetting Admin User...\n";

try {
    $db = Database::getInstance()->getConnection();
    
    $username = 'admin';
    $password = 'admin123';
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Check if user exists
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Update
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$hash, $user['id']]);
        echo "Admin password updated.\n";
    } else {
        // Insert
        $stmt = $db->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'super_admin')");
        $stmt->execute([$username, $hash]);
        echo "Admin user created.\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
