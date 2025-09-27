// Storage Manager
class StorageManager {
    constructor(storageKey = 'todoApp_tasks') {
        this.storageKey = storageKey;
    }

    loadTasks() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading tasks from localStorage:', error);
            return [];
        }
    }

    saveTasks(tasks) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(tasks));
        } catch (error) {
            console.error('Error saving tasks to localStorage:', error);
        }
    }
}

// DateTime Utils
class DateTimeUtils {
    static calculateDueDateTime(userModifiedDate, userModifiedTime, dueDate, dueTime) {
        const creationTime = new Date();
        
        try {
            if (userModifiedDate && userModifiedTime) {
                const result = new Date(`${dueDate}T${dueTime}`);
                if (isNaN(result.getTime())) throw new Error('Invalid date');
                return result;
            } 
            
            if (userModifiedDate) {
                const timeStr = creationTime.getHours().toString().padStart(2, '0') + ':' + 
                               creationTime.getMinutes().toString().padStart(2, '0');
                const dateTime = new Date(`${dueDate}T${timeStr}`);
                if (isNaN(dateTime.getTime())) throw new Error('Invalid date');
                dateTime.setHours(dateTime.getHours() + 1);
                return dateTime;
            } 
            
            if (userModifiedTime) {
                const today = creationTime.toISOString().split('T')[0];
                const dateTime = new Date(`${today}T${dueTime}`);
                if (isNaN(dateTime.getTime())) throw new Error('Invalid date');
                
                if (dateTime <= creationTime) {
                    const fallbackTime = new Date(creationTime);
                    fallbackTime.setHours(fallbackTime.getHours() + 1);
                    return fallbackTime;
                }
                return dateTime;
            }
            
            const defaultTime = new Date(creationTime);
            defaultTime.setHours(defaultTime.getHours() + 1);
            return defaultTime;
        } catch (error) {
            const fallback = new Date();
            fallback.setHours(fallback.getHours() + 1);
            return fallback;
        }
    }

    static setDefaultDateTime() {
        const now = new Date();
        return {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().slice(0, 5)
        };
    }

    static getTaskStatus(task) {
        if (task.completed) {
            return { class: '', text: 'Completed' };
        }
        
        const dueDate = new Date(task.dueDateTime);
        const now = new Date();
        const timeDiff = dueDate - now;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (timeDiff < 0) {
            return { class: 'task-overdue', text: 'Overdue' };
        }
        
        if (hoursDiff <= 1) {
            return { class: 'task-due-soon', text: 'Due soon' };
        }
        
        return { class: '', text: '' };
    }
}

// Task Manager
class TaskManager {
    constructor() {
        this.tasks = [];
        this.taskIdCounter = 1;
    }

    initializeTasks(tasks) {
        this.tasks = tasks;
        this.taskIdCounter = this.getNextId();
    }

    addTask(taskData) {
        if (!taskData || !taskData.text || !taskData.dueDateTime) {
            throw new Error('Invalid task data');
        }
        
        const task = {
            id: this.taskIdCounter++,
            text: String(taskData.text).substring(0, 500),
            completed: false,
            createdAt: new Date().toISOString(),
            dueDateTime: taskData.dueDateTime instanceof Date ? taskData.dueDateTime.toISOString() : new Date().toISOString(),
            subtasks: []
        };

        this.tasks.push(task);
        return task;
    }

    addSubtask(taskId, subtaskText, notes = '', priority = 'Normal') {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && subtaskText.trim()) {
            const weightMap = { 'Normal': 3, 'Important': 5, 'Urgent': 8 };
            const subtask = {
                id: Date.now(),
                text: String(subtaskText).substring(0, 200),
                notes: String(notes).substring(0, 300),
                priority: priority,
                weight: weightMap[priority] || 3,
                completed: false
            };
            task.subtasks.push(subtask);
            return subtask;
        }
        return null;
    }

    toggleSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const subtask = task.subtasks.find(s => s.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                
                // Auto-complete main task if all subtasks are completed
                if (task.subtasks.length > 0 && task.subtasks.every(s => s.completed)) {
                    task.completed = true;
                }
                // Uncheck main task if any subtask is unchecked
                else if (!subtask.completed && task.completed) {
                    task.completed = false;
                }
                
                return true;
            }
        }
        return false;
    }

    deleteSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
            return true;
        }
        return false;
    }

    getTaskProgress(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            return task.completed ? 100 : 0;
        }
        const completed = task.subtasks.filter(s => s.completed).length;
        return Math.round((completed / task.subtasks.length) * 100);
    }

    toggleTask(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            return task;
        }
        return null;
    }

    deleteTask(id) {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(task => task.id !== id);
        return this.tasks.length !== initialLength;
    }

    clearAllTasks() {
        this.tasks = [];
        this.taskIdCounter = 1;
    }

    clearCompletedTasks() {
        this.tasks = this.tasks.filter(task => !task.completed);
    }

    getTasks() {
        return this.tasks;
    }

    getNextId() {
        if (this.tasks.length === 0) return 1;
        return Math.max(...this.tasks.map(task => task.id)) + 1;
    }
}

