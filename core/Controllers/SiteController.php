<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class SiteController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('sites', 'view')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = $_GET['search'] ?? '';
        $client_id = $_GET['client_id'] ?? '';
        $status = $_GET['status'] ?? '';
        
        $params = [];
        $where = [];

        // Org Filter Logic
        if ($this->auth->hasRole('super_admin')) {
             if (!empty($_GET['org_id'])) {
                 $where[] = "s.org_id = ?";
                 $params[] = $_GET['org_id'];
             } else {
                 $where[] = "1=1"; // Show all if no specific org selected
             }
        } else {
             $where[] = "s.org_id = ?";
             $params[] = $org_id;
        }

        if ($search) {
            $where[] = "(s.name LIKE ? OR s.location LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        if ($client_id) {
            $where[] = "s.client_id = ?";
            $params[] = $client_id;
        }
        if ($status) {
            $where[] = "s.status = ?";
            $params[] = $status;
        }
        
        $whereSql = implode(" AND ", $where);
        
        // Main Query with aggregated stats
        // Using subqueries for stats to ensure correct aggregation per site regardless of transaction count
        $sql = "SELECT s.*, c.name as client_name,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions t WHERE t.site_id = s.id AND t.transaction_type = 'income') as total_income,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions t WHERE t.site_id = s.id AND t.transaction_type = 'expense') as total_expense
                FROM sites s 
                LEFT JOIN clients c ON s.client_id = c.id 
                WHERE $whereSql
                ORDER BY s.id DESC 
                LIMIT $limit OFFSET $offset";
                
        // Fetch items
        $sites = $this->db->fetchAll($sql, $params);
        
        // Count total for pagination (optional, but good for 'has_more' logic if needed strictly, 
        // but for infinite scroll we can just check if count(sites) == limit)
        // Let's just return what we have.
        
        echo json_encode($sites);
    }

    public function update($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('sites', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();

        // Verify ownership
        $site = $this->db->fetch("SELECT id FROM sites WHERE id = ? AND org_id = ?", [$id, $org_id]);
        if (!$site) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            http_response_code(400); echo json_encode(['error' => 'Name required']); return;
        }
        
        // client_id can be updated
        $client_id = !empty($data['client_id']) ? $data['client_id'] : null;

        $this->db->query("UPDATE sites SET name = ?, location = ?, client_id = ?, status = ?, estimated_cost = ? WHERE id = ?", [
            $data['name'],
            $data['location'] ?? null,
            $client_id,
            $data['status'] ?? 'active',
            $data['estimated_cost'] ?? 0,
            $id
        ]);

        echo json_encode(['success' => true]);
    }

    public function create() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('sites', 'create')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        if (!$this->auth->hasRole('super_admin') && !$org_id) {
            http_response_code(403); 
            echo json_encode(['error' => 'No active organization']); 
            return; 
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            http_response_code(400); echo json_encode(['error' => 'Name required']); return;
        }
        
        // Ensure Org ID is set for Super Admin if passed
        if ($this->auth->hasRole('super_admin') && !empty($data['org_id'])) {
            $org_id = $data['org_id'];
        }

        $client_id = !empty($data['client_id']) ? $data['client_id'] : null;

        // Generate Local ID
        $maxLocal = $this->db->fetch("SELECT MAX(local_id) as max_id FROM sites WHERE org_id = ?", [$org_id]);
        $localId = ($maxLocal['max_id'] ?? 0) + 1;

        $id = $this->db->insert("INSERT INTO sites (org_id, local_id, name, location, client_id, estimated_cost) VALUES (?, ?, ?, ?, ?, ?)", [
            $org_id,
            $localId,
            $data['name'],
            $data['location'] ?? '',
            $client_id,
            $data['estimated_cost'] ?? 0
        ]);

        echo json_encode(['success' => true, 'id' => $id]);
    }
}
