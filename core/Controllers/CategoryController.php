<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class CategoryController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function index() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'view')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        $sql = "SELECT c.*, o.name as org_name FROM categories c JOIN organizations o ON c.org_id = o.id";
        $params = [];
        
        if (!$this->auth->hasRole('super_admin')) {
            if (!$org_id) { echo json_encode([]); return; }
            $sql .= " WHERE c.org_id = ?";
            $params[] = $org_id;
        }
        
        $sql .= " ORDER BY c.type, c.name";

        // Fetch categories with their fields
        $categories = $this->db->fetchAll($sql, $params);
        
        // Attach fields
        foreach ($categories as &$cat) {
            $cat['fields'] = $this->db->fetchAll("SELECT * FROM category_fields WHERE category_id = ?", [$cat['id']]);
        }
        
        echo json_encode($categories);
    }

    public function create() {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'create')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            http_response_code(400); echo json_encode(['error' => 'Name required']); return;
        }

        $id = $this->db->insert("INSERT INTO categories (org_id, name, type) VALUES (?, ?, ?)", [
            $org_id,
            $data['name'],
            !empty($data['type']) ? $data['type'] : null
        ]);

        echo json_encode(['success' => true, 'id' => $id]);
    }

    public function addField($categoryId) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();

        // Verify category belongs to org
        $cat = $this->db->fetch("SELECT id FROM categories WHERE id = ? AND org_id = ?", [$categoryId, $org_id]);
        if (!$cat) { http_response_code(404); echo json_encode(['error' => 'Category not found']); return; }
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['field_name']) || empty($data['field_type'])) {
            http_response_code(400); echo json_encode(['error' => 'Field name and type required']); return;
        }

        $field_slug = strtolower(str_replace(' ', '_', $data['field_name']));
        $options = isset($data['field_options']) ? json_encode($data['field_options']) : null;

        $id = $this->db->insert("INSERT INTO category_fields (category_id, field_name, field_slug, field_type, field_options, is_required) VALUES (?, ?, ?, ?, ?, ?)", [
            $categoryId,
            $data['field_name'],
            $field_slug,
            $data['field_type'],
            $options,
            $data['is_required'] ?? 0
        ]);

        echo json_encode(['success' => true, 'id' => $id]);
    }
    
    public function deleteField($fieldId) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        // Complex verification: check field -> category -> org
        $sql = "SELECT f.id FROM category_fields f 
                JOIN categories c ON f.category_id = c.id
                WHERE f.id = ? AND c.org_id = ?";
                
        $exists = $this->db->fetch($sql, [$fieldId, $org_id]);
        if (!$exists) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }
        
        $this->db->query("DELETE FROM category_fields WHERE id = ?", [$fieldId]);
        echo json_encode(['success' => true]);
    }

    public function updateField($fieldId) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();

        // Verify ownership
        $sql = "SELECT f.id FROM category_fields f 
                JOIN categories c ON f.category_id = c.id
                WHERE f.id = ? AND c.org_id = ?";
        $exists = $this->db->fetch($sql, [$fieldId, $org_id]);
        if (!$exists) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }

        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['field_name']) || empty($data['field_type'])) {
            http_response_code(400); echo json_encode(['error' => 'Field name and type required']); return;
        }

        $field_slug = strtolower(str_replace(' ', '_', $data['field_name']));
        $options = isset($data['field_options']) ? json_encode($data['field_options']) : null;

        $this->db->query("UPDATE category_fields SET field_name = ?, field_slug = ?, field_type = ?, is_required = ? WHERE id = ?", [
            $data['field_name'],
            $field_slug,
            $data['field_type'],
            $data['is_required'] ?? 0,
            $fieldId
        ]);

        echo json_encode(['success' => true]);
    }

    public function update($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'edit')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();
        
        // Verify ownership
        $cat = $this->db->fetch("SELECT id FROM categories WHERE id = ? AND org_id = ?", [$id, $org_id]);
        if (!$cat) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }

        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            http_response_code(400); echo json_encode(['error' => 'Name required']); return;
        }

        $this->db->query("UPDATE categories SET name = ?, type = ? WHERE id = ?", [
            $data['name'],
            !empty($data['type']) ? $data['type'] : null,
            $id
        ]);

        echo json_encode(['success' => true]);
    }

    public function delete($id) {
        $this->auth->requireLogin();
        if (!$this->auth->hasPermission('categories', 'delete')) {
            http_response_code(403); echo json_encode(['error' => 'Forbidden']); return;
        }
        $org_id = $this->auth->getOrgId();

        // Verify ownership
        $cat = $this->db->fetch("SELECT id FROM categories WHERE id = ? AND org_id = ?", [$id, $org_id]);
        if (!$cat) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }

        // Check for linked transactions
        $txCount = $this->db->fetch("SELECT COUNT(*) as count FROM transactions WHERE category_id = ?", [$id]);
        if ($txCount && $txCount['count'] > 0) {
            http_response_code(400); 
            echo json_encode(['error' => 'Cannot delete: This category has ' . $txCount['count'] . ' linked transactions. Please delete or reassign them first.']); 
            return; 
        }

        // Safe to delete
        $this->db->query("DELETE FROM categories WHERE id = ?", [$id]);
        echo json_encode(['success' => true]);
    }
}
