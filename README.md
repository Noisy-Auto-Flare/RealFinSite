# FinTracker — Личный финансовый учёт

Self-hosted веб-приложение для учёта личных финансов с поддержкой криптовалют, мультивалютных счетов, авто-сканирования блокчейн-кошельков и интеграции с биржами.

## Возможности

- **Мультивалютные счета** — на одном счёте может быть несколько валютных остатков (RUB, USD, USDT, SOL, CNY и др.)
- **Поддержка криптовалют** — создавайте криптокошельки с несколькими адресами (Solana, BSC, Avalanche, TON, Ethereum)
- **Авто-сканирование** — автоматическое получение транзакций с блокчейн-адресов (EVM, Solana, TON)
- **Интеграция с биржами** — Bybit API (read-only) для автоматической синхронизации балансов и истории
- **Обменные операции** — конвертация валют внутри одного счёта или между счетами (включая сложные сценарии: рубли → маме → Alipay в юанях)
- **Пошаговый ввод операций** — интерактивный опросник: тип операции → счёт → валюта → сумма → категория
- **Связывание транзакций** — автоматическое обнаружение внутренних переводов между своими счетами (например, вывод с Bybit и приход на OKX)
- **Мультипользовательский режим** — регистрация с подтверждением мастер-аккаунтом
- **Кеш курсов валют** — автоматическое получение курсов через CoinGecko
- **Сводка и аналитика** — общий капитал, распределение по валютам, доходы/расходы по категориям
- **Docker + NGINX** — готов к деплою на собственный сервер

## Технологический стек

| Компонент | Технология |
|---|---|
| Фронтенд | Next.js 15 (App Router) + React + Tailwind CSS v4 |
| База данных | SQLite через Drizzle ORM |
| Аутентификация | NextAuth.js v5 (Credentials, JWT) |
| Фоновые задачи | node-cron |
| Курсы валют | CoinGecko API |
| Контейнеризация | Docker + Docker Compose |
| Веб-сервер | NGINX (reverse proxy) |

## Быстрый старт

### Предварительные требования

- Node.js 20+
- Docker и Docker Compose (для продакшена)

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Создать .env из .env.example
cp .env.example .env
# Отредактируйте .env: установите MASTER_USERNAME, MASTER_PASSWORD, AUTH_SECRET

# Создание базы данных и мастер-аккаунта
npx tsx src/db/seed.ts

# После обновления кода — применить миграции схемы БД
npx tsx src/db/migrate.ts

# Запуск в режиме разработки
npm run dev
```

### Запуск через Docker

```bash
# Создать .env (пример в .env.example)
# Запустить
docker compose up -d --build

# Сервис будет доступен на http://localhost:8082
# Настройте NGINX для проброса на ваш домен
```

### Настройка NGINX

```nginx
server {
    listen 80;
    server_name fintracker.ru www.fintracker.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fintracker.ru www.fintracker.ru;

    ssl_certificate     /etc/nginx/ssl/fintracker.ru/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/fintracker.ru/certificate.key;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Структура проекта

```
fintracker/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Страницы входа и регистрации
│   │   ├── (dashboard)/      # Основные страницы (дашборд, счета, история, сводка)
│   │   └── api/              # API эндпоинты
│   ├── components/
│   │   ├── ui/               # UI компоненты
│   │   └── Navbar.tsx        # Навигация + кнопка новой операции
│   ├── db/
│   │   ├── schema.ts         # Drizzle ORM схема
│   │   ├── index.ts          # Подключение к БД
│   │   └── seed.ts           # Создание мастер-аккаунта
│   ├── lib/
│   │   ├── scanners/         # Модули сканирования блокчейнов
│   │   ├── utils.ts          # Утилиты (форматирование, авторизация)
│   │   └── ...
│   ├── auth.ts               # NextAuth конфигурация
│   └── test/                 # Тесты
├── data/                     # SQLite БД (создаётся автоматически)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API

| Endpoint | Метод | Описание |
|---|---|---|
| `/api/accounts` | GET / POST | Список счетов / Создать счёт |
| `/api/accounts/[id]` | GET / PATCH / DELETE | Детали / Редактировать / Удалить |
| `/api/transactions` | GET / POST | Список операций / Создать операцию |
| `/api/transactions/[id]` | PATCH / DELETE | Редактировать / Удалить операцию |
| `/api/balances` | GET | Все балансы пользователя |
| `/api/stats/summary` | GET | Сводка капитала |
| `/api/register` | POST | Регистрация нового пользователя |
| `/api/admin/users` | GET / PATCH | Управление пользователями (только мастер) |

## Дорожная карта

### Фаза 0 ✅ (Фундамент)
- [x] База данных (Drizzle + SQLite)
- [x] Аутентификация (next-auth, мастер-аккаунт)
- [x] CRUD для счетов
- [x] Ручной ввод операций (пошаговая форма)
- [x] Дашборд, история, сводка
- [x] Docker + NGINX

### Фаза 1 (Курсы + Мультивалютность)
- [ ] Модуль CoinGecko (кеш курсов)
- [ ] Пересчёт капитала в RUB/USD
- [ ] Страница аналитики

### Фаза 2 (EVM-сканер + Matcher)
- [ ] EVM-сканер (BSC, Avalanche, Ethereum)
- [ ] Фоновый cron
- [ ] Matcher (авто-связывание транзакций)
- [ ] UI для подтверждения связей

### Фаза 3 (Solana, TON сканеры)
- [ ] Solana-сканер
- [ ] TON-сканер

### Фаза 4 (Bybit API)
- [ ] Bybit APi (read-only)
- [ ] Синхронизация балансов и истории

### Фаза 5 (Полировка)
- [ ] Категории операций
- [ ] CSV-импорт
- [ ] Расширенные графики
- [ ] Уведомления

## Лицензия

MIT