// Reminder Manager
class ReminderManager {
    constructor() {
        this.reminderTimeouts = new Map();
        this.requestNotificationPermission();
    }

    requestNotificationPermission() {
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(err => 
                console.warn('Notification permission request failed:', err)
            );
        }
    }

    setupReminders(tasks) {
        this.clearAllReminders();
        
        tasks.forEach(task => {
            if (!task.completed) {
                this.setupReminderForTask(task);
            }
        });
    }

    setupReminderForTask(task) {
        if (task.completed) return;
        
        const dueDate = new Date(task.dueDateTime);
        const reminderTime = new Date(dueDate.getTime() - 5 * 60 * 1000);
        const now = new Date();
        
        if (reminderTime <= now) return;
        
        const timeUntilReminder = reminderTime - now;
        const maxTimeout = 7 * 24 * 60 * 60 * 1000; // 7 days limit due to browser timeout constraints
        if (timeUntilReminder > maxTimeout) return;
        
        const timeoutId = setTimeout(() => {
            this.showReminder(task);
        }, timeUntilReminder);
        
        this.reminderTimeouts.set(task.id, timeoutId);
    }

    cancelReminder(taskId) {
        const timeoutId = this.reminderTimeouts.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.reminderTimeouts.delete(taskId);
        }
    }

    clearAllReminders() {
        this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
        this.reminderTimeouts.clear();
    }

    showReminder(task) {
        if (!task || !task.text || !task.id) return;
        
        if (Notification.permission === 'granted') {
            const title = 'Task Reminder: ' + String(task.text).substring(0, 50);
            new Notification(title, {
                body: 'Your task is due in 5 minutes!',
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23667eea'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/></svg>"
            });
        }
        
        const safeTaskText = String(task.text).substring(0, 100);
        this.showInAppNotification('Reminder: "' + safeTaskText + '" is due in 5 minutes!', 'warning');
        this.reminderTimeouts.delete(task.id);
    }

    showInAppNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.classList.add(type);
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Task Renderer
class TaskRenderer {
    constructor(taskList, taskCount) {
        this.taskList = taskList;
        this.taskCount = taskCount;
    }

    renderTasks(tasks, onToggle, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask) {
        this.taskList.innerHTML = '';
        
        if (tasks.length === 0) {
            this.renderEmptyState();
        } else {
            this.renderTaskList(tasks, onToggle, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask);
        }
        
        this.updateTaskCount(tasks);
    }

    renderEmptyState() {
        const li = document.createElement('li');
        li.className = 'empty-state';
        
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        div.style.padding = '40px';
        div.style.color = '#6c757d';
        
        const p = document.createElement('p');
        p.textContent = 'No tasks yet. Add one above!';
        
        div.appendChild(p);
        li.appendChild(div);
        this.taskList.appendChild(li);
    }

    renderTaskList(tasks, onToggle, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask) {
        const sortedTasks = [...tasks].sort((a, b) => 
            new Date(a.dueDateTime) - new Date(b.dueDateTime)
        );
        
        sortedTasks.forEach(task => {
            const taskElement = this.createTaskElement(task, onToggle, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask);
            this.taskList.appendChild(taskElement);
        });
    }

