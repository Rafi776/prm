// =====================================================
// COMPONENT SYSTEM
// Reusable UI components with consistent API
// =====================================================

import config from './config.js';
import errorHandler from './error-handler.js';

class ComponentSystem {
    constructor() {
        this.config = config;
        this.errorHandler = errorHandler;
        this.logger = window.logger;
        this.components = new Map();
        this.eventListeners = new Map();
        
        this.initializeComponents();
    }

    initializeComponents() {
        // Register built-in components
        this.registerComponent('Button', Button);
        this.registerComponent('Modal', Modal);
        this.registerComponent('Table', Table);
        this.registerComponent('Form', Form);
        this.registerComponent('Card', Card);
        this.registerComponent('Notification', Notification);
        this.registerComponent('LoadingSpinner', LoadingSpinner);
        this.registerComponent('Dropdown', Dropdown);
        this.registerComponent('Tabs', Tabs);
        this.registerComponent('Pagination', Pagination);
    }

    registerComponent(name, componentClass) {
        this.components.set(name, componentClass);
    }

    createComponent(name, props = {}, container = null) {
        const ComponentClass = this.components.get(name);
        if (!ComponentClass) {
            throw new Error(`Component '${name}' not found`);
        }

        const component = new ComponentClass(props);
        
        if (container) {
            component.mount(container);
        }

        return component;
    }

    // Utility function to create elements with classes and attributes
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        return element;
    }
}

// =====================================================
// BASE COMPONENT CLASS
// =====================================================

class BaseComponent {
    constructor(props = {}) {
        this.props = { ...this.defaultProps, ...props };
        this.element = null;
        this.mounted = false;
        this.eventListeners = [];
        this.children = [];
        
        this.validateProps();
        this.createElement();
        this.setupEventListeners();
    }

    get defaultProps() {
        return {};
    }

    validateProps() {
        // Override in subclasses for prop validation
    }

    createElement() {
        // Override in subclasses to create the element
        this.element = document.createElement('div');
    }

    setupEventListeners() {
        // Override in subclasses to setup event listeners
    }

    mount(container) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) {
            throw new Error('Container not found');
        }
        
        container.appendChild(this.element);
        this.mounted = true;
        this.onMount();
        
        return this;
    }

    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.cleanup();
        this.mounted = false;
        this.onUnmount();
        
        return this;
    }

    cleanup() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // Cleanup children
        this.children.forEach(child => {
            if (child.cleanup) child.cleanup();
        });
        this.children = [];
    }

    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }

    updateProps(newProps) {
        this.props = { ...this.props, ...newProps };
        this.update();
    }

    update() {
        // Override in subclasses to handle updates
    }

    onMount() {
        // Override in subclasses
    }

    onUnmount() {
        // Override in subclasses
    }

    // Utility methods
    addClass(className) {
        this.element.classList.add(className);
        return this;
    }

    removeClass(className) {
        this.element.classList.remove(className);
        return this;
    }

    toggleClass(className) {
        this.element.classList.toggle(className);
        return this;
    }

    show() {
        this.element.style.display = '';
        return this;
    }

    hide() {
        this.element.style.display = 'none';
        return this;
    }
}

// =====================================================
// BUTTON COMPONENT
// =====================================================

class Button extends BaseComponent {
    get defaultProps() {
        return {
            variant: 'primary',
            size: 'md',
            disabled: false,
            loading: false,
            type: 'button',
            text: 'Button',
            icon: null,
            onClick: () => {}
        };
    }

    validateProps() {
        const validVariants = ['primary', 'secondary', 'danger', 'success', 'warning', 'info'];
        const validSizes = ['xs', 'sm', 'md', 'lg', 'xl'];
        
        if (!validVariants.includes(this.props.variant)) {
            throw new Error(`Invalid button variant: ${this.props.variant}`);
        }
        
        if (!validSizes.includes(this.props.size)) {
            throw new Error(`Invalid button size: ${this.props.size}`);
        }
    }

    createElement() {
        this.element = document.createElement('button');
        this.element.type = this.props.type;
        this.element.className = this.getButtonClasses();
        this.updateContent();
    }

    getButtonClasses() {
        const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
        
        const variantClasses = {
            primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
            secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
            danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
            success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
            warning: 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500',
            info: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
        };
        
        const sizeClasses = {
            xs: 'px-2 py-1 text-xs',
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
            xl: 'px-8 py-4 text-lg'
        };
        
        return `${baseClasses} ${variantClasses[this.props.variant]} ${sizeClasses[this.props.size]}`;
    }

