#!/bin/bash

echo ""
echo " ================================================"
echo "  Waypoints Editor"
echo " ================================================"
echo ""

# Перевірка Node.js
if ! command -v node &> /dev/null; then
    echo " [ПОМИЛКА] Node.js не знайдено!"
    echo ""
    echo " Встанови Node.js:"
    echo "   Ubuntu/Debian: sudo apt install nodejs"
    echo "   Або завантаж з https://nodejs.org"
    echo ""
    exit 1
fi

echo " Node.js знайдено. Запускаю сервер..."
echo ""
node server.cjs