    createTaskElement(task, onToggle, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask) {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const dueDate = new Date(task.dueDateTime);
        const status = DateTimeUtils.getTaskStatus(task);
        const progress = this.getTaskProgress(task);
        
        const taskMain = document.createElement('div');
        taskMain.className = 'task-main';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-container';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = progress + '%';
        const progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = `${progress}%`;
        progressBar.appendChild(progressFill);
        progressBar.appendChild(progressText);
        
        const taskActions = document.createElement('div');
        taskActions.className = 'task-actions';
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.textContent = task.subtasks && task.subtasks.length > 0 ? '▼' : '▶';
        expandBtn.title = 'Expand/Collapse subtasks';
        expandBtn.style.display = task.subtasks && task.subtasks.length > 0 ? 'block' : 'none';
        
        const addSubtaskBtn = document.createElement('button');
        addSubtaskBtn.className = 'add-subtask-btn';
        addSubtaskBtn.textContent = '+';
        addSubtaskBtn.title = 'Add subtask';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete task';
        deleteBtn.textContent = 'Delete';
        
        taskActions.appendChild(expandBtn);
        taskActions.appendChild(addSubtaskBtn);
        taskActions.appendChild(deleteBtn);
        taskMain.appendChild(checkbox);
        taskMain.appendChild(taskText);
        taskMain.appendChild(progressBar);
        taskMain.appendChild(taskActions);
        
        const taskSchedule = document.createElement('div');
        taskSchedule.className = 'task-schedule';
        
        const dueDateDiv = document.createElement('div');
        dueDateDiv.className = 'task-due-date';
        const dateIcon = document.createElement('span');
        const dateText = document.createElement('span');
        dateText.textContent = dueDate.toLocaleDateString();
        dueDateDiv.appendChild(dateIcon);
        dueDateDiv.appendChild(dateText);
        
        const dueTimeDiv = document.createElement('div');
        dueTimeDiv.className = 'task-due-time';
        const timeIcon = document.createElement('span');
        const timeText = document.createElement('span');
        timeText.textContent = dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        dueTimeDiv.appendChild(timeIcon);
        dueTimeDiv.appendChild(timeText);
        
        taskSchedule.appendChild(dueDateDiv);
        taskSchedule.appendChild(dueTimeDiv);
        
        if (status.text) {
            const statusSpan = document.createElement('span');
            statusSpan.className = status.class;
            statusSpan.textContent = status.text;
            taskSchedule.appendChild(statusSpan);
        }
        
        li.appendChild(taskMain);
        li.appendChild(taskSchedule);
        
        // Subtasks container
        const subtasksContainer = document.createElement('div');
        subtasksContainer.className = 'subtasks-container';
        subtasksContainer.style.display = 'none';
        
        if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach(subtask => {
                const subtaskDiv = document.createElement('div');
                subtaskDiv.className = `subtask ${subtask.completed ? 'completed' : ''}`;
                
                const subtaskCheckbox = document.createElement('input');
                subtaskCheckbox.type = 'checkbox';
                subtaskCheckbox.checked = subtask.completed;
                
                const subtaskContent = document.createElement('div');
                subtaskContent.className = 'subtask-content';
                
                const subtaskText = document.createElement('span');
                subtaskText.className = 'subtask-text';
                subtaskText.textContent = subtask.text;
                
                const subtaskDeleteBtn = document.createElement('button');
                subtaskDeleteBtn.className = 'subtask-delete-btn';
                subtaskDeleteBtn.textContent = '×';
                subtaskDeleteBtn.title = 'Delete subtask';
                
                subtaskContent.appendChild(subtaskText);
                if (subtask.notes) {
                    const subtaskNotes = document.createElement('div');
                    subtaskNotes.className = 'subtask-notes';
                    subtaskNotes.textContent = subtask.notes;
                    subtaskContent.appendChild(subtaskNotes);
                }
                if (subtask.priority && subtask.priority !== 'Normal') {
                    const subtaskPriority = document.createElement('span');
                    subtaskPriority.className = `subtask-priority priority-${subtask.priority.toLowerCase()}`;
                    subtaskPriority.textContent = subtask.priority;
                    subtaskContent.appendChild(subtaskPriority);
                }
                
                subtaskDiv.appendChild(subtaskCheckbox);
                subtaskDiv.appendChild(subtaskContent);
                subtaskDiv.appendChild(subtaskDeleteBtn);
                subtasksContainer.appendChild(subtaskDiv);
                
                subtaskCheckbox.addEventListener('change', () => onToggleSubtask(task.id, subtask.id));
                subtaskDeleteBtn.addEventListener('click', () => onDeleteSubtask(task.id, subtask.id));
            });
        }
        
