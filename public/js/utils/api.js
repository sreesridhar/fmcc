export const api = {
    async request(url, method, data = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        const options = {
            method,
            headers
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const res = await fetch(`/api/v1${url}`, options);
        
        if (res.status === 401 && !url.includes('/login')) {
            // Redirect to login if needed? Or let App handle it
            // For now, let caller handle
        }
        
        const json = await res.json();
        
        if (!res.ok) {
            throw new Error(json.error || 'Request failed');
        }
        
        return json;
    },
    
    get(url) {
        return this.request(url, 'GET');
    },
    
    post(url, data) {
        return this.request(url, 'POST', data);
    },
    
    put(url, data) {
        return this.request(url, 'PUT', data);
    },
    
    delete(url) {
        return this.request(url, 'DELETE');
    }
};
