<?php
// debug_client_api.php
require_once __DIR__ . '/core/Database.php';
session_start();

function test_create($role, $org_id, $payload) {
    echo "Testing role: $role, payload: " . json_encode($payload) . "\n";
    
    // Mock Session
    $_SESSION['user_id'] = 999;
    $_SESSION['role'] = $role;
    $_SESSION['org_id'] = ($role === 'super_admin') ? null : $org_id;
    $_SESSION['username'] = 'tester';
    
    // Mock Request
    $ch = curl_init('http://localhost:8000/api/v1/clients');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    // We need to pass the session cookie, but we can't easily do that with curl to localhost if the session is mocked here.
    // Instead, let's modify the Controller temporarily or just instantiate it directly?
    // Instantiating directly is better.
    
    // Actually, we can just use the Controller directly since we are in the same environment if we include it.
}

// Direct Controller Test
require_once __DIR__ . '/core/Controllers/ClientController.php';

// Mock Auth class
class MockAuth {
    public function requireLogin() { return true; }
    public function hasRole($r) { return $_SESSION['role'] === $r; }
    public function getOrgId() { return $_SESSION['org_id']; }
}

// Extend ClientController to inject mock auth
class TestClientController extends ClientController {
    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new MockAuth();
    }
}

// Test Wrapper
function run_test($role, $sess_org_id, $payload) {
    echo "------------------------------------------------\n";
    echo "Testing Role: $role, Session Org: " . ($sess_org_id ?? 'NULL') . "\n";
    echo "Payload: " . json_encode($payload) . "\n";
    
    $_SESSION['role'] = $role;
    $_SESSION['org_id'] = $sess_org_id;
    
    // Mock input
    $input = json_encode($payload);
    
    // Capture Output
    ob_start();
    
    // We need to override file_get_contents('php://input')... harder.
    // Actually, let's just modify the controller to accept data or direct manipulation?
    // No, let's just use a real basic cURL test but we need to login first.
    // Login -> Get Cookie -> POST
    
    // Login as Admin
    $cookie_file = __DIR__ . '/cookie_' . $role . '.txt';
    if (file_exists($cookie_file)) unlink($cookie_file);
    
    $login_payload = array();
    if ($role === 'super_admin') {
        $login_payload = ['username' => 'admin', 'password' => 'admin123']; // Assuming default? Wait, I don't know password.
        // I checked users table, admin exists. I don't know password.
        // But I can reset it.
    } else {
        $login_payload = ['username' => 'sridhar', 'password' => 'password']; // Unknown
    }
    
    // Okay, Plan B:
    // Modify ClientController to allow dependency injection of data? No, too invasive.
    // Plan C: Create a test script that sets $_SESSION directly then includes the controller file? 
    // The controller constructor creates 'new Auth()'.
    // 'new Auth()' starts session.
    
    // Since we are running cli, session_start() creates a session.
    // If we set $_SESSION vars, Auth will read them.
    // The issue is `file_get_contents('php://input')`. In CLI, we can't easily mock this for the standard input stream that PHP reads.
    
    // Okay, Plan D:
    // Use `php://memory` wrapper? No.
    
    // Let's use the Database directly to see if the Query is failing?
    // Or just look at the code again.
}

// Let's try a different approach. A simple script that sets the $_SESSION and calls the logic of the controller, 
// but we just copy the logic here to reproduce it. If logic works, it's environment.

$db = Database::getInstance();
echo "DB Connected.\n";

$role = 'super_admin';
$org_id_param = 1; // Demo Org
$name = 'Test Client ' . time();

if ($role === 'super_admin') {
    if (empty($org_id_param)) {
        echo "Error: Org ID required\n";
    } else {
        echo "Validating Org ID $org_id_param...\n";
    }
} else {
    // get org from session
}

// Try Insert
try {
    $id = $db->insert("INSERT INTO clients (org_id, name, status, parent_client_id) VALUES (?, ?, ?, ?)", [
        $org_id_param,
        $name,
        'active',
        null
    ]);
    echo "Success! ID: $id\n";
} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
