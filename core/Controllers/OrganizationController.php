<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class OrganizationController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasRole('super_admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        $orgs = $this->db->fetchAll("SELECT * FROM organizations ORDER BY id DESC LIMIT $limit OFFSET $offset");
        $count = $this->db->fetchOne("SELECT COUNT(*) as total FROM organizations");
        
        echo json_encode([
            'data' => $orgs,
            'total' => (int)($count['total'] ?? 0)
        ]);
    }

    public function create() {
        $this->auth->requireLogin();
        if (!$this->auth->hasRole('super_admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Name is required']);
            return;
        }

        $id = $this->db->insert("INSERT INTO organizations (name, status) VALUES (?, ?)", [
            $data['name'],
            $data['status'] ?? 'active'
        ]);

        echo json_encode(['success' => true, 'id' => $id]);
    }

    public function update($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasRole('super_admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        $this->db->query("UPDATE organizations SET name = ?, status = ? WHERE id = ?", [
            $data['name'],
            $data['status'],
            $id
        ]);
        
        echo json_encode(['success' => true]);
    }

    public function delete($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasRole('super_admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }

        $this->db->query("DELETE FROM organizations WHERE id = ?", [$id]);
        echo json_encode(['success' => true]);
    }

    public function getProfile() {
        $this->auth->requireLogin();
        $orgId = $this->auth->getOrgId();
        
        if (!$orgId) {
            http_response_code(404); echo json_encode(['error' => 'No organization associated']); return;
        }

        $org = $this->db->fetch("SELECT * FROM organizations WHERE id = ?", [$orgId]);
        echo json_encode($org);
    }

    public function updateProfile() {
        $this->auth->requireLogin();
        $orgId = $this->auth->getOrgId();
        
        if (!$orgId || !$this->auth->hasRole('org_admin')) {
             // Super admin has org_id null usually, but if they want to update "their" org profile it's ambiguous. 
             // Requirement says "each org_admin should have there own orginazation profile page".
             // So strict check for org_admin or if user has org_id.
             if (!$orgId) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
             }
        }

        // Handle Multipart/Form-data (standard $_POST, $_FILES works automatically)
        $name = $_POST['name'] ?? null;
        
        $updates = [];
        $params = [];
        
        if ($name) {
            $updates[] = "name = ?";
            $params[] = $name;
        }

        // Handle Logo Deletion
        $deleteLogo = $_POST['delete_logo'] ?? false;
        if ($deleteLogo) {
            // Get current logo to delete file
            $currentOrg = $this->db->fetch("SELECT logo FROM organizations WHERE id = ?", [$orgId]);
            if ($currentOrg && $currentOrg['logo']) {
                $filePath = __DIR__ . '/../../public' . $currentOrg['logo'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
                $updates[] = "logo = NULL";
            }
        }

        // Handle File Upload (only if not deleting, or replacing)
        if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = __DIR__ . '/../../public/uploads/logos';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $ext = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
            $filename = 'org_' . $orgId . '_' . time() . '.' . $ext;
            $targetPath = $uploadDir . '/' . $filename;
            
            if (move_uploaded_file($_FILES['logo']['tmp_name'], $targetPath)) {
                $updates[] = "logo = ?";
                $params[] = '/uploads/logos/' . $filename;
            } else {
                 http_response_code(500); echo json_encode(['error' => 'Failed to upload file']); return;
            }
        }

        if (empty($updates)) {
            echo json_encode(['success' => true, 'message' => 'No changes']); return;
        }

        $params[] = $orgId;
        $sql = "UPDATE organizations SET " . implode(', ', $updates) . " WHERE id = ?";
        $this->db->query($sql, $params);

        echo json_encode(['success' => true]);
    }
}
