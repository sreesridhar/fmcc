<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class TransactionController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('transactions', 'view')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        // Filters
        $type = $_GET['type'] ?? null;
        $client_id = $_GET['client_id'] ?? null;
        $site_id = $_GET['site_id'] ?? null;
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        $sql = "SELECT t.*, c.name as category_name, cl.name as client_name, s.name as site_name, u.username as created_by_name, o.name as org_name
                FROM transactions t
                JOIN categories c ON t.category_id = c.id
                JOIN organizations o ON t.org_id = o.id
                LEFT JOIN clients cl ON t.client_id = cl.id
                LEFT JOIN sites s ON t.site_id = s.id
                JOIN users u ON t.created_by = u.id";
        
        $params = [];
        
        // Base Where Clause
        $whereSql = " WHERE 1=1"; 
        // Note: For super_admin, we start with 1=1. For others, we append org_id check.
        // But to be consistent, let's just append.
        
        if (!$this->auth->hasRole('super_admin')) {
             if (!$org_id) { echo json_encode([]); return; }
             $whereSql .= " AND t.org_id = ?";
             $params[] = $org_id;
        }
        
        // Count params must duplicate basic params
        $countParams = $params;

        if ($type) { 
            $whereSql .= " AND t.transaction_type = ?"; 
            $params[] = $type; 
            $countParams[] = $type;
        }
        if ($client_id) { 
            $whereSql .= " AND t.client_id = ?"; 
            $params[] = $client_id; 
            $countParams[] = $client_id;
        }
        if ($site_id) { 
            $whereSql .= " AND t.site_id = ?"; 
            $params[] = $site_id; 
            $countParams[] = $site_id;
        }
        if ($start_date) { 
            $whereSql .= " AND t.transaction_date >= ?"; 
            $params[] = $start_date; 
            $countParams[] = $start_date;
        }
        if ($end_date) { 
            $whereSql .= " AND t.transaction_date <= ?"; 
            $params[] = $end_date; 
            $countParams[] = $end_date;
        }

        $sql .= $whereSql;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        // Count total records before applying LIMIT/OFFSET
        $countSql = "SELECT COUNT(*) as total FROM transactions t JOIN categories c ON t.category_id = c.id" . $whereSql;
        $total = $this->db->fetchOne($countSql, $countParams);
        
        $sql .= " ORDER BY t.transaction_date DESC, t.id DESC LIMIT $limit OFFSET $offset";

        $transactions = $this->db->fetchAll($sql, $params);
        
        echo json_encode([
            'data' => $transactions,
            'total' => (int)($total['total'] ?? 0)
        ]);
    }

    public function create() {
        try {
            $this->auth->requireLogin();
            if (!$this->auth->hasPermission('transactions', 'create')) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
            }
            $org_id = $this->auth->getOrgId();
            $user_id = $this->auth->user()['id'];
            
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);
            
            if (!$data) {
                http_response_code(400); echo json_encode(['error' => 'Invalid JSON input']); return;
            }
            
            // Basic Validation
            if (empty($data['category_id']) || !isset($data['amount']) || empty($data['date'])) {
                http_response_code(400); echo json_encode(['error' => 'Category, Amount, Date are required']); return;
            }
    
            // Get Category to validate type and fields
            $category = $this->db->fetch("SELECT * FROM categories WHERE id = ? AND org_id = ?", [$data['category_id'], $org_id]);
            if (!$category) { http_response_code(404); echo json_encode(['error' => 'Category not found']); return; }
    
            // Determine Transaction Type
            // If category has a specific type, use it. Otherwise use the type from the form (income/expense page)
            $transaction_type = $category['type'];
            if (!$transaction_type) {
                $transaction_type = $data['type'] ?? null;
            }
            
            if (!$transaction_type || !in_array($transaction_type, ['income', 'expense'])) {
                 http_response_code(400); echo json_encode(['error' => 'Invalid transaction type']); return;
            }
    
            // Validate Dynamic Fields
            $fields = $this->db->fetchAll("SELECT * FROM category_fields WHERE category_id = ?", [$category['id']]);
            $custom_data = [];
            
            if ($fields) {
                foreach ($fields as $field) {
                    $value = $data['custom_fields'][$field['field_slug']] ?? null;
                    if ($field['is_required'] && empty($value)) {
                        http_response_code(400); echo json_encode(['error' => "Field {$field['field_name']} is required"]); return;
                    }
                    if ($value !== null) {
                        $custom_data[$field['field_slug']] = $value;
                    }
                }
            }
    
            $id = $this->db->insert(
                "INSERT INTO transactions (org_id, transaction_type, category_id, client_id, site_id, amount, transaction_date, description, custom_data, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                [
                    $org_id,
                    $transaction_type,
                    $data['category_id'],
                    $data['client_id'] ?? null,
                    $data['site_id'] ?? null,
                    $data['amount'],
                    $data['date'],
                    $data['description'] ?? '',
                    json_encode($custom_data),
                    $user_id
                ]
            );
    
            echo json_encode(['success' => true, 'id' => $id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
    public function update($id) {
        try {
            $this->auth->requireLogin();
            if (!$this->auth->hasPermission('transactions', 'edit')) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
            }
            $org_id = $this->auth->getOrgId();
            
            // Verify ownership
            $tx = $this->db->fetch("SELECT id FROM transactions WHERE id = ? AND org_id = ?", [$id, $org_id]);
            if (!$tx) { http_response_code(404); echo json_encode(['error' => 'Transaction not found']); return; }

            $input = file_get_contents('php://input');
            $data = json_decode($input, true);
            
            // Basic Validation
            if (empty($data['category_id']) || !isset($data['amount']) || empty($data['date'])) {
                http_response_code(400); echo json_encode(['error' => 'Category, Amount, Date are required']); return;
            }

            // Get Category
            $category = $this->db->fetch("SELECT * FROM categories WHERE id = ? AND org_id = ?", [$data['category_id'], $org_id]);
            if (!$category) { http_response_code(404); echo json_encode(['error' => 'Category not found']); return; }

            // Validate Dynamic Fields
            $fields = $this->db->fetchAll("SELECT * FROM category_fields WHERE category_id = ?", [$category['id']]);
            $custom_data = [];
            
            if ($fields) {
                foreach ($fields as $field) {
                    $value = $data['custom_fields'][$field['field_slug']] ?? null;
                    if ($field['is_required'] && empty($value)) {
                        http_response_code(400); echo json_encode(['error' => "Field {$field['field_name']} is required"]); return;
                    }
                    if ($value !== null) {
                        $custom_data[$field['field_slug']] = $value;
                    }
                }
            }

            $this->db->query(
                "UPDATE transactions SET category_id = ?, client_id = ?, site_id = ?, amount = ?, transaction_date = ?, description = ?, custom_data = ? WHERE id = ?",
                [
                    $data['category_id'],
                    $data['client_id'] ?? null,
                    $data['site_id'] ?? null,
                    $data['amount'],
                    $data['date'],
                    $data['description'] ?? '',
                    json_encode($custom_data),
                    $id
                ]
            );

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function delete($id) {
        try {
            $this->auth->requireLogin();
            if (!$this->auth->hasPermission('transactions', 'delete')) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
            }
            $org_id = $this->auth->getOrgId();
            
            // Verify ownership
            $tx = $this->db->fetch("SELECT id FROM transactions WHERE id = ? AND org_id = ?", [$id, $org_id]);
            if (!$tx) { http_response_code(404); echo json_encode(['error' => 'Transaction not found']); return; }

            $this->db->query("DELETE FROM transactions WHERE id = ?", [$id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
