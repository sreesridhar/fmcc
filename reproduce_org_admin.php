<?php
// Mock Session
session_start();
$_SESSION['user_id'] = 2; // sridhar
$_SESSION['username'] = 'sridhar';
$_SESSION['role'] = 'org_admin';
$_SESSION['org_id'] = 1;

require_once __DIR__ . '/core/Controllers/UserController.php';

// Mock Auth to avoid actual header rewrites/exits if possible, 
// or just use the controller directly but we need to bypass 'requireLogin' if it exits.
// UserController::create calls requireLogin(). 
// Auth::requireLogin() calls isLoggedIn(), which checks $_SESSION['user_id']. 
// Since we set it, it should pass.

// However, we need to mock the POST body.
// We can overwrite php://input? No, that's hard. 
// We can modify UserController temporarily for debugging or just duplicate the logic here.
// Duplicating logic is safer to test the *logic* itself.

require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Database.php';

$auth = new Auth();
$db = Database::getInstance();

echo "User Role: " . $_SESSION['role'] . "\n";
echo "Org ID from Auth: " . $auth->getOrgId() . "\n";

$data = [
    'username' => 'test_staff_' . time(),
    'password' => '123456',
    'role' => 'staff'
];

$currentUserRole = $_SESSION['role'];

if (!in_array($currentUserRole, ['super_admin', 'org_admin'])) {
    die("Forbidden role\n");
}

$org_id = null;
if ($currentUserRole === 'super_admin') {
    $org_id = !empty($data['org_id']) ? $data['org_id'] : null;
} else {
    $org_id = $auth->getOrgId();
    if ($data['role'] === 'super_admin') {
        die("Cannot create super admin\n");
    }
}

echo "Determined Org ID for insert: " . var_export($org_id, true) . "\n";

// Check duplication
$exists = $db->fetch("SELECT id FROM users WHERE username = ?", [$data['username']]);
if ($exists) {
    die("Username exists\n");
}

$password_hash = password_hash($data['password'], PASSWORD_DEFAULT);

try {
    $id = $db->insert("INSERT INTO users (username, password_hash, role, org_id) VALUES (?, ?, ?, ?)", [
        $data['username'],
        $password_hash,
        $data['role'],
        $org_id
    ]);
    echo "Success! User ID: $id\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
