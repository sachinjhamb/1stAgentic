// Enhanced To-Do App with Scheduling and Reminders
class TodoApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.taskIdCounter = this.getNextId();
        this.reminderTimeouts = new Map();
        this.initializeElements();
        this.bindEvents();
        this.renderTasks();
        this.setupReminders();
        this.setDefaultDateTime();
    }

    initializeElements() {
        this.taskForm = document.getElementById("task-form");
        this.taskInput = document.getElementById("task-input");
        this.taskDate = document.getElementById("task-date");
        this.taskTime = document.getElementById("task-time");
        this.taskList = document.getElementById("task-list");
        this.taskCount = document.getElementById("task-count");
    }

    bindEvents() {
        this.taskForm.addEventListener("submit", (e) => this.handleAddTask(e));
        
        // Track user interaction with date/time inputs
        this.taskDate.addEventListener("change", () => this.userModifiedDate = true);
        this.taskTime.addEventListener("change", () => this.userModifiedTime = true);
    }

    setDefaultDateTime() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        
        this.taskDate.value = today;
        this.taskTime.value = time;
        
        // Reset user modification flags
        this.userModifiedDate = false;
        this.userModifiedTime = false;
    }

    handleAddTask(e) {
        e.preventDefault();
        const taskText = this.taskInput.value.trim();
        
        if (taskText === "") {
            return;
        }

        const dueDate = this.taskDate.value;
        const dueTime = this.taskTime.value;
        
        // Calculate due datetime based on user interaction
        let dueDateTime;
        if (this.userModifiedDate && this.userModifiedTime) {
            // Both date and time explicitly modified by user
            dueDateTime = new Date(`${dueDate}T${dueTime}`);
        } else if (this.userModifiedDate) {
            // Only date was modified by user - set to 1 hour from task creation time on that date
            const creationTime = new Date();
            dueDateTime = new Date(`${dueDate}T${creationTime.toTimeString().slice(0, 5)}`);
            dueDateTime.setHours(dueDateTime.getHours() + 1);
        } else if (this.userModifiedTime) {
            // Only time was modified by user - set to today at that time, or 1 hour from creation if time has passed
            const creationTime = new Date();
            const today = creationTime.toISOString().split('T')[0];
            dueDateTime = new Date(`${today}T${dueTime}`);
            
            // If the time has already passed today, set to 1 hour from creation time
            if (dueDateTime <= creationTime) {
                dueDateTime = new Date(creationTime);
                dueDateTime.setHours(dueDateTime.getHours() + 1);
            }
        } else {
            // Neither date nor time was modified by user - set to 1 hour from task creation time
            dueDateTime = new Date();
            dueDateTime.setHours(dueDateTime.getHours() + 1);
        }

        const task = {
            id: this.taskIdCounter++,
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString(),
            dueDateTime: dueDateTime.toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.setupReminderForTask(task);
        
        // Reset form
        this.taskInput.value = "";
        this.setDefaultDateTime();
        this.taskInput.focus();
    }

    toggleTask(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
            
            // Cancel reminder if task is completed
            if (task.completed) {
                this.cancelReminder(id);
            } else {
                this.setupReminderForTask(task);
            }
        }
    }

    deleteTask(id) {
        this.cancelReminder(id);
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveTasks();
        this.renderTasks();
    }

    renderTasks() {
        this.taskList.innerHTML = "";
        
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = `
                <li class="empty-state">
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>No tasks yet. Add one above!</p>
                    </div>
                </li>
            `;
        } else {
            // Sort tasks by due date
            const sortedTasks = [...this.tasks].sort((a, b) => 
                new Date(a.dueDateTime) - new Date(b.dueDateTime)
            );
            
            sortedTasks.forEach(task => {
                const taskElement = this.createTaskElement(task);
                this.taskList.appendChild(taskElement);
            });
        }

        this.updateTaskCount();
    }

    createTaskElement(task) {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""}`;
        
        const dueDate = new Date(task.dueDateTime);
        const now = new Date();
        const timeDiff = dueDate - now;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        let scheduleClass = "";
        let scheduleText = "";
        
        if (task.completed) {
            scheduleClass = "";
            scheduleText = "Completed";
        } else if (timeDiff < 0) {
            scheduleClass = "task-overdue";
            scheduleText = "Overdue";
        } else if (hoursDiff <= 1) {
            scheduleClass = "task-due-soon";
            scheduleText = "Due soon";
        } else {
            scheduleClass = "";
            scheduleText = "";
        }

        li.innerHTML = `
            <div class="task-main">
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? "checked" : ""}
                    onchange="todoApp.toggleTask(${task.id})"
                >
                <span class="task-text">${this.escapeHtml(task.text)}</span>
                <div class="task-actions">
                    <button 
                        class="delete-btn" 
                        onclick="todoApp.deleteTask(${task.id})"
                        title="Delete task"
                    >
                        Delete
                    </button>
                </div>
            </div>
            <div class="task-schedule">
                <div class="task-due-date">
                    <span></span>
                    <span>${dueDate.toLocaleDateString()}</span>
                </div>
                <div class="task-due-time">
                    <span></span>
                    <span>${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                ${scheduleText ? `<span class="${scheduleClass}">${scheduleText}</span>` : ''}
            </div>
        `;
        return li;
    }

    setupReminders() {
        // Clear existing reminders
        this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
        this.reminderTimeouts.clear();
        
        // Setup reminders for all incomplete tasks
        this.tasks.forEach(task => {
            if (!task.completed) {
                this.setupReminderForTask(task);
            }
        });
    }

    setupReminderForTask(task) {
        if (task.completed) return;
        
        const dueDate = new Date(task.dueDateTime);
        const reminderTime = new Date(dueDate.getTime() - 5 * 60 * 1000); // 5 minutes before
        const now = new Date();
        
        // If reminder time is in the past, don't set a reminder
        if (reminderTime <= now) return;
        
        const timeUntilReminder = reminderTime - now;
        
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

    showReminder(task) {
        // Check if task still exists and is not completed
        const currentTask = this.tasks.find(t => t.id === task.id);
        if (!currentTask || currentTask.completed) return;
        
        // Show browser notification if permission is granted
        if (Notification.permission === "granted") {
            new Notification(`Task Reminder: ${task.text}`, {
                body: `Your task is due in 5 minutes!`,
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23667eea'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/></svg>"
            });
        }
        
        // Show in-app notification
        this.showInAppNotification(`Reminder: "${task.text}" is due in 5 minutes!`, 'warning');
        
        // Remove the timeout from our map
        this.reminderTimeouts.delete(task.id);
    }

    showInAppNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    updateTaskCount() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const remainingTasks = totalTasks - completedTasks;
        const overdueTasks = this.tasks.filter(task => {
            if (task.completed) return false;
            return new Date(task.dueDateTime) < new Date();
        }).length;
        
        if (totalTasks === 0) {
            this.taskCount.textContent = "0 tasks";
        } else if (completedTasks === totalTasks) {
            this.taskCount.textContent = `All ${totalTasks} tasks completed! `;
        } else if (overdueTasks > 0) {
            this.taskCount.textContent = `${remainingTasks} of ${totalTasks} tasks remaining (${overdueTasks} overdue)`;
        } else {
            this.taskCount.textContent = `${remainingTasks} of ${totalTasks} tasks remaining`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    getNextId() {
        if (this.tasks.length === 0) return 1;
        return Math.max(...this.tasks.map(task => task.id)) + 1;
    }

    loadTasks() {
        try {
            const saved = localStorage.getItem("todoApp_tasks");
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error("Error loading tasks from localStorage:", error);
            return [];
        }
    }

    saveTasks() {
        try {
            localStorage.setItem("todoApp_tasks", JSON.stringify(this.tasks));
        } catch (error) {
            console.error("Error saving tasks to localStorage:", error);
        }
    }

    // Public methods for external access
    clearAllTasks() {
        if (confirm("Are you sure you want to delete all tasks?")) {
            // Clear all reminders
            this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
            this.reminderTimeouts.clear();
            
            this.tasks = [];
            this.taskIdCounter = 1;
            this.saveTasks();
            this.renderTasks();
        }
    }

    clearCompletedTasks() {
        const completedCount = this.tasks.filter(task => task.completed).length;
        if (completedCount > 0 && confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
            this.tasks = this.tasks.filter(task => !task.completed);
            this.saveTasks();
            this.renderTasks();
        }
    }
}

// Request notification permission
if (Notification.permission === "default") {
    Notification.requestPermission();
}

// Initialize the app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    window.todoApp = new TodoApp();
});

// Add some keyboard shortcuts
document.addEventListener("keydown", (e) => {
    // Focus on input when pressing "/"
    if (e.key === "/" && e.target !== window.todoApp.taskInput) {
        e.preventDefault();
        window.todoApp.taskInput.focus();
    }
    
    // Clear all tasks with Ctrl+Shift+Delete
    if (e.ctrlKey && e.shiftKey && e.key === "Delete") {
        e.preventDefault();
        if (window.todoApp) {
            window.todoApp.clearAllTasks();
        }
    }
});
