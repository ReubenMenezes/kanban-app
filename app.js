// ═══════════════════════════════════════════════════════════════════════════════
// KANBAN BOARD APPLICATION - Premium Edition with Multi-Project Support
// ═══════════════════════════════════════════════════════════════════════════════

class KanbanBoard {
    constructor() {
        this.data = {
            projects: [],
            activeProjectId: null,
            sidebarCollapsed: false,
            lastModified: new Date().toISOString()
        };
        this.currentCardId = null;
        this.currentColumnId = null;
        this.editingCard = null;
        this.editingColumn = null;
        this.editingProject = null;

        this.init();
    }

    init() {
        this.loadFromLocalStorage();
        this.bindEvents();
        this.renderProjectList();
        this.render();
        this.updateSidebarState();
        this.initLucideIcons();
    }

    // Initialize Lucide icons
    initLucideIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Generate unique ID with prefix
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Generate card number for display (KB-XXX format)
    generateCardNumber(project) {
        project.cardCounter = (project.cardCounter || 0) + 1;
        return `KB-${String(project.cardCounter).padStart(3, '0')}`;
    }

    // Get active project
    getActiveProject() {
        const project = this.data.projects.find(p => p.id === this.data.activeProjectId);
        if (project) {
            // Ensure project has latest schema
            return this.migrateProject(project);
        }
        return project;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Local Storage Operations
    // ─────────────────────────────────────────────────────────────────────────────

    saveToLocalStorage() {
        this.data.lastModified = new Date().toISOString();
        localStorage.setItem('kanbanData', JSON.stringify(this.data));
        this.showToast('Changes saved', 'success');
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('kanbanData');
        if (saved) {
            const parsed = JSON.parse(saved);

            // Migration: Convert old single-project format to multi-project
            if (parsed.columns && !parsed.projects) {
                const defaultProject = {
                    id: this.generateId(),
                    name: 'My Project',
                    color: '#6366f1',
                    columns: parsed.columns,
                    priorities: [
                        { id: this.generateId(), name: 'Low', color: '#10b981' },
                        { id: this.generateId(), name: 'Medium', color: '#f59e0b' },
                        { id: this.generateId(), name: 'High', color: '#ef4444' }
                    ],
                    cardCounter: parsed.cardCounter || 0,
                    createdAt: new Date().toISOString()
                };
                this.data = {
                    projects: [defaultProject],
                    activeProjectId: defaultProject.id,
                    sidebarCollapsed: false,
                    lastModified: new Date().toISOString()
                };
                this.saveToLocalStorage();
            } else {
                // Ensure all projects have the latest schema
                if (parsed.projects && Array.isArray(parsed.projects)) {
                    parsed.projects = parsed.projects.map(project => this.migrateProject(project));
                }
                this.data = parsed;
            }
        }
    }

    migrateProject(project) {
        // Add priorities if missing
        if (!project.priorities || !Array.isArray(project.priorities) || project.priorities.length === 0) {
            project.priorities = [
                { id: this.generateId(), name: 'Low', color: '#10b981' },
                { id: this.generateId(), name: 'Medium', color: '#f59e0b' },
                { id: this.generateId(), name: 'High', color: '#ef4444' }
            ];
        }

        // Migrate old priority strings to IDs
        if (project.columns && Array.isArray(project.columns)) {
            project.columns.forEach(column => {
                if (column.cards && Array.isArray(column.cards)) {
                    column.cards.forEach(card => {
                        // If priority is a string like 'low', 'medium', 'high', convert it to a priority ID
                        if (typeof card.priority === 'string' && ['low', 'medium', 'high'].includes(card.priority.toLowerCase())) {
                            const priorityMap = {
                                'low': project.priorities[0].id,
                                'medium': project.priorities[1].id,
                                'high': project.priorities[2].id
                            };
                            card.priority = priorityMap[card.priority.toLowerCase()];
                        }
                    });
                }
            });
        }

        return project;
    }

    calculateMaxCardNumber(project) {
        let max = 0;
        if (project && project.columns) {
            project.columns.forEach(column => {
                column.cards.forEach(card => {
                    if (card.cardNumber) {
                        const num = parseInt(card.cardNumber.replace('KB-', ''));
                        if (num > max) max = num;
                    }
                });
            });
        }
        return max;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Export / Import
    // ─────────────────────────────────────────────────────────────────────────────

    exportToJSON() {
        const project = this.getActiveProject();
        if (!project) {
            this.showToast('No project selected', 'error');
            return;
        }

        const dataStr = JSON.stringify(project, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('Project exported successfully', 'success');
    }

    exportAllProjects() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `kanban-all-projects-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('All projects exported', 'success');
    }

    importFromJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // Check if it's a full backup (multiple projects) or single project
                if (importedData.projects && Array.isArray(importedData.projects)) {
                    // Full backup import
                    this.data = importedData;
                    this.saveToLocalStorage();
                    this.renderProjectList();
                    this.render();
                    this.showToast('All projects imported successfully', 'success');
                } else if (importedData.columns && Array.isArray(importedData.columns)) {
                    // Single project import
                    const newProject = {
                        id: this.generateId(),
                        name: importedData.name || 'Imported Project',
                        color: importedData.color || '#6366f1',
                        columns: importedData.columns,
                        cardCounter: importedData.cardCounter || this.calculateMaxCardNumber(importedData),
                        createdAt: new Date().toISOString()
                    };
                    this.data.projects.push(newProject);
                    this.data.activeProjectId = newProject.id;
                    this.saveToLocalStorage();
                    this.renderProjectList();
                    this.render();
                    this.showToast('Project imported successfully', 'success');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                this.showToast('Failed to import: Invalid file', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Toast Notification
    // ─────────────────────────────────────────────────────────────────────────────

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');

        toastMessage.textContent = message;
        toast.className = `toast ${type} show`;

        // Update icon based on type
        toastIcon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'alert-circle');
        this.initLucideIcons();

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Event Bindings
    // ─────────────────────────────────────────────────────────────────────────────

    bindEvents() {
        // Sidebar toggles
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('expandSidebar').addEventListener('click', () => this.toggleSidebar());

        // Project management
        document.getElementById('addProjectBtn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('createFirstProjectBtn').addEventListener('click', () => this.openProjectModal());

        // Project Modal
        document.getElementById('closeProjectModal').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('deleteProjectBtn').addEventListener('click', () => this.deleteProject());
        document.getElementById('cancelProjectBtn').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('projectModal').querySelector('.modal-backdrop').addEventListener('click', () => this.closeProjectModal());

        // Header buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToJSON());
        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAllProjects());
        document.getElementById('importInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importFromJSON(e.target.files[0]);
                e.target.value = '';
            }
        });
        document.getElementById('addColumnBtn').addEventListener('click', () => this.openColumnModal());

        // Card Modal
        document.getElementById('closeModal').addEventListener('click', () => this.closeCardModal());
        document.getElementById('saveCardBtn').addEventListener('click', () => this.saveCard());
        document.getElementById('deleteCardBtn').addEventListener('click', () => this.deleteCard());
        document.getElementById('cancelCardBtn').addEventListener('click', () => this.closeCardModal());
        document.getElementById('cardModal').querySelector('.modal-backdrop').addEventListener('click', () => this.closeCardModal());

        // Column Modal
        document.getElementById('closeColumnModal').addEventListener('click', () => this.closeColumnModal());
        document.getElementById('saveColumnBtn').addEventListener('click', () => this.saveColumn());
        document.getElementById('deleteColumnBtn').addEventListener('click', () => this.deleteColumn());
        document.getElementById('cancelColumnBtn').addEventListener('click', () => this.closeColumnModal());
        document.getElementById('columnModal').querySelector('.modal-backdrop').addEventListener('click', () => this.closeColumnModal());

        // Priorities Modal
        document.getElementById('managePrioritiesBtn').addEventListener('click', () => this.openPrioritiesModal());
        document.getElementById('closePrioritiesModal').addEventListener('click', () => this.closePrioritiesModal());
        document.getElementById('addPriorityBtn').addEventListener('click', () => this.addPriority());
        document.getElementById('cancelPrioritiesBtn').addEventListener('click', () => this.closePrioritiesModal());
        document.getElementById('prioritiesModal').querySelector('.modal-backdrop').addEventListener('click', () => this.closePrioritiesModal());

        // Priorities list event delegation
        document.getElementById('prioritiesList').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.priority-delete-btn');
            if (deleteBtn) {
                const priorityId = deleteBtn.dataset.priorityId;
                this.deletePriority(priorityId);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCardModal();
                this.closeColumnModal();
                this.closeProjectModal();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (document.getElementById('cardModal').classList.contains('active')) {
                    this.saveCard();
                }
                if (document.getElementById('columnModal').classList.contains('active')) {
                    this.saveColumn();
                }
                if (document.getElementById('projectModal').classList.contains('active')) {
                    this.saveProject();
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Sidebar Operations
    // ─────────────────────────────────────────────────────────────────────────────

    toggleSidebar() {
        this.data.sidebarCollapsed = !this.data.sidebarCollapsed;
        this.updateSidebarState();
        localStorage.setItem('kanbanData', JSON.stringify(this.data));
    }

    updateSidebarState() {
        const sidebar = document.getElementById('sidebar');
        const expandBtn = document.getElementById('expandSidebar');
        const toggleIcon = document.querySelector('#toggleSidebar i');

        if (this.data.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            expandBtn.classList.add('visible');
            toggleIcon.setAttribute('data-lucide', 'panel-left-open');
        } else {
            sidebar.classList.remove('collapsed');
            expandBtn.classList.remove('visible');
            toggleIcon.setAttribute('data-lucide', 'panel-left-close');
        }
        this.initLucideIcons();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Project Operations
    // ─────────────────────────────────────────────────────────────────────────────

    renderProjectList() {
        const projectList = document.getElementById('projectList');
        projectList.innerHTML = '';

        if (this.data.projects.length === 0) {
            projectList.innerHTML = `
                <div class="empty-projects">
                    <p>No projects yet</p>
                </div>
            `;
            return;
        }

        this.data.projects.forEach(project => {
            const projectEl = document.createElement('div');
            projectEl.className = `project-item ${project.id === this.data.activeProjectId ? 'active' : ''}`;
            projectEl.dataset.projectId = project.id;

            const totalCards = project.columns ? project.columns.reduce((sum, col) => sum + col.cards.length, 0) : 0;

            projectEl.innerHTML = `
                <div class="project-color" style="background: ${project.color}"></div>
                <div class="project-info">
                    <span class="project-name">${this.escapeHtml(project.name)}</span>
                    <span class="project-stats">${totalCards} card${totalCards !== 1 ? 's' : ''}</span>
                </div>
                <button class="project-menu-btn" onclick="event.stopPropagation(); kanban.openProjectModal('${project.id}')" title="Edit project">
                    <i data-lucide="more-horizontal"></i>
                </button>
            `;

            projectEl.addEventListener('click', () => this.switchProject(project.id));
            projectList.appendChild(projectEl);
        });

        this.initLucideIcons();
    }

    switchProject(projectId) {
        this.data.activeProjectId = projectId;
        localStorage.setItem('kanbanData', JSON.stringify(this.data));
        this.renderProjectList();
        this.render();
    }

    openProjectModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        const title = document.getElementById('projectModalTitle');
        const deleteBtn = document.getElementById('deleteProjectBtn');

        this.editingProject = null;

        if (projectId) {
            const project = this.data.projects.find(p => p.id === projectId);
            if (project) {
                this.editingProject = project;
                title.textContent = 'Edit Project';
                document.getElementById('projectName').value = project.name;

                const colorRadio = document.querySelector(`input[name="projectColor"][value="${project.color}"]`);
                if (colorRadio) colorRadio.checked = true;
                else document.querySelector('input[name="projectColor"]').checked = true;

                deleteBtn.style.display = 'flex';
            }
        } else {
            title.textContent = 'New Project';
            document.getElementById('projectName').value = '';
            document.querySelector('input[name="projectColor"][value="#6366f1"]').checked = true;
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
        this.initLucideIcons();

        setTimeout(() => {
            document.getElementById('projectName').focus();
        }, 100);
    }

    closeProjectModal() {
        document.getElementById('projectModal').classList.remove('active');
        this.editingProject = null;
    }

    saveProject() {
        const name = document.getElementById('projectName').value.trim();
        const color = document.querySelector('input[name="projectColor"]:checked').value;

        if (!name) {
            this.showToast('Please enter a project name', 'error');
            document.getElementById('projectName').focus();
            return;
        }

        if (this.editingProject) {
            this.editingProject.name = name;
            this.editingProject.color = color;
        } else {
            const newProject = {
                id: this.generateId(),
                name,
                color,
                columns: [
                    { id: this.generateId(), name: 'Backlog', cards: [] },
                    { id: this.generateId(), name: 'In Progress', cards: [] },
                    { id: this.generateId(), name: 'Review', cards: [] },
                    { id: this.generateId(), name: 'Done', cards: [] }
                ],
                priorities: [
                    { id: this.generateId(), name: 'Low', color: '#10b981' },
                    { id: this.generateId(), name: 'Medium', color: '#f59e0b' },
                    { id: this.generateId(), name: 'High', color: '#ef4444' }
                ],
                cardCounter: 0,
                createdAt: new Date().toISOString()
            };
            this.data.projects.push(newProject);
            this.data.activeProjectId = newProject.id;
        }

        this.saveToLocalStorage();
        this.closeProjectModal();
        this.renderProjectList();
        this.render();
    }

    deleteProject() {
        if (!this.editingProject) return;

        const message = 'Delete this project and all its cards?';

        if (confirm(message)) {
            this.data.projects = this.data.projects.filter(p => p.id !== this.editingProject.id);

            if (this.data.activeProjectId === this.editingProject.id) {
                this.data.activeProjectId = this.data.projects.length > 0 ? this.data.projects[0].id : null;
            }

            this.saveToLocalStorage();
            this.closeProjectModal();
            this.renderProjectList();
            this.render();
            this.showToast('Project deleted', 'success');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Render Board
    // ─────────────────────────────────────────────────────────────────────────────

    render() {
        const board = document.getElementById('board');
        const noProjectState = document.getElementById('noProjectState');
        const currentProjectName = document.getElementById('currentProjectName');
        const project = this.getActiveProject();

        if (!project) {
            board.innerHTML = '';
            board.style.display = 'none';
            noProjectState.style.display = 'flex';
            currentProjectName.textContent = 'Select a Project';
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('addColumnBtn').disabled = true;
            return;
        }

        board.style.display = 'flex';
        noProjectState.style.display = 'none';
        currentProjectName.textContent = project.name;
        document.getElementById('exportBtn').disabled = false;
        document.getElementById('addColumnBtn').disabled = false;

        board.innerHTML = '';

        project.columns.forEach((column, index) => {
            const columnEl = this.createColumnElement(column, index);
            board.appendChild(columnEl);
        });

        this.initDragAndDrop();
        this.initLucideIcons();
    }

    createColumnElement(column, columnIndex) {
        const columnEl = document.createElement('div');
        columnEl.className = 'column';
        columnEl.dataset.columnId = column.id;
        columnEl.style.animationDelay = `${columnIndex * 75}ms`;

        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <h3 onclick="kanban.openColumnModal('${column.id}')">${this.escapeHtml(column.name)}</h3>
                    <span class="card-count">${column.cards.length}</span>
                </div>
                <div class="column-actions">
                    <button class="btn-icon" onclick="kanban.openColumnModal('${column.id}')" title="Edit Column">
                        <i data-lucide="settings-2"></i>
                    </button>
                </div>
            </div>
            <div class="column-body" data-column-id="${column.id}">
                ${column.cards.length === 0 ? `
                    <div class="empty-column">
                        <i data-lucide="inbox" class="empty-icon"></i>
                        <p>No cards yet</p>
                    </div>
                ` : ''}
            </div>
            <div class="column-footer">
                <button class="add-card-btn" onclick="kanban.openCardModal('${column.id}')">
                    <i data-lucide="plus"></i>
                    <span>Add Card</span>
                </button>
            </div>
        `;

        const columnBody = columnEl.querySelector('.column-body');
        column.cards.forEach((card, cardIndex) => {
            const cardEl = this.createCardElement(card, column.id, cardIndex);
            columnBody.appendChild(cardEl);
        });

        return columnEl;
    }

    createCardElement(card, columnId, cardIndex) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.cardId = card.id;
        cardEl.draggable = true;
        cardEl.style.animationDelay = `${cardIndex * 50}ms`;

        // Apply accent color as subtle background tint
        if (card.color && card.color !== '#1a1a2e') {
            cardEl.style.backgroundColor = card.color;
        }

        const createdDate = new Date(card.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        const cardNumber = card.cardNumber || 'KB-000';
        const project = this.getActiveProject();
        const priority = project.priorities.find(p => p.id === card.priority);
        const priorityName = priority ? priority.name : 'Unknown';
        const priorityColor = priority ? priority.color : '#666';

        cardEl.innerHTML = `
            <div class="card-header">
                <div class="card-header-main">
                    <span class="card-id">${cardNumber}</span>
                    <span class="priority-indicator" style="background: ${priorityColor}; box-shadow: 0 0 8px ${priorityColor}80;" title="${priorityName} Priority"></span>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn card-edit-btn" data-column-id="${columnId}" data-card-id="${card.id}" title="Edit card">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="card-action-btn card-delete-btn" data-column-id="${columnId}" data-card-id="${card.id}" title="Delete card">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="card-title">${this.escapeHtml(card.title)}</div>
            ${card.description ? `<div class="card-description">${this.escapeHtml(card.description)}</div>` : ''}
            <div class="card-footer">
                <span class="card-date">
                    <i data-lucide="calendar"></i>
                    ${createdDate}
                </span>
            </div>
        `;

        // Edit button handler
        const editBtn = cardEl.querySelector('.card-edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openCardModal(columnId, card.id);
        });

        // Delete button handler
        const deleteBtn = cardEl.querySelector('.card-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this card?')) {
                const project = this.getActiveProject();
                const column = project.columns.find(c => c.id === columnId);
                if (column) {
                    column.cards = column.cards.filter(c => c.id !== card.id);
                    this.saveToLocalStorage();
                    this.render();
                    this.showToast('Card deleted', 'success');
                }
            }
        });

        cardEl.addEventListener('click', (e) => {
            if (!cardEl.classList.contains('dragging') && !e.target.closest('.card-action-btn')) {
                this.openCardModal(columnId, card.id);
            }
        });

        return cardEl;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Drag and Drop with Spring Animation
    // ─────────────────────────────────────────────────────────────────────────────

    initDragAndDrop() {
        const cards = document.querySelectorAll('.card');
        const columnBodies = document.querySelectorAll('.column-body');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                // Spring effect on pickup
                card.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';

                setTimeout(() => {
                    card.classList.add('dragging');
                }, 0);

                e.dataTransfer.setData('text/plain', JSON.stringify({
                    cardId: card.dataset.cardId,
                    sourceColumnId: card.closest('.column').dataset.columnId
                }));

                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                card.style.transition = '';

                // Spring animation on drop
                card.style.animation = 'cardDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                setTimeout(() => {
                    card.style.animation = '';
                }, 400);

                document.querySelectorAll('.column-body').forEach(col => {
                    col.classList.remove('drag-over');
                });
            });
        });

        columnBodies.forEach(columnBody => {
            columnBody.addEventListener('dragover', (e) => {
                e.preventDefault();
                columnBody.classList.add('drag-over');

                const draggingCard = document.querySelector('.dragging');
                const afterElement = this.getDragAfterElement(columnBody, e.clientY);

                if (draggingCard) {
                    if (afterElement) {
                        columnBody.insertBefore(draggingCard, afterElement);
                    } else {
                        const emptyState = columnBody.querySelector('.empty-column');
                        if (emptyState) {
                            columnBody.insertBefore(draggingCard, emptyState);
                        } else {
                            columnBody.appendChild(draggingCard);
                        }
                    }
                }
            });

            columnBody.addEventListener('dragleave', (e) => {
                if (!columnBody.contains(e.relatedTarget)) {
                    columnBody.classList.remove('drag-over');
                }
            });

            columnBody.addEventListener('drop', (e) => {
                e.preventDefault();
                columnBody.classList.remove('drag-over');

                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const targetColumnId = columnBody.dataset.columnId;

                this.moveCard(data.cardId, data.sourceColumnId, targetColumnId, e.clientY);
            });
        });

        // Add drop animation keyframes dynamically
        if (!document.getElementById('drag-animations')) {
            const style = document.createElement('style');
            style.id = 'drag-animations';
            style.textContent = `
                @keyframes cardDrop {
                    0% { transform: scale(1.05); }
                    50% { transform: scale(0.98); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    moveCard(cardId, sourceColumnId, targetColumnId, dropY) {
        const project = this.getActiveProject();
        if (!project) return;

        const sourceColumn = project.columns.find(c => c.id === sourceColumnId);
        const targetColumn = project.columns.find(c => c.id === targetColumnId);

        if (!sourceColumn || !targetColumn) return;

        const cardIndex = sourceColumn.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const [card] = sourceColumn.cards.splice(cardIndex, 1);

        const targetBody = document.querySelector(`.column-body[data-column-id="${targetColumnId}"]`);
        const cardElements = [...targetBody.querySelectorAll('.card:not(.dragging)')];

        let insertIndex = targetColumn.cards.length;
        for (let i = 0; i < cardElements.length; i++) {
            const box = cardElements[i].getBoundingClientRect();
            if (dropY < box.top + box.height / 2) {
                insertIndex = i;
                break;
            }
        }

        targetColumn.cards.splice(insertIndex, 0, card);
        this.saveToLocalStorage();
        this.render();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Card Operations
    // ─────────────────────────────────────────────────────────────────────────────

    openCardModal(columnId, cardId = null) {
        const project = this.getActiveProject();
        if (!project) return;

        const modal = document.getElementById('cardModal');
        const title = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteCardBtn');
        const prioritySelect = document.getElementById('cardPriority');

        // Populate priority dropdown with project priorities
        prioritySelect.innerHTML = '';
        project.priorities.forEach(priority => {
            const option = document.createElement('option');
            option.value = priority.id;
            option.textContent = priority.name;
            prioritySelect.appendChild(option);
        });

        this.currentColumnId = columnId;
        this.editingCard = null;

        if (cardId) {
            const column = project.columns.find(c => c.id === columnId);
            const card = column.cards.find(c => c.id === cardId);

            if (card) {
                this.editingCard = card;
                title.textContent = 'Edit Card';
                document.getElementById('cardTitle').value = card.title;
                document.getElementById('cardDescription').value = card.description || '';
                prioritySelect.value = card.priority;

                const colorRadio = document.querySelector(`input[name="cardColor"][value="${card.color || '#1a1a2e'}"]`);
                if (colorRadio) colorRadio.checked = true;

                deleteBtn.style.display = 'flex';
            }
        } else {
            title.textContent = 'New Card';
            document.getElementById('cardTitle').value = '';
            document.getElementById('cardDescription').value = '';
            prioritySelect.value = project.priorities[0].id;
            document.querySelector('input[name="cardColor"][value="#1a1a2e"]').checked = true;
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
        this.initLucideIcons();

        setTimeout(() => {
            document.getElementById('cardTitle').focus();
        }, 100);
    }

    closeCardModal() {
        document.getElementById('cardModal').classList.remove('active');
        this.editingCard = null;
        this.currentColumnId = null;
    }

    saveCard() {
        const project = this.getActiveProject();
        if (!project) return;

        const title = document.getElementById('cardTitle').value.trim();
        const description = document.getElementById('cardDescription').value.trim();
        const priorityId = document.getElementById('cardPriority').value;
        const color = document.querySelector('input[name="cardColor"]:checked').value;

        if (!title) {
            this.showToast('Please enter a card title', 'error');
            document.getElementById('cardTitle').focus();
            return;
        }

        const column = project.columns.find(c => c.id === this.currentColumnId);
        if (!column) return;

        if (this.editingCard) {
            this.editingCard.title = title;
            this.editingCard.description = description;
            this.editingCard.priority = priorityId;
            this.editingCard.color = color;
            this.editingCard.updatedAt = new Date().toISOString();
        } else {
            const newCard = {
                id: this.generateId(),
                cardNumber: this.generateCardNumber(project),
                title,
                description,
                priority: priorityId,
                color,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            column.cards.push(newCard);
        }

        this.saveToLocalStorage();
        this.closeCardModal();
        this.renderProjectList();
        this.render();
    }

    deleteCard() {
        const project = this.getActiveProject();
        if (!this.editingCard || !this.currentColumnId || !project) return;

        const column = project.columns.find(c => c.id === this.currentColumnId);
        if (column) {
            column.cards = column.cards.filter(c => c.id !== this.editingCard.id);
            this.saveToLocalStorage();
            this.closeCardModal();
            this.renderProjectList();
            this.render();
            this.showToast('Card deleted', 'success');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Column Operations
    // ─────────────────────────────────────────────────────────────────────────────

    openColumnModal(columnId = null) {
        const project = this.getActiveProject();
        if (!project) {
            this.showToast('Please select a project first', 'error');
            return;
        }

        const modal = document.getElementById('columnModal');
        const title = document.getElementById('columnModalTitle');
        const deleteBtn = document.getElementById('deleteColumnBtn');

        this.editingColumn = null;

        if (columnId) {
            const column = project.columns.find(c => c.id === columnId);
            if (column) {
                this.editingColumn = column;
                title.textContent = 'Edit Column';
                document.getElementById('columnName').value = column.name;
                deleteBtn.style.display = 'flex';
            }
        } else {
            title.textContent = 'New Column';
            document.getElementById('columnName').value = '';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
        this.initLucideIcons();

        setTimeout(() => {
            document.getElementById('columnName').focus();
        }, 100);
    }

    closeColumnModal() {
        document.getElementById('columnModal').classList.remove('active');
        this.editingColumn = null;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Priority Operations
    // ─────────────────────────────────────────────────────────────────────────────

    openPrioritiesModal() {
        const project = this.getActiveProject();
        if (!project) return;

        const modal = document.getElementById('prioritiesModal');
        const prioritiesList = document.getElementById('prioritiesList');
        prioritiesList.innerHTML = '';

        project.priorities.forEach((priority, index) => {
            const priorityItem = document.createElement('div');
            priorityItem.className = 'priority-item';
            priorityItem.innerHTML = `
                <div class="priority-item-content">
                    <div class="priority-color" style="background: ${priority.color}"></div>
                    <span class="priority-item-name">${this.escapeHtml(priority.name)}</span>
                </div>
                <div class="priority-item-actions">
                    <button class="priority-action-btn priority-delete-btn" data-priority-id="${priority.id}" title="Delete priority">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            prioritiesList.appendChild(priorityItem);
        });

        modal.classList.add('active');
        this.initLucideIcons();
    }

    closePrioritiesModal() {
        document.getElementById('prioritiesModal').classList.remove('active');
    }

    addPriority() {
        const project = this.getActiveProject();
        if (!project) return;

        const name = document.getElementById('newPriorityName').value.trim();
        const color = document.getElementById('newPriorityColor').value;

        if (!name) {
            this.showToast('Please enter a priority name', 'error');
            return;
        }

        if (project.priorities.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            this.showToast('Priority already exists', 'error');
            return;
        }

        project.priorities.push({
            id: this.generateId(),
            name,
            color
        });

        this.saveToLocalStorage();
        document.getElementById('newPriorityName').value = '';
        this.openPrioritiesModal();
        this.showToast('Priority added', 'success');
    }

    deletePriority(priorityId) {
        const project = this.getActiveProject();
        if (!project) return;

        if (project.priorities.length <= 1) {
            this.showToast('You must have at least one priority', 'error');
            return;
        }

        if (confirm('Delete this priority? Cards using it will revert to the first priority.')) {
            const defaultPriority = project.priorities[0];
            project.priorities = project.priorities.filter(p => p.id !== priorityId);

            project.columns.forEach(column => {
                column.cards.forEach(card => {
                    if (card.priority === priorityId) {
                        card.priority = defaultPriority.id;
                    }
                });
            });

            this.saveToLocalStorage();
            this.openPrioritiesModal();
            this.render();
            this.showToast('Priority deleted', 'success');
        }
    }

    saveColumn() {
        const project = this.getActiveProject();
        if (!project) return;

        const name = document.getElementById('columnName').value.trim();

        if (!name) {
            this.showToast('Please enter a column name', 'error');
            document.getElementById('columnName').focus();
            return;
        }

        if (this.editingColumn) {
            this.editingColumn.name = name;
        } else {
            const newColumn = {
                id: this.generateId(),
                name,
                cards: []
            };
            project.columns.push(newColumn);
        }

        this.saveToLocalStorage();
        this.closeColumnModal();
        this.render();
    }

    deleteColumn() {
        const project = this.getActiveProject();
        if (!this.editingColumn || !project) return;

        const cardCount = this.editingColumn.cards.length;
        const message = cardCount > 0
            ? `This column contains ${cardCount} card(s). Delete anyway?`
            : 'Delete this column?';

        if (confirm(message)) {
            project.columns = project.columns.filter(c => c.id !== this.editingColumn.id);
            this.saveToLocalStorage();
            this.closeColumnModal();
            this.renderProjectList();
            this.render();
            this.showToast('Column deleted', 'success');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────────────

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the Kanban board
const kanban = new KanbanBoard();
