<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class UserController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('users', 'view')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        
        // Super Admin sees all users? Or maybe just Org Admins?
        // Let's say Super Admin sees all, Org Admin sees their org's users.
        
        $params = [];
        $sql = "SELECT users.id, users.local_id, users.username, users.role, users.org_id, users.permissions, organizations.name as org_name 
                FROM users 
                LEFT JOIN organizations ON users.org_id = organizations.id";
        
        if (!$this->auth->hasRole('super_admin')) {
            $sql .= " WHERE users.org_id = ?";
            $params[] = $this->auth->getOrgId();
        }
        
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        // Actually simpler to just run count query with same filters
        // Let's keep it simple for now, assume filtering logic matches.
        // Re-construct count query properly.
        
        $sqlCount = "SELECT COUNT(*) as total FROM users WHERE 1=1";
        $countParams = [];
        if (isset($_GET['username'])) {
            $sqlCount .= " AND username LIKE ?";
            $countParams[] = "%" . $_GET['username'] . "%";
        }
        if (isset($_GET['org_id'])) {
            $sqlCount .= " AND org_id = ?";
            $countParams[] = $_GET['org_id'];
        }
        
        $sql .= " ORDER BY users.id DESC LIMIT $limit OFFSET $offset";

        $users = $this->db->fetchAll($sql, $params);
        $total = $this->db->fetchOne($sqlCount, $countParams);
        
        echo json_encode([
             'data' => $users, 
             'total' => (int)($total['total'] ?? 0)
        ]);
    }

    public function create() {
        $this->auth->requireLogin();
        $currentUserRole = $_SESSION['role'];
        
        if (!$this->auth->hasPermission('users', 'create')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['username']) || empty($data['password']) || empty($data['role'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing fields']);
            return;
        }

        // Logic check: Org Admins can only create managers/staff for THEIR org
        $org_id = null;
        if ($currentUserRole === 'super_admin') {
            $org_id = !empty($data['org_id']) ? $data['org_id'] : null;
        } else {
            $org_id = $this->auth->getOrgId();
            if ($data['role'] === 'super_admin') {
                http_response_code(403); echo json_encode(['error' => 'Cannot create super admin']); return;
            }
        }
        
        // Calculate local_id
        if ($org_id === null) {
            $max = $this->db->fetch("SELECT MAX(local_id) as max_id FROM users WHERE org_id IS NULL");
        } else {
            $max = $this->db->fetch("SELECT MAX(local_id) as max_id FROM users WHERE org_id = ?", [$org_id]);
        }
        $local_id = ($max['max_id'] ?? 0) + 1;

        // Check duplication
        $exists = $this->db->fetch("SELECT id FROM users WHERE username = ?", [$data['username']]);
        if ($exists) {
            http_response_code(400); 
            echo json_encode(['error' => 'Username already exists']); 
            return;
        }

        $password_hash = password_hash($data['password'], PASSWORD_DEFAULT);
        
        $permissions = !empty($data['permissions']) ? json_encode($data['permissions']) : null;

        $id = $this->db->insert("INSERT INTO users (username, password_hash, role, org_id, local_id, permissions) VALUES (?, ?, ?, ?, ?, ?)", [
            $data['username'],
            $password_hash,
            $data['role'],
            $org_id,
            $local_id,
            $permissions
        ]);

        echo json_encode(['success' => true, 'id' => $id]);
    }

    public function update($id) {
        $this->auth->requireLogin();
        $currentUserRole = $_SESSION['role'];
        $currentUserId = $_SESSION['user_id'];
        
        if (!$this->auth->hasPermission('users', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }

        $user = $this->db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
        if (!$user) { http_response_code(404); echo json_encode(['error' => 'User not found']); return; }

        // Non-super-admins can only modify users in their org
        if (!$this->auth->hasRole('super_admin') && $user['org_id'] !== $this->auth->getOrgId()) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        // Prepare Update
        $updates = [];
        $params = [];

        if (!empty($data['role'])) {
            if ($currentUserRole === 'org_admin' && $data['role'] === 'super_admin') {
                http_response_code(403); echo json_encode(['error' => 'Cannot promote to super admin']); return;
            }
            $updates[] = "role = ?";
            $params[] = $data['role'];
        }

        if (!empty($data['password'])) {
            $updates[] = "password_hash = ?";
            $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
        }

        if (isset($data['permissions'])) {
            $updates[] = "permissions = ?";
            $params[] = !empty($data['permissions']) ? json_encode($data['permissions']) : null;
        }
        
        if (empty($updates)) {
            echo json_encode(['success' => true]); return;
        }

        $params[] = $id;
        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
        $this->db->query($sql, $params);

        echo json_encode(['success' => true]);
    }

    public function delete($id) {
        $this->auth->requireLogin();
        $currentUserRole = $_SESSION['role'];
        $currentUserId = $_SESSION['user_id'];

        if ($id == $currentUserId) {
            http_response_code(400); echo json_encode(['error' => 'Cannot delete yourself']); return;
        }

        if (!$this->auth->hasPermission('users', 'delete')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }

        $user = $this->db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
        if (!$user) { http_response_code(404); echo json_encode(['error' => 'User not found']); return; }

        if (!$this->auth->hasRole('super_admin') && $user['org_id'] !== $this->auth->getOrgId()) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }

        $this->db->query("DELETE FROM users WHERE id = ?", [$id]);
        echo json_encode(['success' => true]);
    }
}
