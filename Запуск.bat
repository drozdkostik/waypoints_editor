@echo off
chcp 65001 >nul
title Waypoints Editor

echo.
echo  ================================================
echo   Waypoints Editor
echo  ================================================
echo.

:: Перевірка наявності Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ПОМИЛКА] Node.js не знайдено!
    echo.
    echo  Встанови Node.js з https://nodejs.org
    echo  (Вибери версію LTS)
    echo.
    pause
    exit /b 1
)

echo  Node.js знайдено. Запускаю сервер...
echo.
node server.cjs

pause