    updateContent() {
        let content = '';
        
        if (this.props.loading) {
            content = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
            `;
        } else {
            if (this.props.icon) {
                content += `<span class="mr-2">${this.props.icon}</span>`;
            }
            content += this.props.text;
        }
        
        this.element.innerHTML = content;
        this.element.disabled = this.props.disabled || this.props.loading;
    }

    setupEventListeners() {
        this.addEventListener(this.element, 'click', (e) => {
            if (!this.props.disabled && !this.props.loading) {
                this.props.onClick(e);
            }
        });
    }

    update() {
        this.element.className = this.getButtonClasses();
        this.updateContent();
    }

    setLoading(loading) {
        this.updateProps({ loading });
    }

    setDisabled(disabled) {
        this.updateProps({ disabled });
    }
}

// =====================================================
// MODAL COMPONENT
// =====================================================

class Modal extends BaseComponent {
    get defaultProps() {
        return {
            title: 'Modal',
            size: 'md',
            closable: true,
            backdrop: true,
            keyboard: true,
            onClose: () => {},
            onOpen: () => {}
        };
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'fixed inset-0 z-50 hidden flex items-center justify-center p-4';
        
        this.element.innerHTML = `
            <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-md modal-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl modal-content ${this.getSizeClasses()}">
                <div class="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900 modal-title">${this.props.title}</h3>
                    ${this.props.closable ? `
                        <button class="text-gray-400 hover:text-gray-600 modal-close">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div class="p-6 modal-body">
                    <!-- Content will be inserted here -->
                </div>
                <div class="flex justify-end gap-3 p-6 border-t border-gray-200 modal-footer">
                    <!-- Footer buttons will be inserted here -->
                </div>
            </div>
        `;
    }

    getSizeClasses() {
        const sizeClasses = {
            sm: 'w-full max-w-sm',
            md: 'w-full max-w-md',
            lg: 'w-full max-w-lg',
            xl: 'w-full max-w-xl',
            '2xl': 'w-full max-w-2xl',
            '4xl': 'w-full max-w-4xl'
        };
        
        return sizeClasses[this.props.size] || sizeClasses.md;
    }

    setupEventListeners() {
        // Close on backdrop click
        if (this.props.backdrop) {
            const backdrop = this.element.querySelector('.modal-backdrop');
            this.addEventListener(backdrop, 'click', () => this.close());
        }
        
        // Close on close button click
        if (this.props.closable) {
            const closeBtn = this.element.querySelector('.modal-close');
            if (closeBtn) {
                this.addEventListener(closeBtn, 'click', () => this.close());
            }
        }
        
        // Close on escape key
        if (this.props.keyboard) {
            this.addEventListener(document, 'keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }
            });
        }
    }

    open() {
        this.element.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        this.props.onOpen();
        
        // Focus management
        const firstFocusable = this.element.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        return this;
    }

    close() {
        this.element.classList.add('hidden');
        document.body.style.overflow = '';
        this.props.onClose();
        return this;
    }

    isOpen() {
        return !this.element.classList.contains('hidden');
    }

    setTitle(title) {
        const titleElement = this.element.querySelector('.modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
        return this;
    }

    setContent(content) {
        const bodyElement = this.element.querySelector('.modal-body');
        if (bodyElement) {
            if (typeof content === 'string') {
                bodyElement.innerHTML = content;
            } else {
                bodyElement.innerHTML = '';
                bodyElement.appendChild(content);
            }
        }
        return this;
    }

    setFooter(buttons) {
        const footerElement = this.element.querySelector('.modal-footer');
        if (footerElement) {
            footerElement.innerHTML = '';
            buttons.forEach(buttonProps => {
                const button = new Button(buttonProps);
                button.mount(footerElement);
                this.children.push(button);
            });
        }
        return this;
    }
}

// =====================================================
// TABLE COMPONENT
// =====================================================

class Table extends BaseComponent {
    get defaultProps() {
        return {
            data: [],
            columns: [],
            sortable: true,
            filterable: false,
            pagination: false,
            pageSize: 10,
            loading: false,
            emptyMessage: 'No data available',
            onSort: () => {},
            onFilter: () => {},
            onPageChange: () => {}
        };
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'overflow-hidden bg-white border border-gray-200 rounded-lg';
        
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filters = {};
        
        this.render();
    }

    render() {
        const { data, columns, loading, emptyMessage } = this.props;
        
        let content = '';
        
        // Filters
        if (this.props.filterable) {
            content += this.renderFilters();
        }
        
        // Table
        content += `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        ${this.renderHeader()}
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${loading ? this.renderLoading() : 
                          data.length === 0 ? this.renderEmpty() : this.renderRows()}
                    </tbody>
                </table>
            </div>
        `;
        
        // Pagination
        if (this.props.pagination && data.length > 0) {
            content += this.renderPagination();
        }
        
        this.element.innerHTML = content;
        this.setupTableEventListeners();
    }

    renderFilters() {
        const { columns } = this.props;
        const filterableColumns = columns.filter(col => col.filterable);
        
        if (filterableColumns.length === 0) return '';
        
        return `
            <div class="p-4 bg-gray-50 border-b border-gray-200">
                <div class="grid grid-cols-1 md:grid-cols-${Math.min(filterableColumns.length, 4)} gap-4">
                    ${filterableColumns.map(column => `
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                ${column.title}
                            </label>
                            <input type="text" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                   placeholder="Filter ${column.title.toLowerCase()}..."
                                   data-filter="${column.key}">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderHeader() {
        const { columns, sortable } = this.props;
        
        return `
            <tr>
                ${columns.map(column => `
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}"
                        ${sortable && column.sortable !== false ? `data-sort="${column.key}"` : ''}>
                        <div class="flex items-center gap-2">
                            <span>${column.title}</span>
                            ${sortable && column.sortable !== false ? `
                                <span class="sort-indicator">
                                    ${this.sortColumn === column.key ? 
                                        (this.sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                </span>
                            ` : ''}
                        </div>
                    </th>
                `).join('')}
            </tr>
        `;
    }

    renderRows() {
        const { data, columns } = this.props;
        const paginatedData = this.getPaginatedData(data);
        
        return paginatedData.map(row => `
            <tr class="hover:bg-gray-50">
                ${columns.map(column => `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${this.renderCell(row, column)}
                    </td>
                `).join('')}
            </tr>
        `).join('');
    }

    renderCell(row, column) {
        const value = this.getCellValue(row, column.key);
        
        if (column.render) {
            return column.render(value, row);
        }
        
        if (column.type === 'date') {
            return new Date(value).toLocaleDateString();
        }
        
        if (column.type === 'currency') {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(value);
        }
        
        return value || '-';
    }

    renderLoading() {
        const { columns } = this.props;
        
        return `
            <tr>
                <td colspan="${columns.length}" class="px-6 py-12 text-center">
                    <div class="flex items-center justify-center">
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span class="text-gray-500">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    renderEmpty() {
        const { columns, emptyMessage } = this.props;
        
        return `
            <tr>
                <td colspan="${columns.length}" class="px-6 py-12 text-center text-gray-500">
                    ${emptyMessage}
                </td>
            </tr>
        `;
    }

    renderPagination() {
        const { data, pageSize } = this.props;
        const totalPages = Math.ceil(data.length / pageSize);
        
        if (totalPages <= 1) return '';
        
        return `
            <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div class="text-sm text-gray-700">
                    Showing ${(this.currentPage - 1) * pageSize + 1} to ${Math.min(this.currentPage * pageSize, data.length)} of ${data.length} results
                </div>
                <div class="flex gap-2">
                    <button class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                            data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>
                        Previous
                    </button>
                    ${Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
                        <button class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 ${page === this.currentPage ? 'bg-blue-600 text-white border-blue-600' : ''}"
                                data-page="${page}">
                            ${page}
                        </button>
                    `).join('')}
                    <button class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 ${this.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                            data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
                        Next
                    </button>
                </div>
            </div>
        `;
    }

    setupTableEventListeners() {
        // Sort listeners
        const sortHeaders = this.element.querySelectorAll('[data-sort]');
        sortHeaders.forEach(header => {
            this.addEventListener(header, 'click', () => {
                const column = header.dataset.sort;
                this.handleSort(column);
            });
        });
        
        // Filter listeners
        const filterInputs = this.element.querySelectorAll('[data-filter]');
        filterInputs.forEach(input => {
            this.addEventListener(input, 'input', (e) => {
                const column = e.target.dataset.filter;
                const value = e.target.value;
                this.handleFilter(column, value);
            });
        });
        
        // Pagination listeners
        const pageButtons = this.element.querySelectorAll('[data-page]');
        pageButtons.forEach(button => {
            this.addEventListener(button, 'click', () => {
                const page = parseInt(button.dataset.page);
                this.handlePageChange(page);
            });
        });
    }

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.props.onSort(column, this.sortDirection);
        this.render();
    }

    handleFilter(column, value) {
        this.filters[column] = value;
        this.currentPage = 1; // Reset to first page
        this.props.onFilter(this.filters);
        this.render();
    }

    handlePageChange(page) {
        this.currentPage = page;
        this.props.onPageChange(page);
        this.render();
    }

    getCellValue(row, key) {
        return key.split('.').reduce((obj, k) => obj?.[k], row);
    }

    getPaginatedData(data) {
        if (!this.props.pagination) return data;
        
        const { pageSize } = this.props;
        const start = (this.currentPage - 1) * pageSize;
        const end = start + pageSize;
        
        return data.slice(start, end);
    }

    update() {
        this.render();
    }

    setData(data) {
        this.updateProps({ data });
    }

    setLoading(loading) {
        this.updateProps({ loading });
    }
}

// =====================================================
// NOTIFICATION COMPONENT
// =====================================================

class Notification extends BaseComponent {
    get defaultProps() {
        return {
            type: 'info',
            title: '',
            message: '',
            duration: 5000,
            closable: true,
            onClose: () => {}
        };
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = `fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border p-4 transform transition-all duration-300 ${this.getTypeClasses()}`;
        
        this.element.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                    ${this.getIcon()}
                </div>
                <div class="flex-1 min-w-0">
                    ${this.props.title ? `<p class="text-sm font-medium text-gray-900">${this.props.title}</p>` : ''}
                    <p class="text-sm text-gray-600">${this.props.message}</p>
                </div>
                ${this.props.closable ? `
                    <button class="flex-shrink-0 text-gray-400 hover:text-gray-600 notification-close">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
    }

    getTypeClasses() {
        const typeClasses = {
            success: 'border-green-200 bg-green-50',
            error: 'border-red-200 bg-red-50',
            warning: 'border-yellow-200 bg-yellow-50',
            info: 'border-blue-200 bg-blue-50'
        };
        
        return typeClasses[this.props.type] || typeClasses.info;
    }

    getIcon() {
        const icons = {
            success: '<svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
            error: '<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            warning: '<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            info: '<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
        };
        
        return icons[this.props.type] || icons.info;
    }

    setupEventListeners() {
        if (this.props.closable) {
            const closeBtn = this.element.querySelector('.notification-close');
            if (closeBtn) {
                this.addEventListener(closeBtn, 'click', () => this.close());
            }
        }
        
        if (this.props.duration > 0) {
            this.autoCloseTimer = setTimeout(() => {
                this.close();
            }, this.props.duration);
        }
    }

    close() {
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
        
        this.element.style.transform = 'translateX(100%)';
        this.element.style.opacity = '0';
        
        setTimeout(() => {
            this.unmount();
            this.props.onClose();
        }, 300);
    }

    onMount() {
        // Animate in
        requestAnimationFrame(() => {
            this.element.style.transform = 'translateX(0)';
            this.element.style.opacity = '1';
        });
    }
}

// =====================================================
// LOADING SPINNER COMPONENT
// =====================================================

class LoadingSpinner extends BaseComponent {
    get defaultProps() {
        return {
            size: 'md',
            color: 'blue',
            text: ''
        };
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'flex items-center justify-center';
        
        const sizeClasses = {
            sm: 'w-4 h-4',
            md: 'w-6 h-6',
            lg: 'w-8 h-8',
            xl: 'w-12 h-12'
        };
        
        const colorClasses = {
            blue: 'text-blue-600',
            gray: 'text-gray-600',
            green: 'text-green-600',
            red: 'text-red-600'
        };
        
        const spinnerSize = sizeClasses[this.props.size] || sizeClasses.md;
        const spinnerColor = colorClasses[this.props.color] || colorClasses.blue;
        
        this.element.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="animate-spin ${spinnerSize} ${spinnerColor}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ${this.props.text ? `<span class="text-gray-600">${this.props.text}</span>` : ''}
            </div>
        `;
    }
}

// Create global component system
const componentSystem = new ComponentSystem();

// Export components
window.componentSystem = componentSystem;
window.Button = Button;
window.Modal = Modal;
window.Table = Table;
window.Notification = Notification;
window.LoadingSpinner = LoadingSpinner;

export { 
    ComponentSystem, 
    BaseComponent, 
    Button, 
    Modal, 
    Table, 
    Notification, 
    LoadingSpinner 
};

export default componentSystem;