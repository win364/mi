# Mines Game - Vercel Deployment

Этот проект содержит игру Mines, адаптированную для развертывания на Vercel.

## Структура проекта

```
vercel-deploy/
├── mines-*.js            # API endpoints (в корне для Vercel)
│   ├── mines-user.js     # API пользователя
│   ├── mines-settings.js # Настройки игры
│   ├── mines-sessions.js # История сессий
│   ├── mines-session.js  # Создание сессии
│   ├── mines-round.js    # Обработка ходов
│   └── mines-session-id.js # Управление сессиями
├── game-logic.js         # Основная логика игры
├── manifest.js           # Web app manifest
├── mines/                # Игровой интерфейс
│   └── index.html        # Главная страница игры
├── index.html            # Обертка сайта
├── favicon.svg           # Иконка сайта
├── *.js                  # Статические JS файлы
├── *.css                 # Статические CSS файлы
├── *.svg, *.png, *.webp  # Медиа файлы
├── vercel.json           # Конфигурация Vercel
├── package.json          # Зависимости проекта
└── README.md            # Этот файл
```

## Как развернуть на Vercel

### Вариант 1: Через Vercel CLI

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Войдите в аккаунт Vercel:
```bash
vercel login
```

3. Перейдите в папку проекта:
```bash
cd vercel-deploy
```

4. Разверните проект:
```bash
vercel
```

5. Следуйте инструкциям в терминале.

### Вариант 2: Через веб-интерфейс Vercel

1. Зайдите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Подключите ваш GitHub репозиторий
4. Выберите папку `vercel-deploy` как корневую
5. Нажмите "Deploy"

### Вариант 3: Drag & Drop

1. Зайдите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Перетащите папку `vercel-deploy` в браузер
4. Нажмите "Deploy"

## API Endpoints

После развертывания будут доступны следующие API:

- `GET /mines/user` - Информация о пользователе
- `GET /mines/settings` - Настройки игры
- `GET /mines/sessions` - История игр
- `POST /mines/session` - Создать новую игру
- `PUT /mines/round` - Сделать ход
- `GET /mines/session/[id]` - Получить сессию
- `PUT /mines/session/[id]` - Забрать выигрыш
- `GET /manifest.json` - Web app manifest

## Особенности

- Игра работает полностью на serverless функциях
- Состояние игры хранится в памяти (сбрасывается при перезапуске)
- Поддержка CORS для всех API
- Адаптивный дизайн
- Русская локализация

## Локальная разработка

Для локальной разработки используйте Vercel CLI:

```bash
cd vercel-deploy
vercel dev
```

Это запустит локальный сервер с полной функциональностью Vercel.

## Примечания

- В production рекомендуется использовать базу данных для хранения состояния игры
- Текущая реализация использует in-memory хранилище
- Все API endpoints поддерживают CORS
- Игра полностью функциональна и готова к использованию
