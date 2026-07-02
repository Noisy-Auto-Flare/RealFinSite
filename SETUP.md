# Настройка FinTracker

## Файл `.env`

Скопируйте `.env.example` в `.env` и заполните значения.

```
cp .env.example .env
```

### Обязательные переменные

| Переменная | Описание | Где взять |
|---|---|---|
| `MASTER_USERNAME` | Логин главного администратора | Придумайте сами |
| `MASTER_PASSWORD` | Пароль главного администратора | Придумайте сами |
| `AUTH_SECRET` | Секрет для JWT (минимум 32 символа) | `openssl rand -base64 32` или любой генератор |
| `ENCRYPTION_KEY` | Ключ для шифрования API-ключей бирж в БД (32 символа) | `openssl rand -base64 32` или строка из 32 символов |

### API-ключи для сканеров блокчейнов

Эти ключи **не обязательны**, но без них не будет работать авто-сканирование соответствующих сетей.
Каждый пользователь (не только администратор) может добавить свои адреса кошельков; сканирование использует единый API-ключ из `.env`.

| Переменная | Сервис | Где взять | Бесплатный лимит |
|---|---|---|---|
| `BSCSCAN_API_KEY` | BscScan (BSC) | https://bscscan.com → Sign Up → API Keys → Create API Key | 5 запросов/сек, 100k/день |
| `ETHERSCAN_API_KEY` | EtherScan (Ethereum) | https://etherscan.io → Sign Up → API Keys → Create API Key | 5 запросов/сек, 100k/день |
| `SNOWTRACE_API_KEY` | SnowTrace (Avalanche) | https://snowtrace.io → Sign Up → API Keys → Create API Key | 5 запросов/сек, 100k/день |
| `HELIUS_API_KEY` | Helius (Solana) | https://helius.dev → Sign Up → Dashboard → API Key | 25k запросов/месяц |
| `TONCENTER_API_KEY` | TonCenter (TON) | https://toncenter.com → API → получить ключ в Telegram @toncenter_bot | Безлимитно с ключом |
| `COINGECKO_API_KEY` | CoinGecko (курсы) | https://www.coingecko.com/en/api → Demo (бесплатно) | 10-30 запросов/мин |

### Как получить каждый ключ

#### BscScan / EtherScan / SnowTrace (EVM-эксплореры)

1. Зарегистрируйтесь на сайте эксплорера
2. Перейдите в раздел **API Keys**
3. Нажмите **Create API Key** → выберите бесплатный план
4. Скопируйте ключ в `.env`

#### Helius (Solana)

1. Зайдите на https://helius.dev
2. Зарегистрируйтесь через GitHub
3. В **Dashboard** → **API Keys** скопируйте ключ
4. Вставьте в `HELIUS_API_KEY`

#### TonCenter (TON)

1. Откройте Telegram: https://t.me/toncenter_bot
2. Отправьте команду `/start` и следуйте инструкциям
3. Бот выдаст API-ключ — скопируйте его
4. Вставьте в `TONCENTER_API_KEY`

#### CoinGecko (курсы криптовалют)

1. Зайдите на https://www.coingecko.com/en/api
2. Нажмите **Subscribe for Free** — бесплатный Demo-план
3. Получите API-ключ и вставьте в `COINGECKO_API_KEY`
4. **Без ключа** тоже работает, но с лимитом 10-30 запросов/мин

### API-ключи бирж (для авто-синхронизации)

Эти ключи вводятся **в интерфейсе сайта** при создании или настройке счёта (каждый пользователь вводит свои).
Ключи шифруются (`ENCRYPTION_KEY`) и хранятся в базе данных.
На сервере (в `.env`) эти переменные не используются.

| Биржа | Где взять API-ключи | Необходимые права |
|---|---|---|
| **Bybit** | https://www.bybit.com → API Management → Create Key | **Read-only** (достаточно для балансов и истории) |
| **OKX** | https://www.okx.com → API → Create API Key | **Read-only** (достаточно для балансов и истории) |

#### Bybit

1. Войдите в аккаунт Bybit
2. Перейдите: **Аккаунт** → **API Management** (или https://www.bybit.com/user/api-management)
3. Нажмите **Create New Key**
4. Выберите **System Generated** (рекомендуется)
5. Настройте разрешения: **Read-Wallet**, **Read-Order**, **Read-Asset**
   Обязательно **снимите** галочки с Write/Withdraw/Trade (read-only)
6. Установите IP-ограничения: укажите IP вашего сервера или оставьте без ограничений
7. Нажмите **Confirm** и пройдите 2FA
8. Скопируйте **API Key** и **Secret** — секрет показывается **один раз**
9. На сайте FinTracker: Создайте счёт типа **Биржа (CEX)** → выберите **Автоматический** → Bybit → вставьте ключи

#### OKX

1. Войдите в аккаунт OKX
2. Перейдите: **Аккаунт** → **API** (https://www.okx.com/account/api)
3. Нажмите **Create API Key**
4. Выберите **Read-only** (только чтение)
5. Укажите название (например "FinTracker")
6. Настройте разрешения: **Read balance**, **Read order**, **Read asset history**
7. Установите IP-ограничения или оставьте пустыми
8. Нажмите **Confirm** и пройдите 2FA
9. Скопируйте **API Key** и **Secret**
10. На сайте FinTracker: Создайте счёт типа **Биржа (CEX)** → выберите **Автоматический** → OKX → вставьте ключи

## Docker

### Сборка и запуск

```bash
docker compose build --no-cache
docker compose up -d
```

### Переменные в docker-compose.yml

Убедитесь, что в `docker-compose.yml` проброшены все переменные из `.env`.
По умолчанию они импортируются из `.env`-файла автоматически.

## Проверка

1. Откройте `http://localhost:8082` (или ваш порт)
2. Войдите как `MASTER_USERNAME` / `MASTER_PASSWORD`
3. Создайте счета, подключите API-ключи бирж
4. Настройте сканеры блокчейнов (добавьте адреса кошельков)
5. Запустите синхронизацию вручную или дождитесь авто-скана (каждые 30 мин)
