import { api } from './utils/api.js';
import { Autocomplete } from './components/autocomplete.js';
import { Formatters } from './utils/formatters.js';

const App = {
    user: null, // { id, username, role, org_id, permissions }
    
    hasPermission(resource, action) {
        if (!this.user) return false;
        if (this.user.role === 'super_admin' || this.user.role === 'org_admin') return true;
        if (Array.isArray(this.user.permissions)) {
            return this.user.permissions.includes(`${resource}.${action}`);
        }
        return true; 
    },

    // Pagination State
    pagination: {},
    observers: {},

    // Helper: Setup Infinite Scroll
    setupInfiniteScroll(resource, loadFn) {
        if (this.observers[resource]) this.observers[resource].disconnect();
        
        const sentinel = document.getElementById(`${resource}Sentinel`);
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && this.pagination[resource]?.hasMore && !this.pagination[resource]?.isLoading) {
                loadFn();
            }
        }, { rootMargin: '100px' });
        
        observer.observe(sentinel);
        this.observers[resource] = observer;
    },

    async loadPaginated(resource, url, containerId, renderRowFn, params = {}) {
        if (!this.pagination[resource]) {
            this.pagination[resource] = { offset: 0, hasMore: true, isLoading: false };
            document.getElementById(containerId).innerHTML = ''; // Clear on fresh init
        }
        
        const state = this.pagination[resource];
        if (state.isLoading || !state.hasMore) return;
        
        state.isLoading = true;
        const sentinel = document.getElementById(`${resource}Sentinel`);
        if(sentinel) sentinel.innerText = 'Loading...';

        try {
            const query = new URLSearchParams({ 
                limit: 10, 
                offset: state.offset,
                ...params 
            });
            
            const data = await api.get(`${url}?${query.toString()}`);
            
            if (data.total !== undefined) {
                const countEl = document.getElementById(`${resource}TotalCount`);
                if(countEl) countEl.innerText = `(${data.total})`;
            }

            const items = Array.isArray(data) ? data : (data.data || []);
            
            if (items.length < 10) {
                state.hasMore = false;
                if(sentinel) sentinel.style.display = 'none';
            } else {
                if(sentinel) sentinel.innerText = '';
            }
            
            if (items.length > 0) {
                // Calculate serial number using current offset (before increment)
                const startParams = state.offset;
                state.offset += items.length;
                
                const container = document.getElementById(containerId);
                container.innerHTML += items.map((item, index) => renderRowFn(item, startParams + index + 1)).join('');
                
                // Re-bind events if needed (like delete buttons)
                // ideally we use event delegation on container, but sticking to existing pattern:
                this.bindResourceEvents(resource); 
            } else if (state.offset === 0) {
                document.getElementById(containerId).innerHTML = '<tr><td colspan="100%" class="text-center text-gray-500">No records found</td></tr>';
            }
            
        } catch (e) {
            console.error(e);
            if(sentinel) sentinel.innerText = 'Error loading data';
        } finally {
            state.isLoading = false;
        }
    },
    
    // Event Delegation for resource tables
    setupResourceEvents(resource, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Remove existing listener to prevent duplicates if called multiple times (though init should be once)
        // A better approach for delegation is to potentialy not need re-binding, but if we init pages fresh, it's fine.
        // Let's just assign onclick handler to the container which is simple and effective.
        
        container.onclick = (e) => {
            const target = e.target;
            // Handle Edit
            if (target.classList.contains(`edit-${resource.slice(0,-1)}-btn`)) { 
                // e.g. edit-org-btn. Resource 'orgs' -> 'org'
                const id = target.dataset.id;
                if (this.pageLogic[`${resource}_edit`]) {
                    this.pageLogic[`${resource}_edit`](id);
                }
            }
            // Handle Delete
            else if (target.classList.contains(`delete-${resource.slice(0,-1)}-btn`) || target.classList.contains('btn-danger')) {
                 // Check specific class if needed, or rely on dataset
                 if (target.classList.contains(`delete-${resource.slice(0,-1)}-btn`)) {
                    const id = target.dataset.id;
                    if (this.pageLogic[`${resource}_delete`]) {
                        this.pageLogic[`${resource}_delete`](id);
                    }
                 }
            }
        };
    },
    
    bindResourceEvents(resource) {
        // Deprecated in favor of setupResourceEvents, but kept/redirected for compatibility if called
        // actually, loadPaginated calls this. We should just do nothing or log.
        // We will move the binding logic to the page init instead of loadPaginated.
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

    // Custom Helpers
    confirm(message, title='Confirm Action') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmTitle').innerText = title;
            document.getElementById('confirmMessage').innerText = message;
            modal.classList.remove('hidden');
            
            const cleanup = () => {
                modal.classList.add('hidden');
                yesBtn.onclick = null;
                cancelBtn.onclick = null;
            };

            const yesBtn = document.getElementById('confirmYesBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            yesBtn.onclick = () => { cleanup(); resolve(true); };
            cancelBtn.onclick = () => { cleanup(); resolve(false); };
        });
    },

    notify(message, type='info') {
        const sb = document.getElementById('snackbar');
        const msgEl = document.getElementById('snackbarMessage');
        if(!sb || !msgEl) return;

        msgEl.innerText = message;
        sb.className = `fixed bottom-5 right-5 px-6 py-3 rounded shadow-lg text-white transform transition-all duration-300 z-50 pointer-events-none translate-y-0 opacity-100 ${type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-green-600' : 'bg-gray-800')}`;
        
        // Auto hide
        setTimeout(() => {
             sb.classList.remove('translate-y-0', 'opacity-100');
             sb.classList.add('translate-y-20', 'opacity-0');
        }, 3000);
    },
    
    router(page) {
        history.pushState({ page }, '', `/${page === 'dashboard' ? '' : page}`);
        this.renderPage(page);
        // Close sidebar on navigation (mobile)
        document.querySelector('.sidebar')?.classList.remove('open');
        document.querySelector('.sidebar-overlay')?.classList.remove('visible');
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
            <div class="sidebar-overlay" onclick="document.querySelector('.sidebar').classList.remove('open'); this.classList.remove('visible');"></div>
            <div class="sidebar">
                <div class="sidebar-brand flex items-center justify-center py-4">
                    <img src="/assets/logo.png" alt="FMCC" class="h-20 w-auto">
                </div>
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
                    <div class="flex items-center">
                        <button class="menu-btn" onclick="document.querySelector('.sidebar').classList.add('open'); document.querySelector('.sidebar-overlay').classList.add('visible');">
                            &#9776;
                        </button>
                        <h2>${page.charAt(0).toUpperCase() + page.slice(1)}</h2>
                    </div>
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
                <div class="card login-box flex flex-col items-center">
                    <img src="/assets/logo.png" alt="FMCC Logo" class="h-24 w-auto mb-6">
                    <form id="loginForm">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" placeholder="Enter username" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" placeholder="Enter password" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
                    </form>
                </div>
            </div>
        `,
        dashboard: () => `
            <div>
                <div class="flex flex-col md:flex-row justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Dashboard</h3>
                    <!-- Export moved to header or keep in filter? User image shows clear button at end. Export can be separate. -->
                </div>

                <!-- Filter Bar -->
                <div class="bg-white p-5 rounded-lg shadow-sm mb-6 border border-gray-100">
                    <div class="flex flex-wrap items-end gap-x-6 gap-y-4">
                        
                        <!-- From Date -->
                        <div class="flex-1 min-w-[150px]">
                            <label class="block text-xs font-medium text-gray-500 mb-1">From</label>
                            <input type="date" id="statsStart" class="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm text-gray-700">
                        </div>

                        <!-- To Date -->
                        <div class="flex-1 min-w-[150px]">
                            <label class="block text-xs font-medium text-gray-500 mb-1">To</label>
                            <input type="date" id="statsEnd" class="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm text-gray-700">
                        </div>

                        <!-- Client -->
                        <div class="flex-[2] min-w-[200px]">
                            <label class="block text-xs font-medium text-gray-500 mb-1">Client</label>
                            <select id="statsClient" class="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm text-gray-700"><option value="">All Clients</option></select>
                        </div>

                        <!-- Site -->
                        <div class="flex-[2] min-w-[200px]">
                            <label class="block text-xs font-medium text-gray-500 mb-1">Site</label>
                            <select id="statsSite" class="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm text-gray-700"><option value="">All Sites</option></select>
                        </div>
                        
                        <!-- Actions -->
                        <div class="flex items-center gap-3 ml-auto">
                            <!-- Export -->
                             <a href="/api/v1/export" target="_blank" class="p-2.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Export Data">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                            
                            <!-- Clear Filter -->
                            <button id="clearStatsFilter" class="p-2.5 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors shadow-sm border border-red-100" title="Clear Filters">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-filter-x"><path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055"/><path d="m22 3-5 5"/><path d="m17 3 5 5"/></svg>
                            </button>
                        </div>
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
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <h3>Organizations <span id="orgsTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    <button class="btn btn-primary" id="addOrgBtn">Add Organization</button>
                </div>
                <div id="orgFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4">New Organization</h4>
                        <form id="createOrgForm">
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" name="name" placeholder="Enter organization name" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('orgFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                <table id="orgTable">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="orgTableBody"></tbody>
                </table>
                <div id="orgsSentinel" class="text-center py-2 text-gray-400 text-sm"></div>
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
                        <input type="text" name="name" placeholder="Enter organization name" required>
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
                    <h3>Users <span id="usersTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    ${App.hasPermission('users', 'create') ? '<button class="btn btn-primary" id="addUserBtn">Add User</button>' : ''}
                </div>
                <div id="userFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4" id="userFormTitle">New User</h4>
                        <form id="createUserForm">
                            <input type="hidden" id="userId">
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" name="username" placeholder="Enter username" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="password" placeholder="Enter password" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                <small id="userPasswordHelp" class="text-gray-500 hidden">Leave blank to keep unchanged</small>
                            </div>
                            <div class="form-group">
                                <label>Role</label>
                                <select name="role" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                    <option value="org_admin">Org Admin</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            ${App.user.role === 'super_admin' ? `
                            <div class="form-group">
                                <label>Organization ID</label>
                                <input type="number" name="org_id" placeholder="Enter Org ID" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>` : ''}
                            
                            <div class="form-group mt-4">
                                <label class="block font-bold mb-2">Permissions</label>
                                <div class="border p-2 rounded max-h-60 overflow-y-auto text-sm">
                                    <div class="hidden md:grid md:grid-cols-5 font-bold mb-2 sticky top-0 bg-white z-10 border-b pb-2">
                                        <div>Resource</div>
                                        <div class="text-center">View</div>
                                        <div class="text-center">Create</div>
                                        <div class="text-center">Edit</div>
                                        <div class="text-center">Delete</div>
                                    </div>
                                    <div class="space-y-4 md:space-y-0">
                                        ${['clients', 'sites', 'categories', 'transactions', 'transactions_income', 'transactions_expense', 'users'].map(res => `
                                            <div class="border-b pb-4 md:pb-0 md:border-b-0 md:grid md:grid-cols-5 md:py-2 hover:bg-gray-50 items-center">
                                                <div class="font-medium md:font-normal mb-2 md:mb-0 capitalize text-gray-700">${res.replace('_', ' ')}</div>
                                                <div class="grid grid-cols-2 gap-2 md:contents">
                                                    <label class="flex items-center space-x-2 md:justify-center cursor-pointer">
                                                        <input type="checkbox" name="permissions" value="${res}.view" class="form-checkbox text-blue-600 rounded" title="View ${res.replace('_', ' ')}">
                                                        <span class="md:hidden text-sm text-gray-600">View</span>
                                                    </label>
                                                    <label class="flex items-center space-x-2 md:justify-center cursor-pointer">
                                                        <input type="checkbox" name="permissions" value="${res}.create" class="form-checkbox text-blue-600 rounded" title="Create ${res.replace('_', ' ')}">
                                                        <span class="md:hidden text-sm text-gray-600">Create</span>
                                                    </label>
                                                    <label class="flex items-center space-x-2 md:justify-center cursor-pointer">
                                                        <input type="checkbox" name="permissions" value="${res}.edit" class="form-checkbox text-blue-600 rounded" title="Edit ${res.replace('_', ' ')}">
                                                        <span class="md:hidden text-sm text-gray-600">Edit</span>
                                                    </label>
                                                    <label class="flex items-center space-x-2 md:justify-center cursor-pointer">
                                                        <input type="checkbox" name="permissions" value="${res}.delete" class="form-checkbox text-blue-600 rounded" title="Delete ${res.replace('_', ' ')}">
                                                        <span class="md:hidden text-sm text-gray-600">Delete</span>
                                                    </label>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <small class="text-gray-500">If no permissions selected, role defaults apply.</small>
                            </div>

                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('userFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" id="userSubmitBtn">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
                <table id="userTable">
                    <thead>
                        <tr><th>ID</th><th>Username</th><th>Role</th><th>Organization</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="userTableBody"></tbody>
                </table>
                <div id="usersSentinel" class="text-center py-2 text-gray-400 text-sm"></div>
            </div>
        `,
        clients: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Clients <span id="clientsTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    ${App.hasPermission('clients', 'create') ? '<button class="btn btn-primary" id="addClientBtn">Add Client</button>' : ''}
                </div>
                <div id="clientFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4">New Client</h4>
                        <form id="createClientForm">
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" name="name" placeholder="Enter client name" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="form-group">
                                <label>Parent Client (Optional)</label>
                                <select name="parent_client_id" id="parentClientSelect" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">None</option></select>
                            </div>
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('clientFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                <table id="clientTable">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Parent</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="clientTableBody"></tbody>
                </table>
                <div id="clientsSentinel" class="text-center py-2 text-gray-400 text-sm"></div>
            </div>
        `,
        sites: () => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>Sites <span id="sitesTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    ${App.hasPermission('sites', 'create') ? '<button class="btn btn-primary" id="addSiteBtn">Add Site</button>' : ''}
                </div>
                
                <!-- Filters -->
                <div class="flex space-x-4 mb-4 bg-gray-50 p-3 rounded">
                    <input type="text" id="siteSearch" placeholder="Search Sites..." class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors flex-grow">
                    <select id="siteFilterClient" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">All Clients</option></select>
                    <select id="siteFilterStatus" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div id="siteFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4" id="siteFormTitle">New Site</h4>
                        <form id="createSiteForm">
                            <input type="hidden" name="id" id="siteId">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label>Client</label>
                                    <select name="client_id" id="siteClientSelect" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">Select Client</option></select>
                                </div>
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" name="name" placeholder="Enter site name" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mt-2">
                                 <div class="form-group">
                                    <label>Location</label>
                                    <input type="text" name="location" placeholder="Enter location" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select name="status" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label>Estimated Cost (₹)</label>
                                <input type="number" name="estimated_cost" step="0.01" placeholder="0.00" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('siteFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" id="siteSubmitBtn">Save</button>
                            </div>
                        </form>
                    </div>
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
                <div id="categoryFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4" id="catFormTitle">New Category</h4>
                        <form id="createCategoryForm">
                            <input type="hidden" name="id" id="catId">
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" name="name" placeholder="Enter category name" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="form-group">
                                <label>Type (Optional)</label>
                                <select name="type" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                    <option value="">Select Type (Optional)</option>
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                </select>
                                <small class="text-gray-500 block mt-1">If selected, will auto-fill transaction type.</small>
                            </div>
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('categoryFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" id="catSubmitBtn">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
                <div id="categoriesList">Loading...</div>
            
                <!-- Field Modal -->
                <div id="fieldModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-sm">
                        <h4 class="text-xl font-bold mb-4" id="fieldModalTitle">Add Field</h4>
                        <form id="addFieldForm">
                            <input type="hidden" name="category_id" id="fieldModalCategoryId">
                            <input type="hidden" name="field_id" id="fieldModalFieldId">
                            <div class="form-group">
                                <label>Field Name</label>
                                <input type="text" name="field_name" id="fieldModalName" placeholder="Enter field name" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>
                            <div class="form-group">
                                <label>Input Type</label>
                                <select name="field_type" id="fieldModalType" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="select">Dropdown</option>
                                    <option value="textarea">Large Text</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Required?</label>
                                <select name="is_required" id="fieldModalRequired" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                    <option value="0">No</option>
                                    <option value="1">Yes</option>
                                </select>
                            </div>
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('fieldModal').classList.add('hidden')">Close</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" id="fieldModalSubmitBtn">Add</button>
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
                    <h3>${mode === 'income' ? 'Income' : 'Expenses'} <span id="transactionsTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    <button class="btn btn-primary" id="addTxBtn">Add ${mode === 'income' ? 'Income' : 'Expense'}</button>
                </div>
                
                <!-- Filters -->
                <div class="flex space-x-4 mb-4">
                    <!-- Type Filter Hidden as it is implied by page -->
                    <input type="date" id="filterStart" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                    <input type="date" id="filterEnd" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                    <button id="applyFiltersBtn" class="btn btn-sm">Filter</button>
                    ${mode === 'all' ? `<select id="filterType" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select>` : ''}
                </div>

                <div id="txFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4">New ${mode === 'income' ? 'Income' : 'Expense'}</h4>
                        <form id="createTxForm" data-mode="${mode}">
                            <input type="hidden" name="type" value="${mode}">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label>Date</label>
                                    <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                                <div class="form-group">
                                    <label>Amount (₹)</label>
                                    <input type="number" name="amount" step="0.01" placeholder="0.00" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4 mt-2">
                                 <div class="form-group">
                                    <label>Category</label>
                                    <select name="category_id" id="txCategorySelect" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option>Loading...</option></select>
                                </div>
                                <div class="form-group">
                                    <label>Client (Optional)</label>
                                    <select name="client_id" id="txClientSelect" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option>Loading...</option></select>
                                </div>
                            </div>
                            
                            <div class="form-group mt-2">
                                <label>Site (Optional)</label>
                                <select name="site_id" id="txSiteSelect" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">Select Client First</option></select>
                            </div>

                             <div class="form-group mt-2">
                                <label>Description</label>
                                <input type="text" name="description" placeholder="Enter description" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>

                            <div id="txCustomFields" class="mt-2 hidden border-t pt-2"></div>
                            
                            <div class="flex justify-end space-x-3 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('txFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
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
    
    pageLogic: {
        dashboard: async () => {
             // Load Data for Filters
             let sitesData = [];
             try {
                 const [clientsRes, sitesRes] = await Promise.all([
                     api.get('/clients?limit=1000'),
                     api.get('/sites?limit=1000')
                 ]);
                 // API returns { data: [...], total: ... }
                 const clients = clientsRes.data || [];
                 const sites = sitesRes.data || [];
                 sitesData = sites;
                 
                 document.getElementById('statsClient').innerHTML = '<option value="">All Clients</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                 document.getElementById('statsSite').innerHTML = '<option value="">All Sites</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                 
                 // Initialize Autocomplete
                 window.clientAc = new Autocomplete('#statsClient');
                 window.siteAc = new Autocomplete('#statsSite');

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
                                    <div class="text-xs text-gray-400">${Formatters.date(t.transaction_date)}</div>
                                </div>
                                <div class="font-bold text-sm ${colorClass}">${Formatters.amount(t.amount)}</div>
                            </div>
                         `).join('');
                     };
                     
                     renderList(res.recent_income, 'recentIncomeList', 'text-success');
                     renderList(res.recent_expenses, 'recentExpenseList', 'text-danger');



                     document.querySelector('a[href^="/api/v1/export"]').href = `/api/v1/export?${query}`; // Updated selector as ID removed from link? Actually ID might be gone or still on <a>?
                     // I will verify selector or just use querySelector
                     
                 } catch (e) {
                     console.error(e);
                     alert('Dashboard Load Failed: ' + e.message);
                 }
             };

             // Init Dates: Last 1 Year to Today
             const today = new Date();
             const lastYear = new Date();
             lastYear.setFullYear(today.getFullYear() - 1);
             
             document.getElementById('statsStart').value = lastYear.toISOString().split('T')[0];
             document.getElementById('statsEnd').value = today.toISOString().split('T')[0];

             // Initial Load
             loadStats();

             // Listeners
             document.getElementById('statsStart').onchange = loadStats;
             document.getElementById('statsEnd').onchange = loadStats;
             document.getElementById('statsClient').onchange = () => {
                 // Filter sites based on client?
                 // Simple approach: show all sites, or filter them
                 const val = document.getElementById('statsClient').value;
                 if(val) {
                     // Filter valid sites
                     // Re-populate sites?
                     // If we want to be fancy, yes. For now just reload stats.
                     // But user might want to select site.
                 }
                 loadStats();
             };
             document.getElementById('statsSite').onchange = loadStats;

             // Clear Filter
             const clearBtn = document.getElementById('clearStatsFilter');
             if(clearBtn) {
                 clearBtn.onclick = () => {
                     // Reset Dates to Default (1 Year)
                     const today = new Date();
                     const lastYear = new Date();
                     lastYear.setFullYear(today.getFullYear() - 1);
                     
                     document.getElementById('statsStart').value = lastYear.toISOString().split('T')[0];
                     document.getElementById('statsEnd').value = today.toISOString().split('T')[0];
                     
                     // Reset Dropdowns
                     const clientSelect = document.getElementById('statsClient');
                     const siteSelect = document.getElementById('statsSite');
                     clientSelect.value = "";
                     siteSelect.value = "";

                     // Reset Autocomplete
                     // We must clear the input value manually so validateSelection doesn't revert to the old label
                     if(window.clientAc) {
                         window.clientAc.input.value = "";
                         window.clientAc.validateSelection();
                     }
                     if(window.siteAc) {
                         window.siteAc.input.value = "";
                         window.siteAc.validateSelection();
                     }

                     loadStats();
                 };
             }
             document.getElementById('statsClient').onchange = (e) => {
                  const cid = e.target.value;
                  const siteSelect = document.getElementById('statsSite');
                  if(!cid) {
                      siteSelect.innerHTML = '<option value="">All Sites</option>' + sitesData.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                  } else {
                      const filtered = sitesData.filter(s => s.client_id == cid);
                      siteSelect.innerHTML = '<option value="">All Sites</option>' + filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                  }
                  // Update Autocomplete options
                  if(window.siteAc) window.siteAc.update();
                  
                  loadStats();
              };
             document.getElementById('statsSite').onchange = loadStats;
         },
        orgs: async () => {
             // Reset Pagination
             App.pagination['orgs'] = null;
             
             // Define Render Function
             const renderOrgRow = (org, index) => `
                <tr>
                    <td data-label="ID">${index}</td>
                    <td data-label="Name">${org.name}</td>
                    <td data-label="Status">${org.status}</td>
                    <td data-label="Actions">
                        <button class="btn btn-sm edit-org-btn" data-id="${org.id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-org-btn" data-id="${org.id}">Delete</button>
                    </td>
                </tr>
             `;

             const loadOrgs = () => App.loadPaginated('orgs', '/orgs', 'orgTableBody', renderOrgRow);
             
             // Init
             loadOrgs();
             App.setupInfiniteScroll('orgs', loadOrgs);
             App.setupResourceEvents('sites', 'sitesGrid'); // Note: sites uses Grid, same logic applies to container onclick
             App.setupResourceEvents('clients', 'clientTableBody'); // Added this line
             App.setupResourceEvents('orgs', 'orgTableBody');
             
             // Helper for edit (attached to App.pageLogic for global access via bindResourceEvents)
             App.pageLogic.orgs_edit = (id) => {
                 // We need to fetch the single org or find it in DOM? 
                 // Since we have partial data, searching array is hard if we don't store it.
                 // But for simplicity let's just fetch it purely or use the row. 
                 // Actually the previous implementation used 'orgsData' array.
                 // We can either fetch /orgs/:id (if api exists) or keep 'allData' cache.
                 // Given the infinite scroll, we should probably just fetch the single org details or use what's on screen.
                 // Let's rely on finding row for now or better, store loaded data in pagination state.
                 // Enhancing PAGINATION STATE to store data:
                 // Update: loadPaginated doesn't store data.
                 // Quick fix: Fetch list again? No.
                 // Let's just grab text from row? No.
                 // Correct way: Fetch /orgs with search?
                 // Or just iterate existing DOM?
                 // Let's assume we can fetch all for Edit? No that defeats the purpose.
                 // Let's just look at the row.
                 // Creating a 'state' store is best.
                 
                 // Re-implementation: just assume we can get name from DOM for now or fetch.
                 // Actually we have valid Org ID.
                 // Let's just show form.
                 const form = document.getElementById('createOrgForm');
                 // Getting name from DOM row is hacky.
                 // Let's fetch /orgs/:id? Route doesn't exist.
                 // We can fetch /orgs?id=X if we add filter?
                 // Or we can just iterate `App.pagination['orgs'].data` if we added it.
                 // Let's add data storage to loadPaginated.
                 
                 // For now, simple hack:
                 const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
                 form.name.value = row.querySelector('[data-label="Name"]').innerText;
                 
                 form.dataset.mode = 'edit';
                 form.dataset.id = id;
                 document.getElementById('orgFormContainer').classList.remove('hidden');
                 document.querySelector('#createOrgForm button[type="submit"]').innerText = 'Update';
             };

             App.pageLogic.orgs_delete = async (id) => {
                  if (await App.confirm('Are you sure you want to delete this organization?', 'Delete Organization')) {
                      try {
                          await api.delete(`/orgs/${id}`);
                          App.notify('Organization deleted successfully', 'success');
                          // Reload
                          App.pagination['orgs'] = null;
                          loadOrgs();
                      } catch (e) { App.notify(e.message, 'error'); }
                  }
             };

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
                         App.notify('Organization updated successfully', 'success');
                     } else {
                         await api.post('/orgs', data);
                         App.notify('Organization created successfully', 'success');
                     }
                     e.target.reset();
                     document.getElementById('orgFormContainer').classList.add('hidden');
                     loadOrgs();
                 } catch (err) {
                     App.notify(err.message, 'error');
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
                 
                 document.getElementById('removeLogoBtn').onclick = async () => {
                     if(await App.confirm('Remove this logo?', 'Remove Logo')) {
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
        users: () => {
             App.pagination['users'] = null;
             
             const renderUserRow = (u, index) => `
                <tr>
                    <td data-label="ID">${index}</td>
                    <td data-label="Username">${u.username}</td>
                    <td data-label="Role">${u.role}</td>
                    <td data-label="Organization">${u.org_name || '-'}</td>
                    <td data-label="Actions">
                         ${App.hasPermission('users', 'edit') ? `<button class="btn btn-sm btn-edit-user" data-id="${u.id}">Edit</button>` : ''}
                         ${App.hasPermission('users', 'delete') ? `<button class="btn btn-sm btn-danger btn-delete-user" data-id="${u.id}">Delete</button>` : ''}
                    </td>
                </tr>
             `;
             
             const loadUsers = () => App.loadPaginated('users', '/users', 'userTableBody', renderUserRow);
             loadUsers();
             App.setupInfiniteScroll('users', loadUsers);
             App.setupResourceEvents('users', 'userTableBody');
             
             // Helpers
             App.pageLogic.users_edit = (id) => {
                 const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
                 if(!row) return; // Should not happen
                 
                 const form = document.getElementById('createUserForm');
                 form.username.value = row.querySelector('[data-label="Username"]').innerText;
                 form.role.value = row.querySelector('[data-label="Role"]').innerText;
                 
                 // We can't easily get org_id or permissions from just the table row if it's not displayed or complex.
                 // Ideally we fetch the user details. But for now let's rely on stored data or just minimal edit?
                 // Let's implement fetchSingle for full edit capability to be safe.
                 api.get(`/users?id=${id}`).then(res => { 
                     const user = (res.data && res.data.length > 0) ? res.data[0] : null;
                     if(user) {
                         if (form.elements['org_id']) form.elements['org_id'].value = user.org_id || '';
                         
                         // Permissions
                         const checkboxes = form.querySelectorAll('input[name="permissions"]');
                         checkboxes.forEach(cb => cb.checked = false);
                         let perms = user.permissions;
                         if (typeof perms === 'string') try { perms = JSON.parse(perms); } catch(e){}
                         if (Array.isArray(perms)) {
                             checkboxes.forEach(cb => { if(perms.includes(cb.value)) cb.checked = true; });
                         }
                     }
                 });

                 document.getElementById('userId').value = id;
                 document.getElementById('userFormTitle').innerText = 'Edit User';
                 document.querySelector('#createUserForm button[type="submit"]').innerText = 'Update';
                 document.getElementById('userPasswordHelp').classList.remove('hidden');
                 document.getElementById('userFormContainer').classList.remove('hidden');
                 form.dataset.mode = 'edit';
                 form.password.required = false;
             };
             
             // Bind to Page Logic for generic handler
             App.pageLogic.users_delete = async (id) => {
                 if(await App.confirm('Delete user?', 'Delete User')) {
                     try {
                         await api.delete(`/users/${id}`);
                         App.notify('User deleted', 'success');
                         App.pagination['users'] = null;
                         loadUsers();
                     } catch(e) { App.notify(e.message, 'error'); }
                 }
             };

             // Local Event Bindings (for the Add button which is static in template)
             const addUserBtn = document.getElementById('addUserBtn');
             if(addUserBtn) {
                 addUserBtn.onclick = () => {
                     document.getElementById('createUserForm').reset();
                     document.getElementById('userId').value = '';
                     document.getElementById('userFormTitle').innerText = 'New User';
                     document.querySelector('#createUserForm button[type="submit"]').innerText = 'Create';
                     document.getElementById('userPasswordHelp').classList.add('hidden');
                     document.getElementById('userFormContainer').classList.remove('hidden');
                     document.getElementById('createUserForm').dataset.mode = 'create';
                     document.getElementById('createUserForm').password.required = true;
                     document.querySelectorAll('input[name="permissions"]').forEach(cb => cb.checked = false);
                 };
             }
             
             document.getElementById('createUserForm').onsubmit = async (e) => {
                 e.preventDefault();
                 const fd = new FormData(e.target);
                 const data = Object.fromEntries(fd.entries());
                 
                 const perms = [];
                 e.target.querySelectorAll('input[name="permissions"]:checked').forEach(cb => perms.push(cb.value));
                 if(perms.length > 0) data.permissions = perms;
                 
                 if (e.target.dataset.mode === 'edit' && !data.password) delete data.password;

                 const id = document.getElementById('userId').value;
                 try {
                     if(id) { 
                         await api.put(`/users/${id}`, data);
                         App.notify('User updated', 'success');
                     } else { 
                         await api.post('/users', data);
                         App.notify('User created', 'success');
                     }
                     
                     document.getElementById('userFormContainer').classList.add('hidden');
                     App.pagination['users'] = null;
                     loadUsers();
                 } catch(err) { App.notify(err.message, 'error'); }
             };
             
             // Bind Events override
             App.bindResourceEvents = (res) => {
                 if (res === 'users') {
                     document.querySelectorAll('.btn-edit-user').forEach(btn => btn.onclick = () => App.pageLogic.users_edit(btn.dataset.id));
                     document.querySelectorAll('.btn-delete-user').forEach(btn => btn.onclick = () => App.pageLogic.users_delete(btn.dataset.id));
                 }
                 // Keep other bindings? A bit risky overriding global. 
                 // Better pattern: App.bindResourceEvents calls specific methods if they exist.
                 // Start of file change: updated bindResourceEvents to check.
             };
        },
        
        clients: () => {
             App.pagination['clients'] = null;
             
             const renderClientRow = (c, index) => `
                <tr>
                    <td data-label="ID">${index}</td>
                    <td data-label="Name">${c.name}</td>
                    <td data-label="Parent">${c.parent_client_name || '-'}</td>
                    <td data-label="Status">${c.status}</td>
                    <td data-label="Actions">
                        ${App.hasPermission('clients', 'edit') ? `<button class="btn btn-sm btn-secondary edit-client-btn" data-id="${c.id}">Edit</button>` : ''}
                        ${App.hasPermission('clients', 'delete') ? `<button class="btn btn-sm btn-danger delete-client-btn" data-id="${c.id}">Delete</button>` : ''}
                    </td>
                </tr>
             `;
             
             const loadClients = () => App.loadPaginated('clients', '/clients', 'clientTableBody', renderClientRow);
             loadClients();
             App.setupInfiniteScroll('clients', loadClients);
             App.setupResourceEvents('clients', 'clientTableBody');
             
             // Initial load for dropdowns (async background)
             (async () => {
                 try {
                     const clients = await api.get('/clients?limit=1000'); // Fetch all for dropdown
                     const opts = '<option value="">None</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                     const select = document.getElementById('parentClientSelect');
                     if(select) select.innerHTML = opts;
                 } catch(e) {}
             })();

             // Helpers
             App.pageLogic.clients_edit = (id) => {
                  const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
                  const form = document.getElementById('createClientForm');
                  form.name.value = row.querySelector('[data-label="Name"]').innerText;
                  // For parent ID, we might need to find it from the name or fetched data.
                  // Ideally the row button or data carries more info, or we re-fetch.
                  // Simple approach: Fetch single client details.
                  api.get(`/clients?id=${id}`).then(res => {
                      const client = (res.data && res.data.length > 0) ? res.data[0] : null;
                      if(client) form.parent_client_id.value = client.parent_client_id || '';
                  });
                  
                  form.dataset.id = id;
                  form.dataset.mode = 'edit';
                  document.querySelector('#createClientForm button[type="submit"]').innerText = 'Update';
                  document.getElementById('clientFormContainer').classList.remove('hidden');
             };
             
             App.pageLogic.clients_delete = async (id) => {
                 if(await App.confirm('Delete client?', 'Delete Client')) {
                     try {
                         await api.delete(`/clients/${id}`);
                         App.notify('Client deleted', 'success');
                         App.pagination['clients'] = null;
                         loadClients();
                     } catch(e) { App.notify(e.message, 'error'); }
                 }
             };
             
             // Bind Events override for this page
             App.bindResourceEvents = (res) => {
                 if (res === 'clients') {
                     document.querySelectorAll('.edit-client-btn').forEach(btn => btn.onclick = () => App.pageLogic.clients_edit(btn.dataset.id));
                     document.querySelectorAll('.delete-client-btn').forEach(btn => btn.onclick = () => App.pageLogic.clients_delete(btn.dataset.id));
                 }
             };

             const addBtn = document.getElementById('addClientBtn');
             if(addBtn) {
                 addBtn.onclick = async () => {
                     document.getElementById('createClientForm').reset();
                     delete document.getElementById('createClientForm').dataset.id;
                     document.getElementById('createClientForm').dataset.mode = 'create';
                     document.querySelector('#createClientForm button[type="submit"]').innerText = 'Save';
                     document.getElementById('clientFormContainer').classList.remove('hidden');
                     
                     // Super Admin Logic
                     if (App.user && App.user.role === 'super_admin') {
                         const orgGroup = document.getElementById('clientOrgGroup');
                         if (!orgGroup) {
                             const div = document.createElement('div');
                             div.className = 'form-group';
                             div.id = 'clientOrgGroup';
                             div.innerHTML = '<label>Organization</label><select name="org_id" id="clientOrgSelect" required><option value="">Loading...</option></select>';
                             const formGroup = document.querySelector('#createClientForm .form-group');
                             if (formGroup) formGroup.before(div);
                             
                             try {
                                 const orgs = await api.get('/orgs');
                                 document.getElementById('clientOrgSelect').innerHTML = '<option value="">Select Organization</option>' + orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
                             } catch (e) {
                                 document.getElementById('clientOrgSelect').innerHTML = '<option value="">Error loading orgs</option>';
                             }
                         }
                     }
                 };
             }

             document.getElementById('createClientForm').onsubmit = async (e) => {
                 e.preventDefault();
                 const data = Object.fromEntries(new FormData(e.target));
                 const id = e.target.dataset.id;
                 const mode = e.target.dataset.mode;
                 try {
                     if(mode === 'edit' && id) {
                         await api.put(`/clients/${id}`, data);
                         App.notify('Client updated', 'success');
                     } else {
                         await api.post('/clients', data);
                         App.notify('Client created', 'success');
                     }
                     
                     document.getElementById('clientFormContainer').classList.add('hidden');
                     App.pagination['clients'] = null;
                     loadClients();
                 } catch(err) { App.notify(err.message, 'error'); }
             };
        },
        
        sites: async () => {
            // Reset Pagination on view init? Or keep state? 
            // Better to keep state unless explicit refresh. But usually init resets.
            App.pagination['sites'] = null;
            let sitesData = []; // Keep track for editing matching

            // Fetch Clients for dropdowns (once)
            (async () => {
                try {
                    const clients = await api.get('/clients?limit=1000');
                    const options = '<option value="">All Clients</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    const formOptions = '<option value="">Select Client</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    
                    const filter = document.getElementById('siteFilterClient');
                    if(filter) filter.innerHTML = options;
                    
                    const formSelect = document.getElementById('siteClientSelect');
                    if(formSelect) formSelect.innerHTML = formOptions;
                } catch(e) {}
            })();

             const renderSiteCard = (s, index) => {
                // Push to local cache for edit lookup
                sitesData.push(s); 
                
                const estCost = parseFloat(s.estimated_cost || 0);
                const income = parseFloat(s.total_income || 0);
                const expense = parseFloat(s.total_expense || 0);
                
                // Budget Metrics
                let percentUsed = 0;
                if (estCost > 0) percentUsed = (expense / estCost) * 100;
                
                const barWidth = Math.min(percentUsed, 100);
                const barColor = percentUsed > 100 ? 'bg-red-500' : 'bg-blue-600';
                const remainingBudget = estCost - expense;

                return `
                    <div class="bg-white border rounded shadow p-4 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h4 class="font-bold text-lg">#${index} ${s.name}</h4>
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
                            </div>
                            
                            <div class="flex space-x-2 mt-auto">
                                ${App.hasPermission('sites', 'edit') ? `<button class="btn btn-sm btn-secondary w-full edit-site-btn" data-id="${s.id}">Edit</button>` : ''}
                                ${App.hasPermission('sites', 'delete') ? `<button class="btn btn-sm btn-danger w-full delete-site-btn" data-id="${s.id}">Delete</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            };

            const loadSites = (reset = false) => {
                if (reset) {
                    App.pagination['sites'] = null;
                    sitesData = [];
                    document.getElementById('sitesGrid').innerHTML = '';
                }
                
                const search = document.getElementById('siteSearch').value;
                const clientId = document.getElementById('siteFilterClient').value;
                const status = document.getElementById('siteFilterStatus').value;
                
                const params = {};
                if(search) params.search = search;
                if(clientId) params.client_id = clientId;
                if(status) params.status = status;
                
                App.loadPaginated('sites', '/sites', 'sitesGrid', renderSiteCard, params);
            };
            
            // Initial call
            loadSites(true);
            App.setupInfiniteScroll('sites', () => loadSites(false));
            App.setupResourceEvents('sites', 'sitesGrid');

            // Filtering
            document.getElementById('siteSearch').oninput = () => loadSites(true); // Debounce ideally
            document.getElementById('siteFilterClient').onchange = () => loadSites(true);
            document.getElementById('siteFilterStatus').onchange = () => loadSites(true);

            // Helpers
            App.pageLogic.sites_edit = (id) => {
                const site = sitesData.find(s => s.id == id); // Lookup in local cache
                if(!site) return; 
                
                const form = document.getElementById('createSiteForm');
                form.name.value = site.name;
                form.location.value = site.location || '';
                form.client_id.value = site.client_id || '';
                form.status.value = site.status;
                form.estimated_cost.value = site.estimated_cost || 0;
                
                document.getElementById('siteId').value = id;
                form.dataset.mode = 'edit';
                document.getElementById('siteFormTitle').innerText = 'Edit Site';
                document.getElementById('siteSubmitBtn').innerText = 'Update';
                document.getElementById('siteFormContainer').classList.remove('hidden');
            };
            
            App.pageLogic.sites_delete = async (id) => {
                if(await App.confirm('Delete site?', 'Delete Site')) {
                    try {
                        await api.delete(`/sites/${id}`);
                        App.notify('Site deleted', 'success');
                        loadSites(true);
                    } catch(e) { App.notify(e.message, 'error'); }
                }
            };
            
            // Bind Events override
            App.bindResourceEvents = (res) => {
                 if (res === 'sites') {
                     document.querySelectorAll('.edit-site-btn').forEach(btn => btn.onclick = () => App.pageLogic.sites_edit(btn.dataset.id));
                     document.querySelectorAll('.delete-site-btn').forEach(btn => btn.onclick = () => App.pageLogic.sites_delete(btn.dataset.id));
                 }
            };

            document.getElementById('addSiteBtn').onclick = () => {
                const form = document.getElementById('createSiteForm');
                form.reset();
                form.dataset.mode = 'create';
                delete document.getElementById('siteId').value;
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
                        App.notify('Site updated', 'success');
                    } else {
                        await api.post('/sites', data);
                        App.notify('Site created', 'success');
                    }
                    e.target.reset();
                    document.getElementById('siteFormContainer').classList.add('hidden');
                    loadSites(true);
                } catch (err) { App.notify(err.message, 'error'); }
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
                                                        ${App.hasPermission('categories', 'delete') ? `<button class="text-xs text-red-600 delete-field-btn" data-id="${f.id}">Delete</button>` : ''}
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
                            if(await App.confirm('Delete this field?', 'Delete Field')) {
                                try {
                                    await api.delete(`/fields/${btn.dataset.id}`);
                                    App.notify('Field deleted', 'success');
                                    loadCategories();
                                } catch(e) { App.notify(e.message, 'error'); }
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
                             if(await App.confirm('Are you sure you want to delete this category?', 'Delete Category')) {
                                 try {
                                     await api.delete(`/categories/${btn.dataset.id}`);
                                     App.notify('Category deleted', 'success');
                                     loadCategories();
                                 } catch(e) { App.notify(e.message, 'error'); }
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
                        App.notify('Category updated', 'success');
                    } else {
                        await api.post('/categories', data);
                        App.notify('Category created', 'success');
                    }
                    e.target.reset();
                    document.getElementById('categoryFormContainer').classList.add('hidden');
                    loadCategories();
                } catch (err) { App.notify(err.message, 'error'); }
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
                        App.notify('Field updated', 'success');
                    } else {
                        await api.post(`/categories/${catId}/fields`, data);
                        App.notify('Field added', 'success');
                    }
                    e.target.reset();
                    document.getElementById('fieldModal').classList.add('hidden');
                    loadCategories();
                } catch (err) { App.notify(err.message, 'error'); }
            };
        },

        income: () => App.initTxLogic('income'),
        expenses: () => App.initTxLogic('expense')
    },
    
    renderTxTemplate: (mode) => `
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h3>${mode === 'income' ? 'Income' : 'Expenses'} <span id="transactionsTotalCount" class="text-sm text-gray-500 font-normal ml-2"></span></h3>
                    ${App.hasPermission('transactions', 'create') ? `<button class="btn btn-primary" id="addTxBtn">Add ${mode === 'income' ? 'Income' : 'Expense'}</button>` : ''}
                </div>
                
                <div class="flex space-x-2 mb-4 bg-gray-50 p-3 rounded">
                    <input type="date" id="filterStart" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                    <input type="date" id="filterEnd" class="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                    <button id="applyFiltersBtn" class="btn btn-secondary">Filter</button>
                </div>
                
                <div id="txFormContainer" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 flex">
                    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg overflow-y-auto max-h-[90vh]">
                        <h4 class="text-xl font-bold mb-4">New Transaction</h4>
                        <form id="createTxForm">
                            <input type="hidden" name="type" value="${mode}">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label>Date</label>
                                    <input type="date" name="date" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                                <div class="form-group">
                                    <label>Amount (₹)</label>
                                    <input type="number" name="amount" step="0.01" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4 mt-2">
                                 <div class="form-group">
                                    <label>Category</label>
                                    <select name="category_id" id="txCategorySelect" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option>Loading...</option></select>
                                </div>
                                <div class="form-group">
                                    <label>Client</label>
                                    <select name="client_id" id="txClientSelect" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option>Loading...</option></select>
                                </div>
                            </div>
                            
                            <div class="form-group mt-2">
                                <label>Site</label>
                                <select name="site_id" id="txSiteSelect" required class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors"><option value="">Select Client First</option></select>
                            </div>

                             <div class="form-group mt-2">
                                <label>Description</label>
                                <input type="text" name="description" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors">
                            </div>

                            <div id="txCustomFields" class="mt-2 hidden border-t pt-2"></div>
                            
                            <div class="flex justify-end space-x-4 mt-4">
                                <button type="button" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors" onclick="document.getElementById('txFormContainer').classList.add('hidden')">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Save</button>
                            </div>
                        </form>
                    </div>
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
    // Shared Logic
    initTxLogic: (mode) => {
            App.pagination['transactions'] = null; // We might want unique keys for income/expense if they were on same page, but they are different routes/views.
                                                   // However, 'transactions' key in pagination object works if we reset it on init.
            
            const renderTxRow = (t) => `
                <tr>
                    <td data-label="Date">${Formatters.date(t.transaction_date)}</td>
                    <td data-label="Category">${t.category_name}</td>
                    <td data-label="Description">
                        ${t.description || ''}
                        ${t.custom_data ? '<br><small class="text-gray-500">' + Object.entries(JSON.parse(t.custom_data || '{}')).map(([k,v]) => `${k}: ${v}`).join(', ') + '</small>' : ''}
                    </td>
                    <td data-label="Amount" class="font-bold ${t.transaction_type === 'income' ? 'text-success' : 'text-danger'}">
                        ${t.transaction_type === 'income' ? '+' : '-'} ${Formatters.amount(t.amount)}
                    </td>
                    <td data-label="Reference">
                        ${t.client_name ? `Client: ${t.client_name}` : ''}
                        ${t.site_name ? `<br>Site: ${t.site_name}` : ''}
                        ${t.org_name ? `<br><small class="text-xs text-gray-400">${t.org_name}</small>` : ''}
                    </td>
                    <td data-label="Actions">
                        ${App.hasPermission('transactions', 'edit') ? `<button class="btn btn-sm btn-secondary edit-transaction-btn" data-id="${t.id}">Edit</button>` : ''}
                        ${App.hasPermission('transactions', 'delete') ? `<button class="btn btn-sm btn-danger delete-transaction-btn" data-id="${t.id}">Delete</button>` : ''}
                    </td>
                </tr>
            `;
            
            const loadTx = () => {
                const start = document.getElementById('filterStart').value;
                const end = document.getElementById('filterEnd').value;
                
                const params = { type: mode };
                if (start) params.start_date = start;
                if (end) params.end_date = end;
                
                App.loadPaginated('transactions', '/transactions', 'txTableBody', renderTxRow, params);
            };
            
            // Initial
            loadTx();
            App.setupInfiniteScroll('transactions', loadTx);
            App.setupResourceEvents('transactions', 'txTableBody');
            
            // Filters
            document.getElementById('applyFiltersBtn').onclick = () => {
                App.pagination['transactions'] = null;
                document.getElementById('txTableBody').innerHTML = ''; // Clear explicitly if loadPaginated doesn't on reset (it does if state is cleared)
                loadTx();
            };
            
            // Edit Helper
            App.pageLogic.transactions_edit = async (id) => {
                 // Fetch single TX details because we need custom fields etc which might not be in the row fully
                 // But wait, we show custom data in row.
                 // We need to population form options first.
                 
                 // Trigger "Add" to show form and load dropdowns
                 const addBtn = document.getElementById('addTxBtn');
                 if(addBtn) await addBtn.click(); // This loads dropdowns if empty
                 
                 // Fetch full details
                 try {
                     const txs = await api.get('/transactions?limit=1&id=' + id); // We don't have id filter? We can fetch all or just one.
                     // The backend supports filtering by ID? No? 
                     // Let's assume we can fetch by ID or get from list if we cached it.
                     // Let's rely on cached data if we implement it, or just fetch all? No...
                     // Let's add simple GET /transactions/:id support in backend later or use what we have.
                     // Current backend: TransactionController index supports filters.
                     // Let's try to find in DOM first? No.
                     
                     // Helper: fetch single tx
                     // Let's filter by id in query?
                     // `api.get('/transactions?id=' + id)` ? The controller doesn't seem to support id filter in index?
                     // Controller supports: type, client_id, site_id, start_date, end_date.
                     // We might need to add `id` support to Controller or fetch paginated data until we find it?
                     // Or just implement `show`.
                     // For now, let's just populate what we can from the row or fetch a reasonable amount.
                     // Actually, I can add `id` param to TransactionController easily.
                     
                     // Let's assume we implement fetching single tx or filtered by id.
                     // For now, let's iterate `App.pagination['transactions'].data`? `loadPaginated` doesn't expose data publicly easily yet unless we pushed it.
                     // Let's modify logic to fetch single if needed.
                     
                     const res = await api.get(`/transactions?id=${id}`);
                     const tx = (res.data && res.data.length > 0) ? res.data[0] : null;

                     if(!tx) {
                         App.notify('Transaction not found', 'error');
                         return;
                     }

                     const form = document.getElementById('createTxForm');
                     document.querySelector('#txFormContainer h4').innerText = 'Edit ' + (mode === 'income' ? 'Income' : 'Expense');
                     form.dataset.mode = 'edit';
                     form.dataset.id = id;
                     
                     form.date.value = tx.transaction_date;
                     form.amount.value = tx.amount;
                     form.category_id.value = tx.category_id;
                     form.description.value = tx.description || '';
                     
                     // Trigger changes
                     form.category_id.dispatchEvent(new Event('change'));
                     
                     // Client/Site
                     if(tx.client_id) {
                         form.client_id.value = tx.client_id;
                         form.client_id.dispatchEvent(new Event('change'));
                         setTimeout(() => { if(tx.site_id) form.site_id.value = tx.site_id; }, 100);
                     }
                     
                     // Custom Fields
                     if(tx.custom_data) {
                         setTimeout(() => {
                             try {
                                 const custom = JSON.parse(tx.custom_data);
                                 for(const [k,v] of Object.entries(custom)) {
                                     const input = document.getElementsByName(`custom_fields[${k}]`)[0];
                                     if(input) input.value = v;
                                 }
                             } catch(e){}
                         }, 100);
                     }
                 } catch(e) { console.error(e); }
            };
            
            App.pageLogic.transactions_delete = async (id) => {
                if(await App.confirm('Delete transaction?', 'Delete Transaction')) {
                    try {
                        await api.delete(`/transactions/${id}`);
                        App.notify('Transaction deleted', 'success');
                        App.pagination['transactions'] = null;
                        document.getElementById('txTableBody').innerHTML = '';
                        loadTx();
                    } catch(e) { App.notify(e.message, 'error'); }
                }
            };
            
            App.bindResourceEvents = (res) => {
                 if (res === 'transactions') {
                     document.querySelectorAll('.edit-transaction-btn').forEach(btn => btn.onclick = () => App.pageLogic.transactions_edit(btn.dataset.id));
                     document.querySelectorAll('.delete-transaction-btn').forEach(btn => btn.onclick = () => App.pageLogic.transactions_delete(btn.dataset.id));
                 }
            };
            
            // New Tx Form Logic ... (Keep existing form logic mostly, just ensure it refreshes list)
             const formContainer = document.getElementById('txFormContainer');
             let sitesData = [];
             
             const addTxBtn = document.getElementById('addTxBtn');
             if (addTxBtn) {
                 addTxBtn.onclick = async () => {
                     formContainer.classList.remove('hidden');
                     const form = document.getElementById('createTxForm');
                     form.reset();
                     form.date.value = new Date().toISOString().split('T')[0];
                     form.dataset.mode = 'create';
                     delete form.dataset.id;
                     document.getElementById('txCustomFields').innerHTML = '';
                     document.getElementById('txCustomFields').classList.add('hidden');
                     document.querySelector('#txFormContainer h4').innerText = 'New ' + (mode === 'income' ? 'Income' : 'Expense');
     
                     try {
                         // Check if loaded?
                         if(document.getElementById('txCategorySelect').options.length <= 1) {
                              const [cats, clientsRes, sitesRes] = await Promise.all([
                                  api.get('/categories'),
                                  api.get('/clients?limit=1000'),
                                  api.get('/sites?limit=1000')
                              ]);
                              const clients = clientsRes.data || [];
                              const sites = sitesRes.data || [];
                              sitesData = sites;
                             
                             const filteredCats = cats.filter(c => c.type === mode || c.type === null);
                             document.getElementById('txCategorySelect').innerHTML = '<option value="">Select Category</option>' + filteredCats.map(c => `<option value="${c.id}" data-type="${c.type}" data-fields='${JSON.stringify(c.fields || [])}'>${c.name}</option>`).join('');
                             document.getElementById('txClientSelect').innerHTML = '<option value="">None</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                             document.getElementById('txSiteSelect').innerHTML = '<option value="">Select Client First</option>'; 
                         }
                     } catch (e) { App.notify('Failed to load form data: ' + e.message, 'error'); }
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
                              input = `<select name="custom_fields[${f.field_slug}]" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors" ${f.is_required ? 'required' : ''}>
                                         <option value="">Select ${f.field_name}</option>
                                         ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
                                       </select>`;
                          } else if (f.field_type === 'textarea') {
                              input = `<textarea name="custom_fields[${f.field_slug}]" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors" ${f.is_required ? 'required' : ''}></textarea>`;
                          } else {
                              input = `<input type="${f.field_type}" name="custom_fields[${f.field_slug}]" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors" ${f.is_required ? 'required' : ''}>`;
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
                          data[key] = val === '' ? null : val;
                      }
                  }
                 
                 try {
                     const form = e.target;
                     const mode = form.dataset.mode;
                     if (mode === 'edit') {
                          await api.put(`/transactions/${form.dataset.id}`, data);
                          App.notify('Transaction updated', 'success');
                     } else {
                          await api.post('/transactions', data);
                          App.notify('Transaction created', 'success');
                     }
                     
                     form.reset();
                     document.getElementById('txCustomFields').innerHTML = '';
                     document.getElementById('txCustomFields').classList.add('hidden');
                     formContainer.classList.add('hidden');
                     
                     App.pagination['transactions'] = null;
                     document.getElementById('txTableBody').innerHTML = '';
                     loadTx();
                 } catch (err) { App.notify(err.message, 'error'); }
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
                App.notify('Login failed: ' + err.message, 'error');
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