        li.appendChild(subtasksContainer);
        
        checkbox.addEventListener('change', () => onToggle(task.id));
        deleteBtn.addEventListener('click', () => onDelete(task.id));
        
        expandBtn.addEventListener('click', () => {
            const isExpanded = subtasksContainer.style.display !== 'none';
            subtasksContainer.style.display = isExpanded ? 'none' : 'block';
            expandBtn.textContent = isExpanded ? '▶' : '▼';
        });
        
        addSubtaskBtn.addEventListener('click', () => {
            this.showSubtaskDialog(task.id, onAddSubtask);
        });
        
        return li;
    }

    getTaskProgress(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            return task.completed ? 100 : 0;
        }
        const totalWeight = task.subtasks.reduce((sum, s) => sum + (s.weight || 3), 0);
        const completedWeight = task.subtasks.filter(s => s.completed).reduce((sum, s) => sum + (s.weight || 3), 0);
        return Math.round((completedWeight / totalWeight) * 100);
    }

    showSubtaskDialog(taskId, onAddSubtask) {
        const dialog = document.createElement('div');
        dialog.className = 'subtask-dialog';
        
        const dialogContent = document.createElement('div');
        dialogContent.className = 'dialog-content';
        
        const title = document.createElement('h3');
        title.textContent = 'Add Subtask';
        
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.id = 'subtask-text';
        textInput.placeholder = 'Subtask description';
        textInput.maxLength = 200;
        
        const notesInput = document.createElement('textarea');
        notesInput.id = 'subtask-notes';
        notesInput.placeholder = 'Notes (optional)';
        notesInput.maxLength = 300;
        
        const prioritySelect = document.createElement('select');
        prioritySelect.id = 'subtask-priority';
        const priorities = ['Normal', 'Important', 'Urgent'];
        priorities.forEach(priority => {
            const option = document.createElement('option');
            option.value = priority;
            option.textContent = priority;
            prioritySelect.appendChild(option);
        });
        
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'dialog-buttons';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-btn';
        cancelBtn.textContent = 'Cancel';
        
        const addBtn = document.createElement('button');
        addBtn.id = 'add-btn';
        addBtn.textContent = 'Add';
        
        buttonDiv.appendChild(cancelBtn);
        buttonDiv.appendChild(addBtn);
        dialogContent.appendChild(title);
        dialogContent.appendChild(textInput);
        dialogContent.appendChild(notesInput);
        dialogContent.appendChild(prioritySelect);
        dialogContent.appendChild(buttonDiv);
        dialog.appendChild(dialogContent);
        
        document.body.appendChild(dialog);
        
        textInput.focus();
        
        const closeDialog = () => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        };
        
        cancelBtn.addEventListener('click', closeDialog);
        
        addBtn.addEventListener('click', () => {
            const text = textInput.value.trim();
            if (text) {
                onAddSubtask(taskId, text, notesInput.value.trim(), prioritySelect.value);
                closeDialog();
            }
        });
        
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });
    }

    updateTaskCount(tasks) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed).length;
        const remainingTasks = totalTasks - completedTasks;
        const now = new Date();
        const overdueTasks = tasks.filter(task => {
            if (task.completed) return false;
            return new Date(task.dueDateTime) < now;
        }).length;
        
        if (totalTasks === 0) {
            this.taskCount.textContent = '0 tasks';
        } else if (completedTasks === totalTasks) {
            this.taskCount.textContent = `All ${totalTasks} tasks completed! `;
        } else if (overdueTasks > 0) {
            this.taskCount.textContent = `${remainingTasks} of ${totalTasks} tasks remaining (${overdueTasks} overdue)`;
        } else {
            this.taskCount.textContent = `${remainingTasks} of ${totalTasks} tasks remaining`;
        }
    }
}

// Main TodoApp
class TodoApp {
    constructor() {
        this.storage = new StorageManager();
        this.taskManager = new TaskManager();
        this.reminderManager = new ReminderManager();
        
        this.userModifiedDate = false;
        this.userModifiedTime = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeApp();
    }

