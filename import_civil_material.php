<?php
require_once __DIR__ . '/core/Database.php';

$db = Database::getInstance();

$userId = 2; // sridhar
$orgId = 1;

// 1. Get or Create Category "Civil Material"
$catName = "Civil Material";
$cat = $db->fetch("SELECT * FROM categories WHERE name = ? AND org_id = ?", [$catName, $orgId]);

if (!$cat) {
    echo "Creating category: $catName\n";
    $db->query("INSERT INTO categories (name, type, org_id) VALUES (?, ?, ?)", [$catName, 'expense', $orgId]);
    $catId = $db->lastInsertId();
} else {
    echo "Using existing category: $catName (ID: " . $cat['id'] . ")\n";
    $catId = $cat['id'];
}

// 2. Data to Import
$data = [
    ['date' => '02/02/2025', 'desc' => 'STEEL', 'amount' => 40936, 'details' => 'Steel Material'],
    ['date' => '02/02/2025', 'desc' => 'STEEL', 'amount' => 3600, 'details' => 'Steel Material'],
    ['date' => '10/02/2025', 'desc' => 'CEMENT', 'amount' => 12800, 'details' => 'Cement Material']
];

foreach ($data as $row) {
    // Convert Date DD/MM/YYYY -> YYYY-MM-DD
    $dateParts = explode('/', $row['date']);
    $isoDate = "{$dateParts[2]}-{$dateParts[1]}-{$dateParts[0]}";
    
    echo "Inserting: {$isoDate} - {$row['desc']} - {$row['amount']}\n";
    
    $sql = "INSERT INTO transactions (org_id, user_id, category_id, client_id, site_id, amount, transaction_date, description, transaction_type, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expense', NOW())";
            
            // Description combines DESC and Details for clarity
    $fullDesc = $row['desc'] . " - " . $row['details'];
    
    $clientId = 4; // SARAVANAN AVAVDI
    $siteId = 2;   // House (under Saravanan)
    
    $db->query($sql, [
        $orgId, 
        $userId, 
        $catId,
        $clientId,
        $siteId,
        $row['amount'], 
        $isoDate, 
        $fullDesc
    ]);
}

echo "Import Complete.\n";
