import { api } from './utils/api.js';

const App = {
    user: null, // { id, username, role, org_id, permissions }
    
    hasPermission(resource, action) {
        if (!this.user) return false;
        if (this.user.role === 'super_admin' || this.user.role === 'org_admin') return true;
        if (Array.isArray(this.user.permissions)) {
            return this.user.permissions.includes(`${resource}.${action}`);
        }
        return true; // Default allow if no permissions set (null)
    },

    async init() {
        try {
            const res = await api.get('/me');
            if (res.authenticated) {
                this.user = res.user;
                // Check for current path
                const path = window.location.pathname.substring(1);
                const page = path && this.pages[path] ? path : 'dashboard';
                
                // If we are already on that page, just render, don't pushState to avoid duplicates?
                // Actually router() does pushState. For init (fresh load), we might want replaceState or just render.
                // But utilizing existing router function is easiest.
                
                // If path is empty, it means we are at /, so 'dashboard'.
                // If path is 'clients', we go to 'clients'.
                this.router(page);
            } else {
                this.router('login');
            }
        } catch (e) {
            console.error(e);
            this.router('login');
        }
        
        // Handle browser Back/Forward
        window.onpopstate = (event) => {
            if (event.state) {
                this.renderPage(event.state.page);
            }
        };
    },
    
    router(page) {
        history.pushState({ page }, '', `/${page === 'dashboard' ? '' : page}`);
        this.renderPage(page);
    },
    
    renderPage(page) {
        const app = document.getElementById('app');
        
        if (page === 'login') {
            app.innerHTML = this.pages.login();
            this.bindLoginEvents();
            return;
        }

        // Main Layout
        app.innerHTML = `
            <div class="sidebar">
                <div class="sidebar-brand">FMCC Finance</div>
                <nav>
                    <a href="#" class="nav-item ${page === 'dashboard' ? 'active' : ''}" data-link="dashboard">Dashboard</a>
                    ${this.user && this.user.role === 'super_admin' ? `<a href="#" class="nav-item ${page === 'orgs' ? 'active' : ''}" data-link="orgs">Organizations</a>` : ''}
                    ${this.user && this.user.role === 'org_admin' ? `<a href="#" class="nav-item ${page === 'my_org' ? 'active' : ''}" data-link="my_org">My Organization</a>` : ''}
                    ${this.user && (this.user.role === 'super_admin' || this.user.role === 'org_admin') ? `<a href="#" class="nav-item ${page === 'users' ? 'active' : ''}" data-link="users">Users</a>` : ''}
                    
                    ${this.user ? `
                        <div style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; padding: 0 1rem;">Masters</div>
                        <a href="#" class="nav-item ${page === 'clients' ? 'active' : ''}" data-link="clients">Clients</a>
                        <a href="#" class="nav-item ${page === 'sites' ? 'active' : ''}" data-link="sites">Sites</a>
                        <a href="#" class="nav-item ${page === 'categories' ? 'active' : ''}" data-link="categories">Categories</a>
                        <div style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; padding: 0 1rem;">Finance</div>
                    ` : ''}
                    
                    ${this.user ? `
                        <a href="#" class="nav-item ${page === 'income' ? 'active' : ''}" data-link="income">Income</a>
                        <a href="#" class="nav-item ${page === 'expenses' ? 'active' : ''}" data-link="expenses">Expenses</a>
                    ` : ''}
                    <div class="mt-4">
                        <a href="#" class="nav-item" id="logoutBtn">Logout</a>
                    </div>
                </nav>
            </div>
            <div class="main-content">
                <header class="flex justify-between items-center mb-6">
                    <h2>${page.charAt(0).toUpperCase() + page.slice(1)}</h2>
                    <div>User: ${this.user ? this.user.username : ''} (${this.user ? this.user.role : ''})</div>
                </header>
                <div id="page-content">
                    Loading...
                </div>
            </div>
        `;
        
        this.bindNavEvents();
        
        // Render content
        const content = document.getElementById('page-content');
        if (this.pages[page]) {
            content.innerHTML = this.pages[page]();
            if (this.pageLogic[page]) this.pageLogic[page]();
        } else {
            content.innerHTML = `<p>Page not found</p>`;
        }
    },
    
    pages: {
        login: () => `
            <div class="login-page">
                <div class="card login-box">
                    <h2 style="text-align:center; margin-bottom: 1rem;">Login</h2>
                    <form id="loginForm">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
                    </form>
                </div>
            </div>
        `,
        dashboard: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-6">
                    <h3>Dashboard</h3>
                    <div class="flex space-x-2 items-center">
                        <input type="date" id="statsStart" class="p-2 border rounded text-sm">
                        <span class="text-gray-400">-</span>
                        <input type="date" id="statsEnd" class="p-2 border rounded text-sm">
                         <select id="statsClient" class="p-2 border rounded text-sm"><option value="">All Clients</option></select>
                         <select id="statsSite" class="p-2 border rounded text-sm"><option value="">All Sites</option></select>
                         <a href="/api/v1/export" target="_blank" class="btn btn-sm border" id="exportBtn">Export</a>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" id="statsCards">
                    <div class="bg-blue-50 p-4 rounded border border-blue-100">
                        <div class="text-xs text-blue-600 font-bold uppercase">Total Income</div>
                        <div class="text-xl font-bold mt-1 text-blue-900" id="totalIncome">-</div>
                    </div>
                    <div class="bg-red-50 p-4 rounded border border-red-100">
                        <div class="text-xs text-red-600 font-bold uppercase">Total Expense</div>
                        <div class="text-xl font-bold mt-1 text-red-900" id="totalExpense">-</div>
                    </div>
                    <div class="bg-green-50 p-4 rounded border border-green-100">
                        <div class="text-xs text-green-600 font-bold uppercase">Balance</div>
                        <div class="text-xl font-bold mt-1 text-green-900" id="balance">-</div>
                    </div>
                    <div class="bg-purple-50 p-4 rounded border border-purple-100">
                        <div class="text-xs text-purple-600 font-bold uppercase">Estimated Cost</div>
                        <div class="text-xl font-bold mt-1 text-purple-900" id="totalEstimate">-</div>
                    </div>
                </div>
                
                <!-- Charts Grid -->
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <!-- Daily Trend Chart -->
                    <div class="card flex flex-col h-full">
                        <h4>Daily Cash Flow Trend</h4>
                        <div class="mt-4 p-2 relative flex-grow max-h-300">
                            <canvas id="dailyChartCanvas"></canvas>
                        </div>
                    </div>
                    
                    <!-- Budget Chart -->
                    <div class="card flex flex-col h-full">
                        <h4>Budget Overview</h4>
                        <div class="mt-4 p-2 relative flex-grow max-h-300">
                            <canvas id="budgetChartCanvas"></canvas>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- Recent Income -->
                    <div class="card">
                        <h4 class="text-success mb-4">Recent Income</h4>
                        <div id="recentIncomeList" class="space-y-3">
                            <div class="text-gray-400 text-sm">Loading...</div>
                        </div>
                    </div>

                    <!-- Recent Expenses -->
                    <div class="card">
                        <h4 class="text-danger mb-4">Recent Expenses</h4>
                        <div id="recentExpenseList" class="space-y-3">
                            <div class="text-gray-400 text-sm">Loading...</div>
                        </div>
                    </div>
                </div>
                

            </div>
        `,
        orgs: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Organizations</h3>
                    <button class="btn btn-primary" id="addOrgBtn">Add Organization</button>
                </div>
                <div id="orgFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2">New Organization</h4>
                    <form id="createOrgForm">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="flex space-x-4">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('orgFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                <table id="orgTable">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="orgTableBody"><tr><td colspan="4">Loading...</td></tr></tbody>
                </table>
            </div>
        `,
        my_org: () => `
            <div class="card">
                <h3 class="mb-4">My Organization</h3>
                
                <div id="orgProfileLoading">Loading...</div>
                
                <form id="orgProfileForm" class="hidden max-w-lg">
                    <div class="mb-6 text-center">
                        <img id="currentLogo" src="" alt="Organization Logo" class="h-24 w-auto mx-auto mb-2 hidden border rounded p-1">
                        <div class="text-xs text-center">
                            <button type="button" id="removeLogoBtn" class="text-red-500 text-xs hover:underline hidden">Remove Logo</button>
                        </div>
                        <div class="text-xs text-gray-500" id="noLogoText">No logo uploaded</div>
                    </div>
                    
                    <input type="hidden" name="delete_logo" id="deleteLogoInput" value="0">
                    
                    <div class="form-group">
                        <label>Organization Name</label>
                        <input type="text" name="name" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Upload New Logo</label>
                        <input type="file" name="logo" accept="image/*">
                        <small class="text-gray-500">Supported formats: PNG, JPG.</small>
                    </div>

                    <div class="mt-6">
                        <button type="submit" class="btn btn-primary">Update Profile</button>
                    </div>
                </form>
            </div>
        `,
        users: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Users</h3>
                    ${App.hasPermission('users', 'create') ? '<button class="btn btn-primary" id="addUserBtn">Add User</button>' : ''}
                </div>
                <div id="userFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2" id="userFormTitle">New User</h4>
                    <form id="createUserForm">
                        <input type="hidden" id="userId">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password">
                            <small id="userPasswordHelp" class="text-gray-500 hidden">Leave blank to keep unchanged</small>
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <select name="role" required>
                                <option value="org_admin">Org Admin</option>
                                <option value="manager">Manager</option>
                                <option value="staff">Staff</option>
                            </select>
                        </div>
                        ${App.user.role === 'super_admin' ? `
                        <div class="form-group">
                            <label>Organization ID</label>
                            <input type="number" name="org_id">
                        </div>` : ''}
                        
                        <div class="form-group mt-4">
                            <label class="block font-bold mb-2">Permissions</label>
                            <div class="border p-2 rounded max-h-60 overflow-y-auto text-sm">
                                <table class="w-full">
                                    <thead>
                                        <tr class="text-left">
                                            <th class="pb-2">Resource</th>
                                            <th class="pb-2 text-center">View</th>
                                            <th class="pb-2 text-center">Create</th>
                                            <th class="pb-2 text-center">Edit</th>
                                            <th class="pb-2 text-center">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${['clients', 'sites', 'categories', 'transactions', 'users'].map(res => `
                                            <tr class="border-t">
                                                <td class="py-2 capitalize">${res}</td>
                                                <td class="text-center"><input type="checkbox" name="permissions" value="${res}.view"></td>
                                                <td class="text-center"><input type="checkbox" name="permissions" value="${res}.create"></td>
                                                <td class="text-center"><input type="checkbox" name="permissions" value="${res}.edit"></td>
                                                <td class="text-center"><input type="checkbox" name="permissions" value="${res}.delete"></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <small class="text-gray-500">If no permissions selected, role defaults apply (usually full access for Managers, limited for Staff).</small>
                        </div>

                        <div class="flex space-x-4 mt-4">
                            <button type="submit" class="btn btn-primary" id="userSubmitBtn">Create</button>
                            <button type="button" class="btn" onclick="document.getElementById('userFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                <table id="userTable">
                    <thead>
                        <tr><th>ID</th><th>Username</th><th>Role</th><th>Organization</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="userTableBody"><tr><td colspan="5">Loading...</td></tr></tbody>
                </table>
            </div>
        `,
        clients: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Clients</h3>
                    ${App.hasPermission('clients', 'create') ? '<button class="btn btn-primary" id="addClientBtn">Add Client</button>' : ''}
                </div>
                <div id="clientFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2">New Client</h4>
                    <form id="createClientForm">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>Parent Client (Optional)</label>
                            <select name="parent_client_id" id="parentClientSelect"><option value="">None</option></select>
                        </div>
                        <div class="flex space-x-4">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('clientFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                <table id="clientTable">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Parent</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="clientTableBody"><tr><td colspan="5">Loading...</td></tr></tbody>
                </table>
            </div>
        `,
        sites: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Sites</h3>
                    ${App.hasPermission('sites', 'create') ? '<button class="btn btn-primary" id="addSiteBtn">Add Site</button>' : ''}
                </div>
                
                <!-- Filters -->
                <div class="flex space-x-4 mb-4 bg-gray-50 p-3 rounded">
                    <input type="text" id="siteSearch" placeholder="Search Sites..." class="p-2 border rounded flex-grow">
                    <select id="siteFilterClient" class="p-2 border rounded"><option value="">All Clients</option></select>
                    <select id="siteFilterStatus" class="p-2 border rounded">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div id="siteFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2" id="siteFormTitle">New Site</h4>
                    <form id="createSiteForm">
                        <input type="hidden" name="id" id="siteId">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label>Client</label>
                                <select name="client_id" id="siteClientSelect" required class="w-full p-2 border rounded"><option value="">Select Client</option></select>
                            </div>
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" name="name" required class="w-full p-2 border rounded">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-2">
                             <div class="form-group">
                                <label>Location</label>
                                <input type="text" name="location" class="w-full p-2 border rounded">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status" class="w-full p-2 border rounded">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group mt-2">
                            <label>Estimated Cost (₹)</label>
                            <input type="number" name="estimated_cost" step="0.01" placeholder="0.00" class="w-full p-2 border rounded">
                        </div>
                        <div class="flex space-x-4 mt-4">
                            <button type="submit" class="btn btn-primary" id="siteSubmitBtn">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('siteFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                
                <div id="sitesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-[600px] overflow-y-auto pr-2">
                    <!-- Cards will be injected here -->
                </div>
                <div id="sitesLoading" class="text-center py-4 hidden">Loading more...</div>
            </div>
        `,
        categories: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Categories</h3>
                    ${App.hasPermission('categories', 'create') ? '<button class="btn btn-primary" id="addCategoryBtn">Add Category</button>' : ''}
                </div>
                <div id="categoryFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2" id="catFormTitle">New Category</h4>
                    <form id="createCategoryForm">
                        <input type="hidden" name="id" id="catId">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>Type (Optional)</label>
                            <select name="type">
                                <option value="">Select Type (Optional)</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                            <small class="text-gray-500 block mt-1">If selected, will auto-fill transaction type.</small>
                        </div>
                        <div class="flex space-x-4">
                            <button type="submit" class="btn btn-primary" id="catSubmitBtn">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('categoryFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                <div id="categoriesList">Loading...</div>
            
                <!-- Field Modal -->
                <div id="fieldModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div class="bg-white p-6 rounded w-96">
                        <h4 class="mb-4" id="fieldModalTitle">Add Field</h4>
                        <form id="addFieldForm">
                            <input type="hidden" name="category_id" id="fieldModalCategoryId">
                            <input type="hidden" name="field_id" id="fieldModalFieldId">
                            <div class="form-group">
                                <label>Field Name</label>
                                <input type="text" name="field_name" id="fieldModalName" required>
                            </div>
                            <div class="form-group">
                                <label>Input Type</label>
                                <select name="field_type" id="fieldModalType" required>
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="select">Dropdown</option>
                                    <option value="textarea">Large Text</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Required?</label>
                                <select name="is_required" id="fieldModalRequired">
                                    <option value="0">No</option>
                                    <option value="1">Yes</option>
                                </select>
                            </div>
                            <div class="flex space-x-4 mt-4">
                                <button type="submit" class="btn btn-primary" id="fieldModalSubmitBtn">Add</button>
                                <button type="button" class="btn" onclick="document.getElementById('fieldModal').classList.add('hidden')">Close</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `,

        income: () => App.renderTxTemplate('income'),
        expenses: () => App.renderTxTemplate('expense')
    },
    
    // Shared Template for Transactions
    renderTxTemplate: (mode) => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>${mode === 'income' ? 'Income' : 'Expenses'}</h3>
                    <button class="btn btn-primary" id="addTxBtn">Add ${mode === 'income' ? 'Income' : 'Expense'}</button>
                </div>
                
                <!-- Filters -->
                <div class="flex space-x-4 mb-4">
                    <!-- Type Filter Hidden as it is implied by page -->
                    <input type="date" id="filterStart" class="p-2 border rounded">
                    <input type="date" id="filterEnd" class="p-2 border rounded">
                    <button id="applyFiltersBtn" class="btn btn-sm">Filter</button>
                    ${mode === 'all' ? `<select id="filterType" class="p-2 border rounded"><option value="">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select>` : ''}
                </div>

                <div id="txFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2">New ${mode === 'income' ? 'Income' : 'Expense'}</h4>
                    <form id="createTxForm" data-mode="${mode}">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label>Amount</label>
                                <input type="number" step="0.01" name="amount" required>
                            </div>
                        </div>
                        
                        <!-- Hidden Type Field -->
                        <input type="hidden" name="type" value="${mode}">
                        
                        <div class="form-group mt-4">
                            <label>Category</label>
                            <select name="category_id" id="txCategorySelect" required class="w-full p-2 border rounded"><option value="">Select Category</option></select>
                        </div>
                             
                        <div class="grid grid-cols-2 gap-4 mt-4">
                             <div class="form-group">
                                <label>Client</label>
                                <select name="client_id" id="txClientSelect" class="w-full p-2 border rounded"><option value="">None</option></select>
                             </div>
                             <div class="form-group">
                                <label>Site</label>
                                <select name="site_id" id="txSiteSelect" class="w-full p-2 border rounded"><option value="">Select Client First</option></select>
                             </div>
                        </div>

                        <div id="txCustomFields" class="border-t pt-4 mt-4 hidden">
                             <!-- Dynamic Fields Render Here -->
                        </div>
                             
                        <div class="form-group mt-4">
                            <label>Description (Details)</label>
                            <textarea name="description" rows="2" class="w-full p-2 border rounded"></textarea>
                        </div>

                        <div class="flex space-x-4 mt-4">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('txFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>
                
                <table id="txTable">
                    <thead>
                        <tr><th>Date</th><th>Category</th><th>Details</th><th>Amount</th><th>Client/Site</th></tr>
                    </thead>
                    <tbody id="txTableBody"><tr><td colspan="5">Loading...</td></tr></tbody>
                </table>
            </div>
    `,
    
    pageLogic: {
        dashboard: async () => {
             // Load Data for Filters
             let sitesData = [];
             try {
                 const [clients, sites] = await Promise.all([
                     api.get('/clients'),
                     api.get('/sites')
                 ]);
                 sitesData = sites;
                 
                 document.getElementById('statsClient').innerHTML = '<option value="">All Clients</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                 document.getElementById('statsSite').innerHTML = '<option value="">All Sites</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
             } catch(e) { console.error('Failed to load filter data', e); }

             const loadStats = async () => {
                 const start = document.getElementById('statsStart').value;
                 const end = document.getElementById('statsEnd').value;
                 const clientId = document.getElementById('statsClient').value;
                 const siteId = document.getElementById('statsSite').value;
                 
                 let query = `start_date=${start}&end_date=${end}`;
                 if(clientId) query += `&client_id=${clientId}`;
                 if(siteId) query += `&site_id=${siteId}`;

                 try {
                     const res = await api.get(`/stats?${query}`);
                     document.getElementById('totalIncome').innerText = '₹' + parseFloat(res.totals.income).toLocaleString('en-IN');
                     document.getElementById('totalExpense').innerText = '₹' + parseFloat(res.totals.expense).toLocaleString('en-IN');
                     document.getElementById('balance').innerText = '₹' + parseFloat(res.totals.balance).toLocaleString('en-IN');
                     document.getElementById('totalEstimate').innerText = '₹' + parseFloat(res.totals.estimate).toLocaleString('en-IN');
                     
                     // 1. Render Daily Chart (Chart.js)
                     const ctx = document.getElementById('dailyChartCanvas');
                     
                     if (window.myDailyChart) {
                         window.myDailyChart.destroy();
                     }
                     
                     if (res.daily_stats && res.daily_stats.length > 0) {
                         const labels = res.daily_stats.map(d => {
                             const date = new Date(d.transaction_date);
                             return date.getDate(); // Just day number
                         });
                         const incomeData = res.daily_stats.map(d => parseFloat(d.income));
                         const expenseData = res.daily_stats.map(d => parseFloat(d.expense));
                         
                         window.myDailyChart = new Chart(ctx, {
                             type: 'bar',
                             data: {
                                 labels: labels,
                                 datasets: [
                                     {
                                         label: 'Income',
                                         data: incomeData,
                                         backgroundColor: '#10b981',
                                         borderRadius: 4,
                                     },
                                     {
                                         label: 'Expense',
                                         data: expenseData,
                                         backgroundColor: '#ef4444',
                                         borderRadius: 4,
                                     }
                                 ]
                             },
                             options: {
                                 responsive: true,
                                 maintainAspectRatio: false,
                                 scales: {
                                     y: { beginAtZero: true, grid: { display: false } },
                                     x: { grid: { display: false } }
                                 },
                                 plugins: { legend: { position: 'bottom' } }
                             }
                         });
                     }

                     // 2. Budget Chart
                     const ctxBudget = document.getElementById('budgetChartCanvas');
                     if (window.myBudgetChart) window.myBudgetChart.destroy();
                     
                     window.myBudgetChart = new Chart(ctxBudget, {
                         type: 'doughnut',
                         data: {
                             labels: ['Estimated', 'Actual Expense'],
                             datasets: [{
                                 data: [parseFloat(res.totals.estimate), parseFloat(res.totals.expense)],
                                 backgroundColor: ['#d8b4fe', '#ef4444'], // Purple for Estimate, Red for Expense
                                 borderWidth: 0
                             }]
                         },
                         options: {
                             responsive: true,
                             maintainAspectRatio: false,
                             plugins: {
                                 legend: { position: 'bottom' },
                                 title: { display: true, text: 'Budget Utilization' }
                             }
                         }
                     });

                     // 3. Render Recent Lists
                     const renderList = (list, containerId, colorClass) => {
                         const container = document.getElementById(containerId);
                         if(!list || list.length === 0) {
                             container.innerHTML = '<div class="text-gray-400 text-sm">No recent activity</div>';
                             return;
                         }
                         container.innerHTML = list.map(t => `
                            <div class="flex justify-between items-center p-2 rounded hover:bg-gray-50 border-b border-dashed last:border-0">
                                <div>
                                    <div class="font-medium text-sm">${t.description || t.category_name}</div>
                                    <div class="text-xs text-gray-400">${t.transaction_date}</div>
                                </div>
                                <div class="font-bold text-sm ${colorClass}">₹${parseFloat(t.amount).toLocaleString('en-IN')}</div>
                            </div>
                         `).join('');
                     };
                     
                     renderList(res.recent_income, 'recentIncomeList', 'text-success');
                     renderList(res.recent_expenses, 'recentExpenseList', 'text-danger');



                     // Update Export Link
                     document.getElementById('exportBtn').href = `/api/v1/export?${query}`;
                     
                 } catch (e) {
                     console.error(e);
                     alert('Dashboard Load Failed: ' + e.message);
                 }
             };
             
             // Init Dates: First day of current month to Today
             const today = new Date();
             const y = today.getFullYear();
             const m = String(today.getMonth() + 1).padStart(2, '0');
             const d = String(today.getDate()).padStart(2, '0');
             
             document.getElementById('statsStart').value = `${y}-${m}-01`;
             document.getElementById('statsEnd').value = `${y}-${m}-${d}`;

             loadStats();
             document.getElementById('statsStart').onchange = loadStats;
             document.getElementById('statsEnd').onchange = loadStats;
             document.getElementById('statsClient').onchange = (e) => {
                 const cid = e.target.value;
                 const siteSelect = document.getElementById('statsSite');
                 if(!cid) {
                     siteSelect.innerHTML = '<option value="">All Sites</option>' + sitesData.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                 } else {
                     const filtered = sitesData.filter(s => s.client_id == cid);
                     siteSelect.innerHTML = '<option value="">All Sites</option>' + filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                 }
                 loadStats();
             };
             document.getElementById('statsSite').onchange = loadStats;
         },
        orgs: async () => {
             let orgsData = [];
             const loadOrgs = async () => {
                 try {
                     const orgs = await api.get('/orgs');
                     orgsData = orgs;
                     const tbody = document.getElementById('orgTableBody');
                     if (orgs.length === 0) {
                         tbody.innerHTML = '<tr><td colspan="4">No organizations found</td></tr>';
                         return;
                     }
                     tbody.innerHTML = orgs.map(org => `
                        <tr>
                            <td>${org.id}</td>
                            <td>${org.name}</td>
                            <td>${org.status}</td>
                            <td>
                                <button class="btn btn-sm edit-org-btn" data-id="${org.id}">Edit</button>
                                <button class="btn btn-sm btn-danger delete-org-btn" data-id="${org.id}">Delete</button>
                            </td>
                        </tr>
                     `).join('');
                     
                     document.querySelectorAll('.edit-org-btn').forEach(btn => {
                         btn.onclick = () => editOrg(btn.dataset.id);
                     });
                     document.querySelectorAll('.delete-org-btn').forEach(btn => {
                         btn.onclick = () => deleteOrg(btn.dataset.id);
                     });
                 } catch (e) {
                     document.getElementById('orgTableBody').innerHTML = `<tr><td colspan="4" class="text-danger">${e.message}</td></tr>`;
                 }
             };
             
             const editOrg = (id) => {
                 const org = orgsData.find(o => o.id == id);
                 if (!org) return;
                 
                 const form = document.getElementById('createOrgForm');
                 form.name.value = org.name;
                 
                 form.dataset.mode = 'edit';
                 form.dataset.id = id;
                 document.getElementById('orgFormContainer').classList.remove('hidden');
                 document.querySelector('#createOrgForm button[type="submit"]').innerText = 'Update';
             };

             const deleteOrg = async (id) => {
                 if (confirm('Are you sure you want to delete this organization? This will delete all associated data.')) {
                     try {
                         await api.delete(`/orgs/${id}`);
                         loadOrgs();
                     } catch (e) {
                         alert('Delete failed: ' + e.message);
                     }
                 }
             };
             
             loadOrgs();
             
             document.getElementById('addOrgBtn').onclick = () => {
                 const form = document.getElementById('createOrgForm');
                 form.reset();
                 form.dataset.mode = 'create';
                 delete form.dataset.id;
                 document.querySelector('#createOrgForm button[type="submit"]').innerText = 'Save';
                 document.getElementById('orgFormContainer').classList.remove('hidden');
             };
             
             document.getElementById('createOrgForm').onsubmit = async (e) => {
                 e.preventDefault();
                 const formData = new FormData(e.target);
                 const form = e.target;
                 const mode = form.dataset.mode || 'create';
                 
                 try {
                     const data = Object.fromEntries(formData);
                     if (!data.status) data.status = 'active'; 

                     if (mode === 'edit') {
                         await api.put(`/orgs/${form.dataset.id}`, data);
                     } else {
                         await api.post('/orgs', data);
                     }
                     e.target.reset();
                     document.getElementById('orgFormContainer').classList.add('hidden');
                     loadOrgs();
                 } catch (err) {
                     alert(err.message);
                 }
             };
        },
        my_org: async () => {
             try {
                 const org = await api.get('/my-org');
                 document.getElementById('orgProfileLoading').classList.add('hidden');
                 const form = document.getElementById('orgProfileForm');
                 form.classList.remove('hidden');
                 
                 form.elements['name'].value = org.name;
                 
                 if (org.logo) {
                     const img = document.getElementById('currentLogo');
                     img.src = org.logo;
                     img.classList.remove('hidden');
                     document.getElementById('noLogoText').classList.add('hidden');
                     document.getElementById('removeLogoBtn').classList.remove('hidden');
                 }
                 
                 document.getElementById('removeLogoBtn').onclick = () => {
                     if(confirm('Remove this logo?')) {
                         document.getElementById('currentLogo').classList.add('hidden');
                         document.getElementById('noLogoText').classList.remove('hidden');
                         document.getElementById('removeLogoBtn').classList.add('hidden');
                         document.getElementById('deleteLogoInput').value = '1';
                     }
                 };
                 
                 form.onsubmit = async (e) => {
                     e.preventDefault();
                     const formData = new FormData(e.target);
                     
                     try {
                         // Use fetch directly for FormData to handle Multipart correctly
                         const res = await fetch('/api/v1/my-org', {
                             method: 'POST',
                             body: formData
                         });
                         const json = await res.json();
                         
                         if (!res.ok) throw new Error(json.error || 'Update failed');
                         
                         alert('Organization profile updated!');
                         App.router('my_org'); // Reload to see changes (like logo)
                     } catch (err) {
                         alert(err.message);
                     }
                 };
                 
             } catch (e) {
                 document.getElementById('orgProfileLoading').innerHTML = `<div class="text-danger">${e.message}</div>`;
             }
        },
        users: async () => {
            let usersData = [];
            const loadUsers = async () => {
                try {
                    const users = await api.get('/users');
                    usersData = users;
                    const tbody = document.getElementById('userTableBody');
                    if (users.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
                        return;
                    }
                    tbody.innerHTML = users.map(u => `
                       <tr>
                           <td>${u.local_id}</td>
                           <td>${u.username}</td>
                           <td>${u.role}</td>
                           <td>${u.org_name || '-'}</td>
                           <td>
                                ${App.hasPermission('users', 'edit') ? `<button class="btn btn-sm btn-edit-user" data-id="${u.id}">Edit</button>` : ''}
                                ${App.hasPermission('users', 'delete') ? `<button class="btn btn-sm btn-danger btn-delete-user" data-id="${u.id}">Delete</button>` : ''}
                            </td>
                       </tr>
                    `).join('');
                    
                    document.querySelectorAll('.btn-edit-user').forEach(btn => {
                        btn.onclick = () => editUser(btn.dataset.id);
                    });
                    document.querySelectorAll('.btn-delete-user').forEach(btn => {
                        btn.onclick = () => deleteUser(btn.dataset.id);
                    });
                } catch (e) {
                    document.getElementById('userTableBody').innerHTML = `<tr><td colspan="5" class="text-danger">${e.message}</td></tr>`;
                }
            };
            
            loadUsers();
            
             const addUserBtn = document.getElementById('addUserBtn');
             if (addUserBtn) {
                 addUserBtn.onclick = () => {
                     const form = document.getElementById('createUserForm');
                     form.reset();
                     form.dataset.mode = 'create';
                     delete form.dataset.id;
                     document.getElementById('userId').value = '';
                     document.querySelector('#createUserForm button[type="submit"]').innerText = 'Create';
                     document.getElementById('userFormTitle').innerText = 'New User';
                     document.getElementById('userPasswordHelp').classList.add('hidden');
                     
                     // Reset permissions
                     form.querySelectorAll('input[name="permissions"]').forEach(cb => cb.checked = false);
                     
                     document.getElementById('userFormContainer').classList.remove('hidden');
                 };
             }
             
             document.getElementById('createUserForm').onsubmit = async (e) => {
                 e.preventDefault();
                 const formData = new FormData(e.target);
                 const data = Object.fromEntries(formData);
                 
                 // Handle Permissions Checkboxes
                 const perms = [];
                 e.target.querySelectorAll('input[name="permissions"]:checked').forEach(cb => perms.push(cb.value));
                 data.permissions = perms;
                 
                  // Handle empty password for edit
                 if (e.target.dataset.mode === 'edit' && !data.password) {
                     delete data.password;
                 }
                 
                 try {
                     const mode = e.target.dataset.mode;
                     if (mode === 'edit') {
                         await api.put(`/users/${e.target.dataset.id}`, data);
                     } else {
                         await api.post('/users', data);
                     }
                     e.target.reset();
                     document.getElementById('userFormContainer').classList.add('hidden');
                     loadUsers();
                 } catch (err) { alert(err.message); }
             };
            
            const editUser = (id) => {
                const user = usersData.find(u => u.id == id);
                if (!user) return;

                const container = document.getElementById('userFormContainer');
                container.classList.remove('hidden');

                const form = document.getElementById('createUserForm');
                form.elements['username'].value = user.username;
                form.elements['role'].value = user.role;
                if (form.elements['org_id']) { 
                    form.elements['org_id'].value = user.org_id || '';
                }
                form.elements['password'].value = ''; 
                form.elements['password'].required = false;

                form.dataset.mode = 'edit';
                document.getElementById('userId').value = id;
                document.querySelector('#createUserForm button[type="submit"]').innerText = 'Update';
                document.getElementById('userFormTitle').innerText = 'Edit User';
                document.getElementById('userPasswordHelp').classList.remove('hidden');
                
                // Populate Permissions
                const checkboxes = form.querySelectorAll('input[name="permissions"]');
                checkboxes.forEach(cb => cb.checked = false);
                
                let perms = [];
                if (user.permissions) {
                     // user.permissions from API might be a string (if MySQL JSON type returned as string) or array
                     if (typeof user.permissions === 'string') {
                         try { perms = JSON.parse(user.permissions); } catch(e) {}
                     } else {
                         perms = user.permissions;
                     }
                }
                
                if (perms && Array.isArray(perms)) {
                    checkboxes.forEach(cb => {
                        if (perms.includes(cb.value)) cb.checked = true;
                    });
                }
            };

            const deleteUser = async (id) => {
                if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                    try {
                        await api.delete(`/users/${id}`);
                        loadUsers();
                    } catch (e) {
                        alert('Delete failed: ' + e.message);
                    }
                }
            };
            
            loadUsers();
            
            document.getElementById('addUserBtn').onclick = () => {
                const form = document.getElementById('createUserForm');
                form.reset();
                form.elements['password'].required = true;
                form.dataset.mode = 'create';
                document.getElementById('userId').value = '';
                document.querySelector('#createUserForm button[type="submit"]').innerText = 'Create';
                document.getElementById('userFormTitle').innerText = 'New User';
                document.getElementById('userPasswordHelp').classList.add('hidden');
                document.getElementById('userFormContainer').classList.remove('hidden');
            };
            
            document.getElementById('createUserForm').onsubmit = async (e) => {
                e.preventDefault();
                const form = e.target;
                const mode = form.dataset.mode || 'create';
                const id = document.getElementById('userId').value;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // Handle Permissions array manually
                data.permissions = Array.from(form.querySelectorAll('input[name="permissions"]:checked')).map(cb => cb.value);
                
                try {
                    if (mode === 'edit') {
                        if (!data.password) delete data.password; // Don't send empty password
                        await api.put(`/users/${id}`, data);
                    } else {
                        await api.post('/users', data);
                    }
                    e.target.reset();
                    document.getElementById('userFormContainer').classList.add('hidden');
                    loadUsers();
                } catch (err) {
                    alert(err.message);
                }
            };
            

        },
        
        clients: async () => {
            let clientsData = [];
            const loadClients = async () => {
                try {
                    const clients = await api.get('/clients');
                    clientsData = clients;
                    const tbody = document.getElementById('clientTableBody');
                    const select = document.getElementById('parentClientSelect');
                    
                    // Update Select Options
                    select.innerHTML = '<option value="">None</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                    if (clients.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5">No clients found</td></tr>';
                        return;
                    }
                    tbody.innerHTML = clients.map(c => `
                       <tr>
                           <td>${c.local_id || c.id}</td>
                           <td>${c.name}</td>
                           <td>${c.parent_name || '-'}</td>
                           <td>${c.org_name || '-'}</td>
                           <td>
                                ${App.hasPermission('clients', 'edit') ? `<button class="btn btn-sm btn-secondary edit-client-btn" data-id="${c.id}">Edit</button>` : ''}
                                ${App.hasPermission('clients', 'delete') ? `<button class="btn btn-sm btn-danger delete-client-btn" data-id="${c.id}">Delete</button>` : ''}
                            </td>
                       </tr>
                    `).join('');
                    
                    // Bind Events
                    document.querySelectorAll('.edit-client-btn').forEach(btn => {
                        btn.onclick = () => editClient(btn.dataset.id);
                    });
                    document.querySelectorAll('.delete-client-btn').forEach(btn => {
                        btn.onclick = () => deleteClient(btn.dataset.id);
                    });
                    
                } catch (e) {
                    document.getElementById('clientTableBody').innerHTML = `<tr><td colspan="5" class="text-danger">${e.message}</td></tr>`;
                }
            };
            
            const editClient = (id) => {
                const client = clientsData.find(c => c.id == id);
                if (!client) return;
                
                const container = document.getElementById('clientFormContainer');
                container.classList.remove('hidden');
                
                // Populate Form
                const form = document.getElementById('createClientForm');
                form.elements['name'].value = client.name;
                // Add status if exists in form, otherwise ignore. The current form in HTML string doesn't have status select.
                // Assuming we just edit name and parent.
                
                // Handle Parent Select
                if (form.elements['parent_client_id']) {
                     form.elements['parent_client_id'].value = client.parent_client_id || '';
                }
                
                // Set ID for Update
                form.dataset.mode = 'edit';
                form.dataset.id = id;
                document.querySelector('#createClientForm button[type="submit"]').innerText = 'Update';
            };
            
            const deleteClient = async (id) => {
                if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
                    try {
                        await api.delete(`/clients/${id}`);
                        loadClients();
                    } catch (e) {
                        alert('Delete failed: ' + e.message);
                    }
                }
            };
            
            loadClients();
            
            document.getElementById('addClientBtn').onclick = async () => {
                const container = document.getElementById('clientFormContainer');
                container.classList.remove('hidden');
                
                // Reset Form for Create
                const form = document.getElementById('createClientForm');
                form.reset();
                form.dataset.mode = 'create';
                delete form.dataset.id;
                document.querySelector('#createClientForm button[type="submit"]').innerText = 'Save';
                
                // Debugging for User
                if (!App.user) {
                    alert('Error: User not fully loaded. Please reload the page.');
                    return;
                }
                
                // Super Admin: Load & Show Org Select
                if (App.user.role === 'super_admin') {
                     const orgGroup = document.getElementById('clientOrgGroup');
                     if (!orgGroup) {
                         const div = document.createElement('div');
                         div.className = 'form-group';
                         div.id = 'clientOrgGroup';
                         div.innerHTML = '<label>Organization</label><select name="org_id" id="clientOrgSelect" required><option value="">Loading...</option></select>';
                         
                         const formGroup = document.querySelector('#createClientForm .form-group');
                         if (formGroup) {
                             formGroup.before(div);
                         } else {
                             alert('Error: Could not find form insertion point.');
                             return;
                         }
                         
                         try {
                             const orgs = await api.get('/orgs');
                             document.getElementById('clientOrgSelect').innerHTML = '<option value="">Select Organization</option>' + orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
                         } catch (e) {
                             alert('Failed to load organizations: ' + e.message);
                             document.getElementById('clientOrgSelect').innerHTML = '<option value="">Error loading orgs</option>';
                         }
                     }
                }
            };

            document.getElementById('createClientForm').onsubmit = async (e) => {
                e.preventDefault();
                const form = e.target;
                const mode = form.dataset.mode || 'create';
                const id = form.dataset.id;
                
                try {
                    if (mode === 'edit' && id) {
                        await api.put(`/clients/${id}`, Object.fromEntries(new FormData(form)));
                    } else {
                        await api.post('/clients', Object.fromEntries(new FormData(form)));
                    }
                    e.target.reset();
                    document.getElementById('clientFormContainer').classList.add('hidden');
                    loadClients();
                } catch (err) { alert(err.message); }
            };
        },
        
        sites: async () => {
            let offset = 0;
            const limit = 10;
            let isLoading = false;
            let hasMore = true;
            let sitesData = []; // Store for editing

            // Helper to fetch clients once
            const fetchClients = async () => {
                const clients = await api.get('/clients');
                const clientSelect = document.getElementById('siteClientSelect');
                const filterSelect = document.getElementById('siteFilterClient');
                
                const options = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                clientSelect.innerHTML = '<option value="">Select Client</option>' + options;
                filterSelect.innerHTML = '<option value="">All Clients</option>' + options;
            };

            const loadSites = async (reset = false) => {
                if (isLoading || (!hasMore && !reset)) return;
                isLoading = true;
                if (reset) {
                    offset = 0;
                    hasMore = true;
                    sitesData = [];
                    document.getElementById('sitesGrid').innerHTML = '';
                }
                document.getElementById('sitesLoading').classList.remove('hidden');

                const search = document.getElementById('siteSearch').value;
                const clientId = document.getElementById('siteFilterClient').value;
                const status = document.getElementById('siteFilterStatus').value;

                try {
                    const query = `limit=${limit}&offset=${offset}&search=${search}&client_id=${clientId}&status=${status}`;
                    const sites = await api.get('/sites?' + query);

                    if (sites.length < limit) hasMore = false;
                    offset += sites.length;
                    
                    // Merge data for editing lookup
                    sitesData = reset ? sites : [...sitesData, ...sites];

                    const grid = document.getElementById('sitesGrid');
                    if (sites.length === 0 && reset) {
                        grid.innerHTML = '<p class="text-gray-500 col-span-3 text-center">No sites found.</p>';
                    } else {
                        sites.forEach(s => {
                            const estCost = parseFloat(s.estimated_cost || 0);
                            const income = parseFloat(s.total_income || 0);
                            const expense = parseFloat(s.total_expense || 0);
                            const netCash = income - expense;
                            
                            // Budget Metrics
                            let percentUsed = 0;
                            if (estCost > 0) {
                                percentUsed = (expense / estCost) * 100;
                            }
                            const barWidth = Math.min(percentUsed, 100);
                            const barColor = percentUsed > 100 ? 'bg-red-500' : 'bg-blue-600';
                            const remainingBudget = estCost - expense;

                            const div = document.createElement('div');
                            div.className = 'bg-white border rounded shadow p-4 flex flex-col justify-between';
                            div.innerHTML = `
                                <div>
                                    <div class="flex justify-between items-start mb-2">
                                        <h4 class="font-bold text-lg">#${s.local_id || s.id} ${s.name}</h4>
                                        <span class="text-xs px-2 py-1 rounded ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${s.status.toUpperCase()}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-1"><span class="font-semibold">Client:</span> ${s.client_name || '-'}</p>
                                    <p class="text-sm text-gray-600 mb-3"><span class="font-semibold">Location:</span> ${s.location || '-'}</p>
                                    
                                    <!-- Budget Section -->
                                    <div class="mb-4 bg-gray-50 p-2 rounded border">
                                        <div class="flex justify-between text-xs mb-1 font-semibold text-gray-500 uppercase tracking-wide">
                                            <span>Budget Progress</span>
                                            <span>Est: ₹${estCost.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                                            <div class="${barColor} h-2.5 rounded-full" style="width: ${barWidth}%"></div>
                                        </div>
                                        <div class="flex justify-between text-xs text-gray-600">
                                            <div class="${percentUsed > 100 ? 'text-red-600 font-bold' : ''}">Spent: ₹${expense.toLocaleString('en-IN')} (${percentUsed.toFixed(0)}%)</div>
                                            <div>Rem: ₹${remainingBudget.toLocaleString('en-IN')}</div>
                                        </div>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Reference</th>
                        <th>Actions</th>
                    </tr>
                </thead>                                    <!-- Cash Flow Section -->
                                    <div class="grid grid-cols-2 gap-2 text-center text-sm mb-4 border-t pt-3">
                                        <div class="text-green-700">
                                            <div class="font-bold text-xs uppercase text-gray-500">Received</div>
                                            <div class="font-bold text-base">₹${income.toLocaleString('en-IN')}</div>
                                        </div>
                                        <div class="${netCash >= 0 ? 'text-blue-700' : 'text-red-700'}">
                                            <div class="font-bold text-xs uppercase text-gray-500">Net Cash</div>
                                            <div class="font-bold text-base">₹${netCash.toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                    ${App.hasPermission('sites', 'edit') ? `<button class="btn btn-sm btn-secondary w-full edit-site-btn" data-id="${s.id}">Edit</button>` : ''}
                                </div>
                            `;
                            grid.appendChild(div);
                        });
                        
                        // Bind edit events for new items
                        document.querySelectorAll('.edit-site-btn').forEach(btn => {
                            btn.onclick = (e) => editSite(e.target.dataset.id);
                        });
                    }

                } catch (e) {
                    console.error(e);
                    document.getElementById('sitesGrid').innerHTML = `<p class="col-span-3 text-red-500">Error loading sites: ${e.message}</p>`; 
                } finally {
                    isLoading = false;
                    document.getElementById('sitesLoading').classList.add('hidden');
                }
            };

            const editSite = (id) => {
                const site = sitesData.find(s => s.id == id);
                if (!site) return;
                
                const form = document.getElementById('createSiteForm');
                form.reset();
                form.name.value = site.name;
                form.location.value = site.location || '';
                form.status.value = site.status;
                if (form.estimated_cost) form.estimated_cost.value = site.estimated_cost || 0;
                if (form.client_id) form.client_id.value = site.client_id || '';
                document.getElementById('siteId').value = site.id;
                
                form.dataset.mode = 'edit';
                document.getElementById('siteFormTitle').innerText = 'Edit Site';
                document.getElementById('siteSubmitBtn').innerText = 'Update';
                document.getElementById('siteFormContainer').classList.remove('hidden');
                
                // Scroll to top to see form
                document.querySelector('.main-content').scrollTop = 0; 
            };
            
            // Initial Init
            await fetchClients();
            loadSites(true);

            // Infinite Scroll
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.onscroll = () => {
                   if (mainContent.scrollTop + mainContent.clientHeight >= mainContent.scrollHeight - 50) {
                       loadSites(false);
                   }
                };
            }

            // Filters
            let debounceTimer;
            const debouncedLoad = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => loadSites(true), 300);
            };

            document.getElementById('siteSearch').oninput = debouncedLoad;
            document.getElementById('siteFilterClient').onchange = () => loadSites(true);
            document.getElementById('siteFilterStatus').onchange = () => loadSites(true);

            // Create/Edit Handler
            document.getElementById('addSiteBtn').onclick = () => {
                const form = document.getElementById('createSiteForm');
                form.reset();
                form.dataset.mode = 'create';
                document.getElementById('siteId').value = '';
                document.getElementById('siteFormTitle').innerText = 'New Site';
                document.getElementById('siteSubmitBtn').innerText = 'Save';
                document.getElementById('siteFormContainer').classList.remove('hidden');
            };

            document.getElementById('createSiteForm').onsubmit = async (e) => {
                e.preventDefault();
                const form = e.target;
                const mode = form.dataset.mode;
                const id = document.getElementById('siteId').value;

                try {
                    const data = Object.fromEntries(new FormData(form));
                    if (mode === 'edit') {
                        await api.put(`/sites/${id}`, data);
                    } else {
                        await api.post('/sites', data);
                    }
                    e.target.reset();
                    document.getElementById('siteFormContainer').classList.add('hidden');
                    loadSites(true); // reload all
                } catch (err) { alert(err.message); }
            };
        },
        
        categories: async () => {
             const loadCategories = async () => {
                try {
                    const cats = await api.get('/categories');
                    const container = document.getElementById('categoriesList');
                    if (cats.length === 0) {
                        container.innerHTML = '<p>No categories found</p>';
                        return;
                    }
                    container.innerHTML = cats.map(c => `
                       <div class="mb-6 border-b pb-4">
                           <div class="flex justify-between items-center mb-2">
                               <h4 class="text-lg font-bold">${c.name} <span class="text-sm font-normal text-gray-500">(${c.type || 'No Type'})</span></h4>
                               <div class="space-x-2">
                                   ${App.hasPermission('categories', 'edit') ? `<button class="btn btn-sm btn-primary add-field-btn" data-id="${c.id}" data-name="${c.name}">+ Field</button>` : ''}
                                   ${App.hasPermission('categories', 'edit') ? `<button class="btn btn-sm btn-secondary edit-cat-btn" data-id="${c.id}" data-name="${c.name}" data-type="${c.type || ''}">Edit</button>` : ''}
                                   ${App.hasPermission('categories', 'delete') ? `<button class="btn btn-sm btn-danger delete-cat-btn" data-id="${c.id}">Delete</button>` : ''}
                               </div>
                           </div>
                           <div class="bg-gray-50 p-2 rounded">
                               ${c.fields && c.fields.length > 0 ? 
                                   `<ul class="list-disc pl-5 space-y-1">
                                        ${c.fields.map(f => `
                                            <li class="flex justify-between items-center">
                                                <span>${f.field_name} <span class="text-xs text-gray-500">(${f.field_type})</span></span>
                                                    <div class="space-x-1">
                                                        ${App.hasPermission('categories', 'edit') ? `<button class="text-xs text-blue-600 edit-field-btn" 
                                                            data-id="${f.id}" 
                                                            data-cat-id="${c.id}"
                                                            data-name="${f.field_name}" 
                                                            data-type="${f.field_type}" 
                                                            data-required="${f.is_required}">Edit</button>` : ''}
                                                        ${App.hasPermission('categories', 'edit') ? `<button class="text-xs text-red-600 delete-field-btn" data-id="${f.id}">Delete</button>` : ''}
                                                    </div>
                                            </li>`).join('')}
                                    </ul>` 
                                   : '<p class="text-sm text-gray-400">No dynamic fields</p>'}
                           </div>
                       </div>
                    `).join('');
                    
                    // Category Events
                    document.querySelectorAll('.add-field-btn').forEach(btn => {
                        btn.onclick = () => {
                            const form = document.getElementById('addFieldForm');
                            form.reset();
                            form.dataset.mode = 'create';
                            document.getElementById('fieldModalCategoryId').value = btn.dataset.id;
                            document.getElementById('fieldModalTitle').innerText = 'Add Field to ' + btn.dataset.name;
                            document.getElementById('fieldModalSubmitBtn').innerText = 'Add';
                            document.getElementById('fieldModal').classList.remove('hidden');
                        };
                    });
                     // Field Events
                    document.querySelectorAll('.edit-field-btn').forEach(btn => {
                        btn.onclick = () => {
                            const form = document.getElementById('addFieldForm');
                            form.dataset.mode = 'edit';
                            document.getElementById('fieldModalFieldId').value = btn.dataset.id;
                            document.getElementById('fieldModalCategoryId').value = btn.dataset.catId;
                            
                            document.getElementById('fieldModalName').value = btn.dataset.name;
                            document.getElementById('fieldModalType').value = btn.dataset.type;
                            document.getElementById('fieldModalRequired').value = btn.dataset.required;
                            
                            document.getElementById('fieldModalTitle').innerText = 'Edit Field';
                            document.getElementById('fieldModalSubmitBtn').innerText = 'Update';
                            document.getElementById('fieldModal').classList.remove('hidden');
                        };
                    });
                    document.querySelectorAll('.delete-field-btn').forEach(btn => {
                        btn.onclick = async () => {
                            if(confirm('Delete this field?')) {
                                try {
                                    await api.delete(`/fields/${btn.dataset.id}`);
                                    loadCategories();
                                } catch(e) { alert(e.message); }
                            }
                        };
                    });
                    
                    document.querySelectorAll('.edit-cat-btn').forEach(btn => {
                        btn.onclick = () => {
                             const form = document.getElementById('createCategoryForm');
                             form.name.value = btn.dataset.name;
                             form.type.value = btn.dataset.type;
                             document.getElementById('catId').value = btn.dataset.id;
                             form.dataset.mode = 'edit';
                             
                             document.getElementById('catFormTitle').innerText = 'Edit Category';
                             document.getElementById('catSubmitBtn').innerText = 'Update';
                             document.getElementById('categoryFormContainer').classList.remove('hidden');
                        };
                    });

                    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
                        btn.onclick = async () => {
                             if(confirm('Are you sure you want to delete this category?')) {
                                 try {
                                     await api.delete(`/categories/${btn.dataset.id}`);
                                     loadCategories();
                                 } catch(e) { alert(e.message); }
                             }
                        };
                    });

                } catch (e) { document.getElementById('categoriesList').innerHTML = `<p class="text-danger">${e.message}</p>`; }
            };
            loadCategories();
            document.getElementById('addCategoryBtn').onclick = () => {
                const form = document.getElementById('createCategoryForm');
                form.reset();
                form.dataset.mode = 'create';
                document.getElementById('catId').value = '';
                document.getElementById('catFormTitle').innerText = 'New Category';
                document.getElementById('catSubmitBtn').innerText = 'Save';
                document.getElementById('categoryFormContainer').classList.remove('hidden');
            };
            
            document.getElementById('createCategoryForm').onsubmit = async (e) => {
                e.preventDefault();
                const form = e.target;
                const mode = form.dataset.mode;
                const id = document.getElementById('catId').value;
                
                try {
                    const data = Object.fromEntries(new FormData(form));
                    if (mode === 'edit') {
                        await api.put(`/categories/${id}`, data);
                    } else {
                        await api.post('/categories', data);
                    }
                    e.target.reset();
                    document.getElementById('categoryFormContainer').classList.add('hidden');
                    loadCategories();
                } catch (err) { alert(err.message); }
            };
            
            document.getElementById('addFieldForm').onsubmit = async (e) => {
                e.preventDefault();
                const form = e.target;
                const formData = new FormData(form);
                const catId = formData.get('category_id');
                const fieldId = formData.get('field_id');
                const data = Object.fromEntries(formData);
                const mode = form.dataset.mode;
                
                try {
                    if (mode === 'edit') {
                        await api.put(`/fields/${fieldId}`, data);
                    } else {
                        await api.post(`/categories/${catId}/fields`, data);
                    }
                    e.target.reset();
                    document.getElementById('fieldModal').classList.add('hidden');
                    loadCategories();
                } catch (err) { alert(err.message); }
            };
        },

        income: () => App.initTxLogic('income'),
        expenses: () => App.initTxLogic('expense')
    },
    
    getTxPageHTML: (mode) => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>${mode === 'income' ? 'Income' : 'Expenses'}</h3>
                    ${App.hasPermission('transactions', 'create') ? `<button class="btn btn-primary" id="addTxBtn">Add ${mode === 'income' ? 'Income' : 'Expense'}</button>` : ''}
                </div>
                
                <div class="flex space-x-2 mb-4 bg-gray-50 p-3 rounded">
                    <input type="date" id="filterStart" class="p-2 border rounded">
                    <input type="date" id="filterEnd" class="p-2 border rounded">
                    <button id="applyFiltersBtn" class="btn btn-secondary">Filter</button>
                </div>
                
                <div id="txFormContainer" class="hidden mb-4 p-4 border rounded bg-gray-50">
                    <h4 class="mb-2">New Transaction</h4>
                    <form id="createTxForm">
                        <input type="hidden" name="type" value="${mode}">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" name="date" required class="w-full p-2 border rounded">
                            </div>
                            <div class="form-group">
                                <label>Amount (₹)</label>
                                <input type="number" name="amount" step="0.01" required class="w-full p-2 border rounded">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 mt-2">
                             <div class="form-group">
                                <label>Category</label>
                                <select name="category_id" id="txCategorySelect" required class="w-full p-2 border rounded"><option>Loading...</option></select>
                            </div>
                            <div class="form-group">
                                <label>Client (Optional)</label>
                                <select name="client_id" id="txClientSelect" class="w-full p-2 border rounded"><option>Loading...</option></select>
                            </div>
                        </div>
                        
                        <div class="form-group mt-2">
                            <label>Site (Optional)</label>
                            <select name="site_id" id="txSiteSelect" class="w-full p-2 border rounded"><option value="">Select Client First</option></select>
                        </div>

                         <div class="form-group mt-2">
                            <label>Description</label>
                            <input type="text" name="description" class="w-full p-2 border rounded">
                        </div>

                        <div id="txCustomFields" class="mt-2 hidden border-t pt-2"></div>
                        
                        <div class="flex space-x-4 mt-4">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn" onclick="document.getElementById('txFormContainer').classList.add('hidden')">Cancel</button>
                        </div>
                    </form>
                </div>

                <table id="txTable">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Reference</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="txTableBody"><tr><td colspan="6">Loading...</td></tr></tbody>
                </table>
            </div>
    `,
    
    // Shared Logic
    initTxLogic: async (mode) => {
            let currentTransactions = [];
            
            const loadTx = async () => {
                const start = document.getElementById('filterStart').value;
                const end = document.getElementById('filterEnd').value;
                
                let query = [`type=${mode}`]; // Enforce mode
                if (start) query.push(`start_date=${start}`);
                if (end) query.push(`end_date=${end}`);
                
                try {
                    const txs = await api.get('/transactions?' + query.join('&'));
                    currentTransactions = txs;
                    const tbody = document.getElementById('txTableBody');
                    
                    if (txs.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6">No transactions found</td></tr>';
                        return;
                    }
                    
                    tbody.innerHTML = txs.map(t => `
                        <tr>
                            <td>${t.transaction_date}</td>
                            <td>${t.category_name}</td>
                            <td>
                                ${t.description || ''}
                                ${t.custom_data ? '<br><small class="text-gray-500">' + Object.entries(JSON.parse(t.custom_data || '{}')).map(([k,v]) => `${k}: ${v}`).join(', ') + '</small>' : ''}
                            </td>
                            <td class="font-bold ${t.transaction_type === 'income' ? 'text-success' : 'text-danger'}">
                                ${t.transaction_type === 'income' ? '+' : '-'}₹${parseFloat(t.amount).toLocaleString('en-IN')}
                            </td>
                            <td>
                                ${t.client_name ? `Client: ${t.client_name}` : ''}
                                ${t.site_name ? `<br>Site: ${t.site_name}` : ''}
                                ${t.org_name ? `<br><small class="text-xs text-gray-400">${t.org_name}</small>` : ''}
                            </td>
                            <td>
                                ${App.hasPermission('transactions', 'edit') ? `<button class="btn btn-sm btn-secondary edit-tx-btn" data-id="${t.id}">Edit</button>` : ''}
                                ${App.hasPermission('transactions', 'delete') ? `<button class="btn btn-sm btn-danger delete-tx-btn" data-id="${t.id}">Delete</button>` : ''}
                            </td>
                        </tr>
                    `).join('');
                    
                    document.querySelectorAll('.edit-tx-btn').forEach(btn => btn.onclick = () => editTransaction(btn.dataset.id));
                    document.querySelectorAll('.delete-tx-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.dataset.id));

                } catch (e) {
                    document.getElementById('txTableBody').innerHTML = `<tr><td colspan="6" class="text-danger">${e.message}</td></tr>`;
                }
            };
            
            // Initial Load
            loadTx();
            
            // Filters
            document.getElementById('applyFiltersBtn').onclick = loadTx;
            
            // Edit Handler
            const editTransaction = async (id) => {
                const tx = currentTransactions.find(t => t.id == id);
                if (!tx) return;
                
                // Ensure form visible & data loaded
                await document.getElementById('addTxBtn').click();
                
                // Override Title & Mode
                document.querySelector('#txFormContainer h4').innerText = 'Edit ' + (mode === 'income' ? 'Income' : 'Expense');
                const form = document.getElementById('createTxForm');
                form.dataset.mode = 'edit';
                form.dataset.id = id;
                
                // Populate Basic Fields
                form.date.value = tx.transaction_date;
                form.amount.value = tx.amount;
                form.category_id.value = tx.category_id;
                form.description.value = tx.description || '';
                
                // Trigger Change for Dynamic Fields
                const event = new Event('change');
                document.getElementById('txCategorySelect').dispatchEvent(event);
                
                // Wait briefly for dynamic fields to render
                setTimeout(() => {
                    // Populate Clients/Sites
                    if (tx.client_id) {
                        form.client_id.value = tx.client_id;
                        form.client_id.dispatchEvent(new Event('change')); // Filter sites
                        if (tx.site_id) {
                            // Site dropdown population is async/filtered, might need slight unnecessary delay or direct logic
                            // But usually synchronous enough if data is loaded. 
                            form.site_id.value = tx.site_id; 
                        }
                    }
                    
                    // Populate Custom Fields
                    if (tx.custom_data) {
                        try {
                            const custom = JSON.parse(tx.custom_data);
                            for (const [key, val] of Object.entries(custom)) {
                                const input = document.getElementsByName(`custom_fields[${key}]`)[0];
                                if (input) input.value = val;
                            }
                        } catch(e) {}
                    }
                }, 50);
            };

            const deleteTransaction = async (id) => {
                if(confirm('Delete this entry?')) {
                    try {
                        await api.delete(`/transactions/${id}`);
                        loadTx();
                    } catch(e) { alert(e.message); }
                }
            };
            
            // New Tx Form Logic
            const formContainer = document.getElementById('txFormContainer');
            let sitesData = [];
            
            const addTxBtn = document.getElementById('addTxBtn');
            if (addTxBtn) {
                addTxBtn.onclick = async () => {
                formContainer.classList.remove('hidden');
                
                // Reset Form
                const form = document.getElementById('createTxForm');
                form.reset();
                form.dataset.mode = 'create';
                delete form.dataset.id;
                document.getElementById('txCustomFields').innerHTML = '';
                document.getElementById('txCustomFields').classList.add('hidden');
                document.querySelector('#txFormContainer h4').innerText = 'New ' + (mode === 'income' ? 'Income' : 'Expense');

                try {
                    const [cats, clients, sites] = await Promise.all([
                        api.get('/categories'),
                        api.get('/clients'),
                        api.get('/sites')
                    ]);
                    sitesData = sites;
                    
                    const filteredCats = cats.filter(c => c.type === mode || c.type === null);
                    document.getElementById('txCategorySelect').innerHTML = '<option value="">Select Category</option>' + filteredCats.map(c => `<option value="${c.id}" data-type="${c.type}" data-fields='${JSON.stringify(c.fields || [])}'>${c.name}</option>`).join('');
                    document.getElementById('txClientSelect').innerHTML = '<option value="">None</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    document.getElementById('txSiteSelect').innerHTML = '<option value="">Select Client First</option>'; 
                    
                } catch (e) { alert('Failed to load form data: ' + e.message); }
            };
            }
            
            // Dynamic Fields Handler
            document.getElementById('txCategorySelect').onchange = (e) => {
                const opt = e.target.selectedOptions[0];
                if (!opt) return;
                
                const fields = JSON.parse(opt.dataset.fields || '[]');
                const fieldsContainer = document.getElementById('txCustomFields');
                
                fieldsContainer.innerHTML = '';
                
                if (fields.length > 0) {
                     fieldsContainer.classList.remove('hidden');
                     fieldsContainer.innerHTML = '<h5 class="mb-2 font-bold">Additional Details</h5>' + fields.map(f => {
                         let input = '';
                         if (f.field_type === 'select') {
                             const opts = JSON.parse(f.field_options || '[]');
                             input = `<select name="custom_fields[${f.field_slug}]" class="w-full p-2 border rounded" ${f.is_required ? 'required' : ''}>
                                        <option value="">Select ${f.field_name}</option>
                                        ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
                                      </select>`;
                         } else if (f.field_type === 'textarea') {
                             input = `<textarea name="custom_fields[${f.field_slug}]" class="w-full p-2 border rounded" ${f.is_required ? 'required' : ''}></textarea>`;
                         } else {
                             input = `<input type="${f.field_type}" name="custom_fields[${f.field_slug}]" class="w-full p-2 border rounded" ${f.is_required ? 'required' : ''}>`;
                         }
                         
                         return `<div class="form-group mb-2">
                                    <label>${f.field_name}${f.is_required ? '*' : ''}</label>
                                    ${input}
                                 </div>`;
                     }).join('');
                }
            };

            document.getElementById('txClientSelect').onchange = (e) => {
                const clientId = e.target.value;
                const siteSelect = document.getElementById('txSiteSelect');
                if (!clientId) { siteSelect.innerHTML = '<option value="">Select Client First</option>'; return; }
                const filtered = sitesData.filter(s => s.client_id == clientId);
                siteSelect.innerHTML = '<option value="">None</option>' + filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            };

            document.getElementById('createTxForm').onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = { custom_fields: {} };
                
                for (let [key, val] of formData.entries()) {
                    if (key.startsWith('custom_fields[')) {
                        const slug = key.match(/\[(.*?)\]/)[1];
                        data.custom_fields[slug] = val;
                    } else {
                        data[key] = val;
                    }
                }
                
                try {
                    const form = e.target;
                    const mode = form.dataset.mode;
                    if (mode === 'edit') {
                         await api.put(`/transactions/${form.dataset.id}`, data);
                    } else {
                         await api.post('/transactions', data);
                    }
                    
                    form.reset();
                    document.getElementById('txCustomFields').innerHTML = '';
                    document.getElementById('txCustomFields').classList.add('hidden');
                    formContainer.classList.add('hidden');
                    loadTx();
                } catch (err) { alert(err.message); }
            };
    },
    
    bindLoginEvents() {
        document.getElementById('loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const res = await api.post('/login', data);
                if (res.success) {
                    this.user = res.user;
                    this.router('dashboard');
                }
            } catch (err) {
                alert('Login failed: ' + err.message);
            }
        };
    },
    
    bindNavEvents() {
        document.querySelectorAll('a[data-link]').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                this.router(link.dataset.link);
            };
        });
        
        document.getElementById('logoutBtn').onclick = async (e) => {
            e.preventDefault();
            await api.post('/logout', {});
            this.user = null;
            this.router('login');
        };
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
