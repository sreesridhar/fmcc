<?php

// Disable error display to prevent HTML/Text injection into JSON responses
ini_set('display_errors', 0);
error_reporting(E_ALL);


require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Database.php';

// Controllers
require_once __DIR__ . '/core/Controllers/OrganizationController.php';
require_once __DIR__ . '/core/Controllers/UserController.php';

// API Routes
$router = new Router();

// Organization Routes
$router->get('/api/v1/orgs', [new OrganizationController(), 'index']);
$router->post('/api/v1/orgs', [new OrganizationController(), 'create']);
$router->put('/api/v1/orgs/:id', [new OrganizationController(), 'update']);
$router->delete('/api/v1/orgs/:id', [new OrganizationController(), 'delete']);
$router->get('/api/v1/my-org', [new OrganizationController(), 'getProfile']);
$router->post('/api/v1/my-org', [new OrganizationController(), 'updateProfile']);

// User Routes
$router->get('/api/v1/users', [new UserController(), 'index']);
$router->post('/api/v1/users', [new UserController(), 'create']);
$router->put('/api/v1/users/:id', [new UserController(), 'update']);
$router->delete('/api/v1/users/:id', [new UserController(), 'delete']);

// Masters
require_once __DIR__ . '/core/Controllers/ClientController.php';
require_once __DIR__ . '/core/Controllers/SiteController.php';

$router->get('/api/v1/clients', [new ClientController(), 'index']);
$router->post('/api/v1/clients', [new ClientController(), 'create']);
$router->put('/api/v1/clients/:id', [new ClientController(), 'update']);
$router->delete('/api/v1/clients/:id', [new ClientController(), 'delete']);

$router->get('/api/v1/sites', [new SiteController(), 'index']);
$router->post('/api/v1/sites', [new SiteController(), 'create']);
$router->put('/api/v1/sites/:id', [new SiteController(), 'update']);

require_once __DIR__ . '/core/Controllers/CategoryController.php';

$router->get('/api/v1/categories', [new CategoryController(), 'index']);
$router->post('/api/v1/categories', [new CategoryController(), 'create']);
$router->put('/api/v1/categories/:id', [new CategoryController(), 'update']);
$router->delete('/api/v1/categories/:id', [new CategoryController(), 'delete']);
$router->post('/api/v1/categories/:id/fields', [new CategoryController(), 'addField']);
$router->post('/api/v1/categories/:id/fields', [new CategoryController(), 'addField']);
$router->put('/api/v1/fields/:id', [new CategoryController(), 'updateField']);
$router->delete('/api/v1/fields/:id', [new CategoryController(), 'deleteField']);

require_once __DIR__ . '/core/Controllers/TransactionController.php';
$router->get('/api/v1/transactions', [new TransactionController(), 'index']);
$router->get('/api/v1/transactions', [new TransactionController(), 'index']);
$router->post('/api/v1/transactions', [new TransactionController(), 'create']);
$router->put('/api/v1/transactions/:id', [new TransactionController(), 'update']);
$router->delete('/api/v1/transactions/:id', [new TransactionController(), 'delete']);

require_once __DIR__ . '/core/Controllers/DashboardController.php';
$router->get('/api/v1/stats', [new DashboardController(), 'stats']);
$router->get('/api/v1/export', [new DashboardController(), 'export']);

// Auth Routes
$router->post('/api/v1/login', function() {
    $data = json_decode(file_get_contents('php://input'), true);
    $auth = new Auth();
    if ($auth->login($data['username'] ?? '', $data['password'] ?? '')) {
        echo json_encode(['success' => true, 'user' => $auth->user()]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
    }
});

$router->post('/api/v1/logout', function() {
    $auth = new Auth();
    $auth->logout();
    echo json_encode(['success' => true]);
});

$router->get('/api/v1/me', function() {
    $auth = new Auth();
    if ($auth->isLoggedIn()) {
        echo json_encode(['authenticated' => true, 'user' => $auth->user()]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
});

// Serve Frontend
$router->get('/', function() {
    readfile(__DIR__ . '/public/index.html');
});

// Handle Request
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Simple static file serving check for dev environment
if (preg_match('/\.(?:png|jpg|jpeg|gif|css|js|json|ico)$/', $path)) {
    $file = __DIR__ . '/public' . $path;
    if (file_exists($file)) {
        $mime = mime_content_type($file);
        if (str_ends_with($file, '.css')) {
             $mime = 'text/css';
             header("Cache-Control: no-cache, no-store, must-revalidate");
        } elseif (str_ends_with($file, '.js')) {
             $mime = 'application/javascript';
             header("Cache-Control: no-cache, no-store, must-revalidate");
        } elseif (str_ends_with($file, '.json')) {
             $mime = 'application/json';
        } else {
             // Cache images
             header("Cache-Control: public, max-age=86400"); // Cache for 1 day
             header("Expires: " . gmdate('D, d M Y H:i:s', time() + 86400) . ' GMT');
        }
        header("Content-Type: $mime");
        readfile($file);
        exit;
    }
}

// SPA Routing: If it's an API call, use Router. Otherwise serve index.html
if (strpos($path, '/api/') === 0) {
    $router->dispatch($method, $uri);
} else {
    readfile(__DIR__ . '/public/index.html');
}
