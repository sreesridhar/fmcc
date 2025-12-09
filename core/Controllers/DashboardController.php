<?php

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../Auth.php';

class DashboardController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->auth = new Auth();
    }

    public function stats() {
        $this->auth->requireLogin();
        $org_id = $this->auth->getOrgId();
        
        $start_date = $_GET['start_date'] ?? date('Y-m-01'); // Default to this month
        $end_date = $_GET['end_date'] ?? date('Y-m-t');
        $client_id = $_GET['client_id'] ?? null;
        $site_id = $_GET['site_id'] ?? null;
        
        // 1. Totals
        $sqlTotals = "SELECT 
                SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as total_expense
            FROM transactions 
            WHERE transaction_date BETWEEN ? AND ?";
        
        $paramsTotals = [$start_date, $end_date];
        
        if (!$this->auth->hasRole('super_admin')) {
            $sqlTotals .= " AND org_id = ?";
            $paramsTotals[] = $org_id;
        }
        
        if ($client_id) { $sqlTotals .= " AND client_id = ?"; $paramsTotals[] = $client_id; }
        if ($site_id) { $sqlTotals .= " AND site_id = ?"; $paramsTotals[] = $site_id; }

        $totals = $this->db->fetch($sqlTotals, $paramsTotals);
        
        // 2. Category Breakdown
        $sqlCat = "SELECT c.name, c.type, SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.transaction_date BETWEEN ? AND ? ";
            
        $paramsCat = [$start_date, $end_date];
        
        if (!$this->auth->hasRole('super_admin')) {
            $sqlCat .= " AND t.org_id = ?";
            $paramsCat[] = $org_id;
        }

        if ($client_id) { $sqlCat .= " AND t.client_id = ?"; $paramsCat[] = $client_id; }
        if ($site_id) { $sqlCat .= " AND t.site_id = ?"; $paramsCat[] = $site_id; }
        
        $sqlCat .= " GROUP BY c.id, c.name, c.type ORDER BY total DESC";

        // 3. Recent Activity (Last 5)
        $sqlRecent = "SELECT t.*, c.name as category_name 
                      FROM transactions t 
                      JOIN categories c ON t.category_id = c.id
                      WHERE t.transaction_type = ? ";
        $paramsRecent = [$type = 'income']; // Placeholder
        
        $baseWhere = "";
        $baseParams = [];
        if (!$this->auth->hasRole('super_admin')) {
            $baseWhere .= " AND t.org_id = ?";
            $baseParams[] = $org_id;
        }
        if ($client_id) { $baseWhere .= " AND t.client_id = ?"; $baseParams[] = $client_id; }
        if ($site_id) { $baseWhere .= " AND t.site_id = ?"; $baseParams[] = $site_id; }
        
        // Recent Income
        $recentIncome = $this->db->fetchAll(
            $sqlRecent . $baseWhere . " ORDER BY t.transaction_date DESC, t.id DESC LIMIT 5",
            array_merge(['income'], $baseParams)
        );
        
        // Recent Expense
        $recentExpense = $this->db->fetchAll(
            $sqlRecent . $baseWhere . " ORDER BY t.transaction_date DESC, t.id DESC LIMIT 5",
            array_merge(['expense'], $baseParams)
        );
        
        // 4. Daily Stats for Chart
        $sqlDaily = "SELECT transaction_date, 
                        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
                        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense
                     FROM transactions t
                     WHERE transaction_date BETWEEN ? AND ? " . $baseWhere . "
                     GROUP BY transaction_date
                     ORDER BY transaction_date ASC";
                     
        $dailyParams = array_merge([$start_date, $end_date], $baseParams);
        $dailyStats = $this->db->fetchAll($sqlDaily, $dailyParams);

        // 5. Total Estimate Calculation
        $sqlEst = "SELECT SUM(estimated_cost) as total_estimate FROM sites WHERE 1=1";
        $paramsEst = [];
        
        if (!$this->auth->hasRole('super_admin')) {
            $sqlEst .= " AND org_id = ?";
            $paramsEst[] = $org_id;
        }
        
        if ($client_id) { $sqlEst .= " AND client_id = ?"; $paramsEst[] = $client_id; }
        if ($site_id) { $sqlEst .= " AND id = ?"; $paramsEst[] = $site_id; }
        
        $estResult = $this->db->fetch($sqlEst, $paramsEst);
        $totalEstimate = $estResult['total_estimate'] ?? 0;

        echo json_encode([
            'totals' => [
                'income' => $totals['total_income'] ?? 0,
                'expense' => $totals['total_expense'] ?? 0,
                'balance' => ($totals['total_income'] ?? 0) - ($totals['total_expense'] ?? 0),
                'estimate' => $totalEstimate
            ],
            'categories' => $categories,
            'recent_income' => $recentIncome,
            'recent_expenses' => $recentExpense,
            'daily_stats' => $dailyStats
        ]);
    }

    public function export() {
        $this->auth->requireLogin();
        $org_id = $this->auth->getOrgId();
        
        $client_id = $_GET['client_id'] ?? null;
        $site_id = $_GET['site_id'] ?? null;
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        $sql = "SELECT t.transaction_date, t.transaction_type, c.name as category, t.amount, t.description, 
                       cl.name as client, s.name as site, u.username as created_by
                FROM transactions t
                JOIN categories c ON t.category_id = c.id
                LEFT JOIN clients cl ON t.client_id = cl.id
                LEFT JOIN sites s ON t.site_id = s.id
                JOIN users u ON t.created_by = u.id
                WHERE 1=1";
        
        $params = [];
        
        if (!$this->auth->hasRole('super_admin')) {
             $sql .= " AND t.org_id = ?";
             $params[] = $org_id;
        }
        
        if ($client_id) { $sql .= " AND t.client_id = ?"; $params[] = $client_id; }
        if ($site_id) { $sql .= " AND t.site_id = ?"; $params[] = $site_id; }
        if ($start_date) { $sql .= " AND t.transaction_date >= ?"; $params[] = $start_date; }
        if ($end_date) { $sql .= " AND t.transaction_date <= ?"; $params[] = $end_date; }
        
        $sql .= " ORDER BY t.transaction_date ASC";
        
        $data = $this->db->fetchAll($sql, $params);
        
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename=\"export.csv\"');
        
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Date', 'Type', 'Category', 'Amount', 'Description', 'Client', 'Site', 'Created By']);
        
        foreach ($data as $row) {
            fputcsv($out, $row);
        }
        
        fclose($out);
    }
}
