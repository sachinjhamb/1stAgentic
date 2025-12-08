# Project Structure

## File Organization

```
/
├── index.html       # Main HTML structure and DOM elements
├── styles.css       # All styling, responsive design, animations
├── app.js           # Current production JavaScript (class-based)
├── app-legacy.js    # Legacy implementation (kept for reference)
└── README.md        # User documentation
```

## Code Conventions

**JavaScript:**
- ES6+ class syntax with clear separation of concerns
- Class names use PascalCase (e.g., `TaskManager`, `StorageManager`)
- Method names use camelCase (e.g., `addTask`, `toggleSubtask`)
- Constants use camelCase for class properties
- Input validation and error handling with try-catch blocks
- String truncation for security (tasks: 500 chars, subtasks: 200 chars, notes: 300 chars)
- DOM manipulation through dedicated renderer class
- Event handlers bound in constructor or passed as callbacks

**CSS:**
- Mobile-first responsive design with media queries
- Gradient backgrounds for visual appeal
- Flexbox for layouts
- BEM-like naming for component styles (e.g., `task-item`, `task-main`, `task-actions`)
- Transitions for smooth interactions
- CSS custom properties could be added for theming

**HTML:**
- Semantic HTML5 elements
- Form-based task input with validation
- Accessibility attributes (title, required)
- Minimal inline JavaScript (initialization only)

## Data Model

**Task Object:**
```javascript
{
  id: number,
  text: string,
  completed: boolean,
  createdAt: ISO string,
  dueDateTime: ISO string,
  subtasks: Array<Subtask>
}
```

**Subtask Object:**
```javascript
{
  id: number,
  text: string,
  notes: string,
  priority: 'Normal' | 'Important' | 'Urgent',
  weight: number (3, 5, or 8),
  completed: boolean
}
```

## Legacy Code

`app-legacy.js` contains the original implementation without subtasks. Keep for reference but do not modify. All new features go in `app.js`.