    initializeElements() {
        this.taskForm = document.getElementById('task-form');
        this.taskInput = document.getElementById('task-input');
        this.taskDate = document.getElementById('task-date');
        this.taskTime = document.getElementById('task-time');
        this.taskList = document.getElementById('task-list');
        this.taskCount = document.getElementById('task-count');

        if (!this.taskForm || !this.taskInput || !this.taskDate || !this.taskTime || !this.taskList || !this.taskCount) {
            throw new Error('Required DOM elements not found');
        }

        this.renderer = new TaskRenderer(this.taskList, this.taskCount);
    }

    bindEvents() {
        this.taskForm.addEventListener('submit', (e) => this.handleAddTask(e));
        this.taskDate.addEventListener('change', () => this.userModifiedDate = true);
        this.taskTime.addEventListener('change', () => this.userModifiedTime = true);
    }

    initializeApp() {
        const tasks = this.storage.loadTasks();
        this.taskManager.initializeTasks(tasks);
        this.renderTasks();
        this.reminderManager.setupReminders(this.taskManager.getTasks());
        this.setDefaultDateTime();
    }

    setDefaultDateTime() {
        const { date, time } = DateTimeUtils.setDefaultDateTime();
        this.taskDate.value = date;
        this.taskTime.value = time;
        this.userModifiedDate = false;
        this.userModifiedTime = false;
    }

    handleAddTask(e) {
        e.preventDefault();
        const taskText = this.taskInput.value.trim();
        
        if (taskText === '') return;
        
        const dueDate = this.taskDate.value;
        const dueTime = this.taskTime.value;
        
        const dueDateTime = DateTimeUtils.calculateDueDateTime(
            this.userModifiedDate,
            this.userModifiedTime,
            dueDate,
            dueTime
        );

        const task = this.taskManager.addTask({
            text: taskText,
            dueDateTime
        });

        this.storage.saveTasks(this.taskManager.getTasks());
        this.renderTasks();
        this.reminderManager.setupReminderForTask(task);
        
        this.resetForm();
    }

    resetForm() {
        this.taskInput.value = '';
        this.setDefaultDateTime();
        this.taskInput.focus();
    }

    toggleTask(id) {
        const task = this.taskManager.toggleTask(id);
        if (task) {
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
            
            if (task.completed) {
                this.reminderManager.cancelReminder(id);
            } else {
                this.reminderManager.setupReminderForTask(task);
            }
        }
    }

    deleteTask(id) {
        if (this.taskManager.deleteTask(id)) {
            this.reminderManager.cancelReminder(id);
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }

    renderTasks() {
        this.renderer.renderTasks(
            this.taskManager.getTasks(),
            (id) => this.toggleTask(id),
            (id) => this.deleteTask(id),
            (taskId, subtaskText, notes, weight) => this.addSubtask(taskId, subtaskText, notes, weight),
            (taskId, subtaskId) => this.toggleSubtask(taskId, subtaskId),
            (taskId, subtaskId) => this.deleteSubtask(taskId, subtaskId)
        );
    }

    addSubtask(taskId, subtaskText, notes = '', weight = 1) {
        if (this.taskManager.addSubtask(taskId, subtaskText, notes, weight)) {
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }

    toggleSubtask(taskId, subtaskId) {
        if (this.taskManager.toggleSubtask(taskId, subtaskId)) {
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }

    deleteSubtask(taskId, subtaskId) {
        if (this.taskManager.deleteSubtask(taskId, subtaskId)) {
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }

    clearAllTasks() {
        if (confirm('Are you sure you want to delete all tasks?')) {
            this.reminderManager.clearAllReminders();
            this.taskManager.clearAllTasks();
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }

    clearCompletedTasks() {
        const completedTasks = this.taskManager.getTasks().filter(task => task.completed);
        if (completedTasks.length > 0 && confirm(`Are you sure you want to delete ${completedTasks.length} completed task(s)?`)) {
            completedTasks.forEach(task => this.reminderManager.cancelReminder(task.id));
            this.taskManager.clearCompletedTasks();
            this.storage.saveTasks(this.taskManager.getTasks());
            this.renderTasks();
        }
    }
}

// Initialize the app
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});

document.addEventListener('keydown', (e) => {
    if (e.key === '/' && e.target !== window.todoApp?.taskInput) {
        e.preventDefault();
        window.todoApp?.taskInput?.focus();
    }
    
    if (e.ctrlKey && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        if (window.todoApp) {
            window.todoApp.clearAllTasks();
        }
    }
});