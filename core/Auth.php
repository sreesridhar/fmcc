<?php

require_once __DIR__ . '/Database.php';

class Auth {
    
    public function __construct() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function login($username, $password) {
        $db = Database::getInstance();
        $user = $db->fetch("SELECT * FROM users WHERE username = ?", [$username]);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['org_id'] = $user['org_id'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['permissions'] = !empty($user['permissions']) ? json_decode($user['permissions'], true) : null;
            return true;
        }
        return false;
    }

    public function logout() {
        session_unset();
        session_destroy();
    }

    public function user() {
        if (!$this->isLoggedIn()) {
            return null;
        }
        return [
            'id' => $_SESSION['user_id'],
            'org_id' => $_SESSION['org_id'],
            'role' => $_SESSION['role'],
            'username' => $_SESSION['username'],
            'permissions' => $_SESSION['permissions'] ?? null
        ];
    }

    public function isLoggedIn() {
        return isset($_SESSION['user_id']);
    }

    public function hasRole($role) {
        return $this->isLoggedIn() && $_SESSION['role'] === $role;
    }
    
    public function hasPermission($resource, $action) {
        if (!$this->isLoggedIn()) return false;
        
        $role = $_SESSION['role'];
        if ($role === 'super_admin' || $role === 'org_admin') {
            return true;
        }
        
        $perms = $_SESSION['permissions'] ?? null;
        if ($perms !== null) {
            return in_array("$resource.$action", $perms);
        }
        
        // Default behavior if no permissions set: Allow or specific logic?
        // For now, allow everything if permissions are not configured to maintain backward compatibility
        return true;
    }
    
    public function getOrgId() {
        return $_SESSION['org_id'] ?? null;
    }
    
    // Protect API routes
    public function requireLogin() {
        if (!$this->isLoggedIn()) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }
}
