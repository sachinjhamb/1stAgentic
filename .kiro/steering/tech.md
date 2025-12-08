# Technical Stack

## Technology

- **Frontend**: Vanilla JavaScript (ES6+ classes)
- **Styling**: Pure CSS with CSS variables
- **Storage**: Browser localStorage
- **APIs**: Notification API for reminders

## Architecture

- Class-based OOP design with separation of concerns
- No frameworks, libraries, or build tools required
- No transpilation or bundling needed

## Key Classes

- `TodoApp`: Main application controller
- `TaskManager`: Task CRUD operations and state
- `StorageManager`: localStorage abstraction
- `TaskRenderer`: DOM rendering and UI updates
- `ReminderManager`: Notification scheduling
- `DateTimeUtils`: Date/time calculations

## Running the Application

**Development/Local Testing:**
```bash
# Option 1: Direct file access
# Simply open index.html in a browser

# Option 2: Local server (optional, for testing)
python -m http.server 8000
# or
npx http-server
```

**No build, compile, or test commands** - this is a static HTML/CSS/JS application.

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
