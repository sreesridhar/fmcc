<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class ClientController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('clients', 'view')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        $sql = "SELECT c.*, p.name as parent_client_name, o.name as org_name
                FROM clients c
                LEFT JOIN clients p ON c.parent_client_id = p.id
                JOIN organizations o ON c.org_id = o.id";
        
        $params = [];
        
        if (!$this->auth->hasRole('super_admin')) {
             if (!$org_id) { echo json_encode([]); return; }
             $sql .= " WHERE c.org_id = ?";
             $params[] = $org_id;
        }
        
        $sql .= " ORDER BY c.created_at DESC";
        
        $clients = $this->db->fetchAll($sql, $params);
        echo json_encode($clients);
    }

    public function create() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('clients', 'create')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        try {
            
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Determine Org ID
            $org_id = null;
            if ($this->auth->hasRole('super_admin')) {
                if (empty($data['org_id'])) {
                    http_response_code(400); 
                    echo json_encode(['error' => 'Organization ID required for Super Admin']); 
                    return;
                }
                $org_id = $data['org_id'];
            } else {
                $org_id = $this->auth->getOrgId();
            }
            
            if (!$org_id) { 
                http_response_code(403); 
                echo json_encode(['error' => 'No active organization found. Please login again.']); 
                return; 
            }

            if (empty($data['name'])) {
                http_response_code(400); 
                echo json_encode(['error' => 'Name required']); 
                return;
            }

            $parent_id = !empty($data['parent_client_id']) ? $data['parent_client_id'] : null;

            // Generate Local ID
            $maxLocal = $this->db->fetch("SELECT MAX(local_id) as max_id FROM clients WHERE org_id = ?", [$org_id]);
            $localId = ($maxLocal['max_id'] ?? 0) + 1;

            $id = $this->db->insert("INSERT INTO clients (org_id, local_id, name, status, parent_client_id) VALUES (?, ?, ?, ?, ?)", [
                $org_id,
                $localId,
                $data['name'],
                $data['status'] ?? 'active',
                $parent_id
            ]);

            echo json_encode(['success' => true, 'id' => $id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create client: ' . $e->getMessage()]);
        }
    }

    public function update($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('clients', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        
        $data = json_decode(file_get_contents('php://input'), true);

        // Permission Check
        if ($this->auth->hasRole('super_admin')) {
             // Super Admins can edit any client, or verify existence
             $client = $this->db->fetch("SELECT id, org_id FROM clients WHERE id = ?", [$id]);
        } else {
             $org_id = $this->auth->getOrgId();
             if (!$org_id) { http_response_code(403); echo json_encode(['error' => 'No active organization']); return; }
             $client = $this->db->fetch("SELECT id FROM clients WHERE id = ? AND org_id = ?", [$id, $org_id]);
        }
        
        if (!$client) { http_response_code(404); echo json_encode(['error' => 'Client not found or access denied']); return; }

        $sql = "UPDATE clients SET name = ?, status = ?, parent_client_id = ? WHERE id = ?";
        $parent_id = !empty($data['parent_client_id']) ? $data['parent_client_id'] : null;
        
        // Prevent circular dependency
        if ($parent_id == $id) {
            http_response_code(400); echo json_encode(['error' => 'Self cannot be parent']); return;
        }

        $this->db->query($sql, [
            $data['name'],
            $data['status'] ?? ($client['status'] ?? 'active'),
            $parent_id,
            $id
        ]);
        
        echo json_encode(['success' => true]);
    }

    public function delete($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('clients', 'delete')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        
        // Permission Check
        if ($this->auth->hasRole('super_admin')) {
             $client = $this->db->fetch("SELECT id FROM clients WHERE id = ?", [$id]);
        } else {
             $org_id = $this->auth->getOrgId();
             if (!$org_id) { http_response_code(403); echo json_encode(['error' => 'No active organization']); return; }
             $client = $this->db->fetch("SELECT id FROM clients WHERE id = ? AND org_id = ?", [$id, $org_id]);
        }

        if (!$client) { http_response_code(404); echo json_encode(['error' => 'Client not found or access denied']); return; }

        try {
            $this->db->query("DELETE FROM clients WHERE id = ?", [$id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete client. It may be in use by transactions.']);
        }
    }
}
