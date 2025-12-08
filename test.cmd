@echo off
REM Run all tests (frontend and backend)
node node_modules/jest/bin/jest.js %*
