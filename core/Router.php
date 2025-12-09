<?php

class Router {
    private $routes = [];

    public function get($path, $callback) {
        $this->routes['GET'][$path] = $callback;
    }

    public function post($path, $callback) {
        $this->routes['POST'][$path] = $callback;
    }
    
    public function put($path, $callback) {
         $this->routes['PUT'][$path] = $callback;
    }

    public function delete($path, $callback) {
         $this->routes['DELETE'][$path] = $callback;
    }

    public function dispatch($method, $uri) {
        // Strip query string
        $uri = parse_url($uri, PHP_URL_PATH);
        
        // Match routes
        foreach ($this->routes[$method] as $route => $callback) {
            // Convert route to regex for parameters (e.g., /users/:id)
            $pattern = "@^" . preg_replace('/:[a-zA-Z0-9_]+/', '([a-zA-Z0-9_]+)', $route) . "$@D";
            
            if (preg_match($pattern, $uri, $matches)) {
                array_shift($matches); // Remove full match
                return call_user_func_array($callback, $matches);
            }
        }
        
        // 404
        http_response_code(404);
        echo json_encode(['error' => 'Not Found']);
    }
}
