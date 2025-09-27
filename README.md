# Simple To-Do App

A clean, responsive To-Do application built with vanilla HTML, CSS, and JavaScript.

## Features

- Add new tasks
- Mark tasks as complete/incomplete  
- Delete individual tasks
- Persistent storage using localStorage
- Responsive design for mobile and desktop
- Task counter with completion status
- Keyboard shortcuts
- Clean, minimal UI

## How to Run

1. **Simple Method**: Just open index.html in any modern web browser
   - Double-click the index.html file
   - Or right-click and select Open with your preferred browser

2. **Local Server Method** (optional):
   `ash
   # Using Python (if installed)
   python -m http.server 8000
   
   # Using Node.js (if installed)
   npx http-server
   
   # Then open http://localhost:8000 in your browser
   `

## Usage

- **Add Task**: Type in the input field and press Enter or click Add Task
- **Complete Task**: Click the checkbox next to any task
- **Delete Task**: Click the Delete button next to any task
- **Keyboard Shortcuts**:
  - Press / to focus on the input field
  - Press Ctrl+Shift+Delete to clear all tasks

## File Structure

`
1stAgentic/
 index.html      # Main HTML structure
 styles.css      # CSS styling and responsive design
 app.js          # JavaScript functionality and localStorage
 README.md       # This file
`

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Data Storage

Tasks are automatically saved to your browser's localStorage, so they persist between sessions. Data is stored locally on your device and is not sent to any external servers.

## Customization

You can easily customize the app by modifying:
- **Colors**: Edit the CSS variables in styles.css
- **Features**: Add new functionality in app.js
- **Layout**: Modify the HTML structure in index.html

Enjoy your new To-Do app! 
