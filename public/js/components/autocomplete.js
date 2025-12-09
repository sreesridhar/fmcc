
export class Autocomplete {
    constructor(selectElement) {
        if (typeof selectElement === 'string') {
            selectElement = document.querySelector(selectElement);
        }
        if (!selectElement) return;

        this.select = selectElement;
        this.options = Array.from(this.select.options).map(opt => ({
            label: opt.text,
            value: opt.value
        }));
        
        // Skip if already initialized or empty
        if (this.select.dataset.autocompleteInit) return;
        
        this.init();
    }

    init() {
        this.select.dataset.autocompleteInit = "true";
        this.select.style.display = 'none'; // Hide original select

        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'relative w-full';
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        this.wrapper.appendChild(this.select);

        // Input
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = this.select.className; // Copy classes
        // Ensure standard styling is enforced if original didn't have it, but usually it does
        if(!this.input.className.includes('border')) {
             this.input.className += ' w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors pr-10'; // Added pr-10 for icon space
        } else {
             this.input.className += ' pr-10';
        }
        this.input.placeholder = "Select option...";
        
        // Clear Button
        this.clearBtn = document.createElement('button');
        this.clearBtn.innerHTML = '&times;';
        this.clearBtn.className = 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xl leading-none z-10 hidden';
        this.clearBtn.type = 'button';
        this.wrapper.appendChild(this.clearBtn);
        
        this.clearBtn.onclick = (e) => {
            e.stopPropagation();
            this.selectOption('', '');
            this.input.focus();
        };

        // Set initial value if selected
        const selected = this.options.find(o => o.value === this.select.value) || this.options[0];
        if (selected && selected.value) { 
             if(selected.value !== "") {
                 this.input.value = selected.label;
                 this.clearBtn.classList.remove('hidden');
             }
        }

        this.wrapper.appendChild(this.input);

        // Suggestions List
        this.list = document.createElement('ul');
        this.list.className = 'absolute z-50 w-full bg-white border border-gray-300 mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto hidden';
        this.wrapper.appendChild(this.list);

        // Events
        this.input.addEventListener('input', () => {
             this.filterOptions();
             if(this.input.value) this.clearBtn.classList.remove('hidden'); 
             else this.clearBtn.classList.add('hidden');
        });
        this.input.addEventListener('focus', () => {
            this.filterOptions();
            this.list.classList.remove('hidden');
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.list.classList.add('hidden');
                // Validate selection on blur
                this.validateSelection();
            }
        });

        // Handle item selection
        this.list.addEventListener('click', (e) => {
            const item = e.target.closest('li');
            if (item) {
                this.selectOption(item.dataset.value, item.innerText);
            }
        });
    }

    filterOptions() {
        const query = this.input.value.toLowerCase();
        const matches = this.options.filter(opt => opt.label.toLowerCase().includes(query));
        
        this.list.innerHTML = '';
        if (matches.length === 0) {
            const li = document.createElement('li');
            li.className = 'p-3 text-gray-500 text-sm italic';
            li.innerText = 'No matches found';
            this.list.appendChild(li);
        } else {
            matches.forEach(opt => {
                const li = document.createElement('li');
                li.className = 'p-3 hover:bg-blue-50 cursor-pointer text-sm text-gray-700';
                li.dataset.value = opt.value;
                li.innerText = opt.label;
                this.list.appendChild(li);
            });
        }
        this.list.classList.remove('hidden');
    }

    selectOption(value, label) {
        this.input.value = label;
        this.select.value = value;
        this.list.classList.add('hidden');
        
        if(label) this.clearBtn.classList.remove('hidden');
        else this.clearBtn.classList.add('hidden');
        
        // Trigger change event on original select
        this.select.dispatchEvent(new Event('change'));
    }

    validateSelection() {
        // If input value matches a label exactly, keep it.
        // If empty, reset to first option (usually "All...").
        // Otherwise revert to current select value's label.
        
        const currentLabel = this.input.value;
        const match = this.options.find(o => o.label.toLowerCase() === currentLabel.toLowerCase());
        
        if (match) {
            if(this.select.value !== match.value) {
                this.selectOption(match.value, match.label);
            }
        } else if (currentLabel === '') {
             // Reset
             this.selectOption(this.options[0].value, ""); // Usually empty value
             this.input.value = "";
             this.clearBtn.classList.add('hidden');
        } else {
             // Revert
             const selected = this.options.find(o => o.value === this.select.value);
             this.input.value = selected && selected.value ? selected.label : "";
             if(this.input.value) this.clearBtn.classList.remove('hidden');
             else this.clearBtn.classList.add('hidden');
        }
    }
    
    // Method to re-sync options (e.g. when select innerHTML changes)
    update() {
         // Remove old processing
         // Simplest way: remove wrapper, show select, then re-init?
         // Or just update options and clear input.
         
         // 1. Update options
         this.options = Array.from(this.select.options).map(opt => ({
            label: opt.text,
            value: opt.value
        }));
        
        // 2. Clear input or update based on new selection
        const selected = this.options.find(o => o.value === this.select.value);
        this.input.value = selected && selected.value ? selected.label : "";
    }
}
