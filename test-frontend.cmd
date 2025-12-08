@echo off
REM Run frontend tests only
node node_modules/jest/bin/jest.js frontend %*
