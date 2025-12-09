<?php
// ... (previous setup)
// Use the same context setup as before. To avoid repetition, I'll rewrite the whole file briefly.

require_once __DIR__ . '/core/Database.php';
$db = Database::getInstance();

// 1. Reset Password
$password = 'password123';
$hash = password_hash($password, PASSWORD_DEFAULT);
$db->query("UPDATE users SET password_hash = ? WHERE username = 'sridhar'", [$hash]);

// 2. Login
$url = 'http://localhost:8000/api/v1/login';
$data = json_encode(['username' => 'sridhar', 'password' => $password]);
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
$headers = $http_response_header;

$cookies = [];
foreach ($headers as $header) {
    if (preg_match('/^Set-Cookie:\s*([^;]+)/', $header, $matches)) {
        $cookies[] = $matches[1];
    }
}
$cookieStr = implode('; ', $cookies);

// 3. Create User
$newUsername = 'sridhar_staff_' . time();
$url = 'http://localhost:8000/api/v1/users';
$userData = json_encode([
    'username' => $newUsername,
    'password' => '123456',
    'role' => 'staff'
]);
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n" . "Cookie: $cookieStr\r\n",
        'method'  => 'POST',
        'content' => $userData,
        'ignore_errors' => true
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo "Create Result: $result\n";

// 4. List Users
$url = 'http://localhost:8000/api/v1/users';
$options = [
    'http' => [
        'header'  => "Cookie: $cookieStr\r\n",
        'method'  => 'GET',
        'ignore_errors' => true
    ]
];
$context  = stream_context_create($options);
$listResult = file_get_contents($url, false, $context);
echo "List Users Result Length: " . strlen($listResult) . "\n";
$users = json_decode($listResult, true);

$found = false;
foreach ($users as $u) {
    if ($u['username'] === $newUsername) {
        $found = true;
        echo "Found created user: " . json_encode($u) . "\n";
        break;
    }
}

if (!$found) {
    echo "ERROR: Created user NOT found in list!\n";
    // Check DB to see what org_id it got
    $check = $db->fetch("SELECT * FROM users WHERE username = ?", [$newUsername]);
    echo "DB Record: " . json_encode($check) . "\n";
}
