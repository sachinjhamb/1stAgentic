@echo off
REM Run backend tests only
node node_modules/jest/bin/jest.js backend %*
