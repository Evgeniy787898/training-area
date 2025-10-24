#!/bin/bash

# Training Bot - Setup Script
# Автоматическая настройка проекта

echo "🚀 Training Bot - Автоматическая настройка"
echo "=========================================="
echo ""

# Проверка Node.js
echo "📦 Проверка Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js с https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js установлен: $NODE_VERSION"
echo ""

# Настройка .env для сервера
echo "⚙️  Настройка переменных окружения..."
cd server

if [ -f ".env" ]; then
    echo "⚠️  Файл .env уже существует. Создаю резервную копию..."
    cp .env .env.backup
fi

# Копируем конфигурацию
cp env.config.txt .env
echo "✅ Файл .env создан"
echo ""

# Установка зависимостей сервера
echo "📦 Установка зависимостей сервера..."
npm install
echo "✅ Зависимости сервера установлены"
echo ""

# Возвращаемся в корень
cd ..

# Установка зависимостей webapp
echo "📦 Установка зависимостей WebApp..."
cd webapp
npm install
echo "✅ Зависимости WebApp установлены"
echo ""

cd ..

echo "=========================================="
echo "✅ Установка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Примените SQL миграцию в Supabase:"
echo "   - Откройте https://supabase.com/dashboard/project/buqjktrypviesnucczjr/sql/new"
echo "   - Скопируйте содержимое файла:"
echo "     server/supabase/migrations/20240101000000_initial_schema.sql"
echo "   - Выполните SQL запрос"
echo ""
echo "2. Получите anon_key от Supabase:"
echo "   - Откройте https://supabase.com/dashboard/project/buqjktrypviesnucczjr/settings/api"
echo "   - Скопируйте 'anon public' ключ"
echo "   - Вставьте в server/.env (замените your_anon_key_here)"
echo ""
echo "3. Запустите бота:"
echo "   cd server"
echo "   npm run dev"
echo ""
echo "4. Найдите бота в Telegram и отправьте /start"
echo ""
echo "🎉 Готово к запуску!"

