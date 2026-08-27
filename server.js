require("dotenv").config();

const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer");
const { Pool } = require("pg");

const {
    getAuthorizationUrl,
    exchangeCodeForTokens
} = require("./utils/donationalerts-oauth");

const {
    generateOrderId,
    generateOrderCode
} = require("./utils/portfolio");

const {
    findMatchingDonation
} = require("./utils/donationalerts");

const {
    renderPortfolio
} = require("./views/portfolio-template");


const app = express();

const PORT =
    process.env.PORT || 10000;


/*
    PostgreSQL
*/

const pool =
    process.env.DATABASE_URL
        ? new Pool({
            connectionString:
                process.env.DATABASE_URL,

            max: 5,

            idleTimeoutMillis:
                30000,

            connectionTimeoutMillis:
                10000
        })
        : null;


/*
    Создание таблицы заказов.
*/

async function initDatabase() {

    if (!pool) {

        console.log(
            "DATABASE_URL не задан. PostgreSQL отключена."
        );

        return;
    }


    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            order_code TEXT UNIQUE NOT NULL,
            portfolio JSONB NOT NULL,
            paid BOOLEAN NOT NULL DEFAULT FALSE,
            created_at BIGINT NOT NULL,
            donation_id TEXT
        );
    `);


    console.log(
        "PostgreSQL connected."
    );

}


/*
    Middleware
*/

app.use(
    express.json({
        limit: "5mb"
    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/*
    Главная страница
*/

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/*
    Проверка сервера
*/

app.get(
    "/health",
    async (req, res) => {

        try {

            if (pool) {

                await pool.query(
                    "SELECT 1"
                );

            }


            res.json({
                ok: true
            });


        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({
                ok: false
            });

        }

    }
);


/*
    ==========================================
    DONATIONALERTS OAUTH
    ==========================================
*/


/*
    Начало авторизации DonationAlerts.

    Открывается:
    /api/donationalerts/connect
*/

app.get(
    "/api/donationalerts/connect",
    (req, res) => {

        try {

            const url =
                getAuthorizationUrl();


            res.redirect(
                url
            );


        } catch (error) {

            console.error(
                "DonationAlerts connect error:",
                error
            );


            res.status(500).send(
                "Не удалось начать авторизацию DonationAlerts."
            );

        }

    }
);


/*
    Callback DonationAlerts.

    DonationAlerts отправит пользователя сюда
    после разрешения доступа.
*/

app.get(
    "/api/donationalerts/callback",
    async (req, res) => {

        try {

            /*
                Пользователь отказал
                в доступе.
            */

            if (req.query.error) {

                return res.status(400).send(
                    `
                    <!doctype html>

                    <html lang="ru">

                    <head>
                        <meta charset="UTF-8">
                        <title>DonationAlerts</title>
                    </head>

                    <body>

                        <h1>Авторизация отменена</h1>

                        <p>
                            DonationAlerts не предоставил доступ.
                        </p>

                        <p>
                            Код ошибки:
                            ${String(req.query.error)}
                        </p>

                    </body>

                    </html>
                    `
                );

            }


            /*
                Получаем authorization code.
            */

            const code =
                req.query.code;


            if (!code) {

                return res.status(400).send(
                    `
                    <h1>Ошибка</h1>
                    <p>
                        DonationAlerts не вернул authorization code.
                    </p>
                    `
                );

            }


            /*
                Обмениваем code
                на access_token и refresh_token.
            */

            const tokens =
                await exchangeCodeForTokens(
                    code
                );


            /*
                Проверяем, что access token получен.
            */

            if (
                !tokens ||
                !tokens.access_token
            ) {

                console.error(
                    "DonationAlerts token response:",
                    tokens
                );


                return res.status(500).send(
                    `
                    <h1>Ошибка получения токена</h1>

                    <p>
                        DonationAlerts не вернул access_token.
                    </p>

                    <p>
                        Проверь Render Logs.
                    </p>
                    `
                );

            }


            /*
                ВАЖНО.

                На этом этапе токены НЕ записываем
                в GitHub и НЕ помещаем в код.
            */

            console.log(
                "DonationAlerts OAuth успешно завершён."
            );


            console.log(
                "Access token получен:",
                Boolean(tokens.access_token)
            );


            console.log(
                "Refresh token получен:",
                Boolean(tokens.refresh_token)
            );


            /*
                Для первого подключения показываем
                токены владельцу сайта.

                НЕ отправляй эту страницу другим людям.
            */

            const accessToken =
                String(
                    tokens.access_token
                );


            const refreshToken =
                String(
                    tokens.refresh_token || ""
                );


            res.send(
                `
                <!doctype html>

                <html lang="ru">

                <head>

                    <meta charset="UTF-8">

                    <meta name="viewport"
                          content="width=device-width, initial-scale=1">

                    <title>
                        DonationAlerts подключён
                    </title>

                    <style>

                        body {
                            font-family:
                                Arial,
                                sans-serif;

                            background:
                                #111;

                            color:
                                #fff;

                            max-width:
                                900px;

                            margin:
                                40px auto;

                            padding:
                                20px;
                        }

                        .box {
                            background:
                                #1f1f1f;

                            border-radius:
                                14px;

                            padding:
                                24px;

                            margin-bottom:
                                20px;
                        }

                        .token {
                            display:
                                block;

                            background:
                                #000;

                            border:
                                1px solid #444;

                            border-radius:
                                8px;

                            padding:
                                14px;

                            margin-top:
                                10px;

                            word-break:
                                break-all;

                            user-select:
                                all;

                            font-family:
                                monospace;
                        }

                        .warning {
                            color:
                                #ffb84d;
                        }

                        h1 {
                            margin-top:
                                0;
                        }

                    </style>

                </head>

                <body>

                    <div class="box">

                        <h1>
                            ✅ DonationAlerts подключён
                        </h1>

                        <p>
                            Авторизация прошла успешно.
                        </p>

                    </div>


                    <div class="box">

                        <h2>
                            1. Access Token
                        </h2>

                        <p>
                            Добавь это значение в Render:
                        </p>

                        <div class="token">
                            ${escapeHtml(accessToken)}
                        </div>

                        <p>
                            Переменная:
                        </p>

                        <div class="token">
                            DONATION_ALERTS_ACCESS_TOKEN
                        </div>

                    </div>


                    <div class="box">

                        <h2>
                            2. Refresh Token
                        </h2>

                        <p>
                            Добавь это значение в Render:
                        </p>

                        <div class="token">
                            ${escapeHtml(refreshToken)}
                        </div>

                        <p>
                            Переменная:
                        </p>

                        <div class="token">
                            DONATION_ALERTS_REFRESH_TOKEN
                        </div>

                    </div>


                    <div class="box">

                        <p class="warning">
                            ⚠️ Никому не отправляй эти токены.
                        </p>

                        <p>
                            Не добавляй их в GitHub.
                        </p>

                        <p>
                            Добавляй их только в
                            Render → Environment Variables.
                        </p>

                    </div>

                </body>

                </html>
                `
            );


        } catch (error) {

            console.error(
                "DonationAlerts callback error:",
                error.response?.data ||
                error.message ||
                error
            );


            res.status(500).send(
                `
                <!doctype html>

                <html lang="ru">

                <head>
                    <meta charset="UTF-8">
                    <title>Ошибка</title>
                </head>

                <body>

                    <h1>
                        ❌ Не удалось подключить DonationAlerts
                    </h1>

                    <p>
                        Проверь Render Logs.
                    </p>

                </body>

                </html>
                `
            );

        }

    }
);


/*
    Экранирование HTML.
*/

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/*
    ==========================================
    СОЗДАНИЕ ЗАКАЗА
    ==========================================
*/

app.post(
    "/api/orders",
    async (req, res) => {

        try {

            const data =
                req.body;


            /*
                Проверяем имя.
            */

            if (!data.name) {

                return res.status(400).json({
                    error:
                        "Имя обязательно."
                });

            }


            /*
                Проверяем профессию.
            */

            if (!data.profession) {

                return res.status(400).json({
                    error:
                        "Профессия обязательна."
                });

            }


            /*
                Ограничиваем размер фотографии.
            */

            if (
                data.photo &&
                data.photo.length > 3_000_000
            ) {

                return res.status(400).json({
                    error:
                        "Фотография слишком большая."
                });

            }


            /*
                Создаём ID заказа.
            */

            const orderId =
                generateOrderId();


            /*
                Создаём код заказа.

                Именно этот код пользователь
                будет указывать при оплате.
            */

            const orderCode =
                generateOrderCode();


            const createdAt =
                Date.now();


            /*
                Сохраняем заказ
                в PostgreSQL.
            */

            if (pool) {

                await pool.query(
                    `
                    INSERT INTO orders
                    (
                        order_id,
                        order_code,
                        portfolio,
                        paid,
                        created_at,
                        donation_id
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3::jsonb,
                        false,
                        $4,
                        NULL
                    )
                    `,
                    [
                        orderId,

                        orderCode,

                        JSON.stringify(
                            data
                        ),

                        createdAt
                    ]
                );

            }


            /*
                Отправляем данные
                браузеру.
            */

            res.json({

                ok:
                    true,

                orderId:
                    orderId,

                orderCode:
                    orderCode

            });


        } catch (error) {

            console.error(
                "Create order error:",
                error
            );


            res.status(500).json({
                error:
                    "Не удалось создать заказ."
            });

        }

    }
);


/*
    ==========================================
    ПОЛУЧЕНИЕ ЗАКАЗА
    ==========================================
*/

async function getOrder(
    orderId
) {

    if (!pool) {

        return null;

    }


    const result =
        await pool.query(
            `
            SELECT
                order_id,
                order_code,
                portfolio,
                paid,
                created_at,
                donation_id

            FROM orders

            WHERE order_id = $1
            `,
            [
                orderId
            ]
        );


    if (
        result.rows.length === 0
    ) {

        return null;

    }


    const row =
        result.rows[0];


    return {

        orderId:
            row.order_id,

        orderCode:
            row.order_code,

        portfolio:
            row.portfolio,

        paid:
            row.paid,

        createdAt:
            Number(
                row.created_at
            ),

        donationId:
            row.donation_id

    };

}


/*
    ==========================================
    ПРОВЕРКА ОПЛАТЫ
    ==========================================
*/

app.get(
    "/api/orders/:orderId/payment",
    async (req, res) => {

        try {

            const order =
                await getOrder(
                    req.params.orderId
                );


            /*
                Заказ не найден.
            */

            if (!order) {

                return res.status(404).json({
                    error:
                        "Заказ не найден."
                });

            }


            /*
                Если уже оплачен —
                повторно DonationAlerts
                проверять не нужно.
            */

            if (order.paid) {

                return res.json({
                    paid:
                        true
                });

            }


            /*
                Заказ действует 2 часа.
            */

            const age =
                Date.now() -
                order.createdAt;


            if (
                age >
                2 * 60 * 60 * 1000
            ) {

                return res.json({

                    paid:
                        false,

                    expired:
                        true

                });

            }


            /*
                Проверяем наличие
                DonationAlerts Access Token.
            */

            if (
                !process.env
                    .DONATION_ALERTS_ACCESS_TOKEN
            ) {

                return res.json({

                    paid:
                        false,

                    notConfigured:
                        true

                });

            }


            /*
                Ищем донат,
                содержащий код заказа.
            */

            const donation =
                await findMatchingDonation(
                    order.orderCode
                );


            /*
                Донат пока не найден.
            */

            if (!donation) {

                return res.json({
                    paid:
                        false
                });

            }


            /*
                Донат найден.

                Помечаем заказ
                как оплаченный.
            */

            if (!pool) {

                return res.status(500).json({
                    error:
                        "PostgreSQL не подключена."
                });

            }


            await pool.query(
                `
                UPDATE orders

                SET
                    paid = true,
                    donation_id = $1

                WHERE order_id = $2
                `,
                [

                    String(
                        donation.id
                    ),

                    order.orderId

                ]
            );


            return res.json({

                paid:
                    true,

                donationId:
                    donation.id

            });


        } catch (error) {

            console.error(
                "Payment check error:",
                error
            );


            res.status(500).json({
                error:
                    "Ошибка проверки оплаты."
            });

        }

    }
);


/*
    ==========================================
    ИНФОРМАЦИЯ О ЗАКАЗЕ
    ==========================================
*/

app.get(
    "/api/orders/:orderId",
    async (req, res) => {

        try {

            const order =
                await getOrder(
                    req.params.orderId
                );


            if (!order) {

                return res.status(404).json({
                    error:
                        "Заказ не найден."
                });

            }


            res.json({

                orderId:
                    order.orderId,

                orderCode:
                    order.orderCode,

                paid:
                    order.paid

            });


        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({
                error:
                    "Ошибка получения заказа."
            });

        }

    }
);


/*
    ==========================================
    ПОЛУЧЕНИЕ ОПЛАЧЕННОГО ЗАКАЗА
    ==========================================
*/

async function getPaidOrder(
    orderId
) {

    const order =
        await getOrder(
            orderId
        );


    if (!order) {

        return null;

    }


    if (!order.paid) {

        return null;

    }


    return order;

}


/*
    ==========================================
    СКАЧАТЬ HTML
    ==========================================
*/

app.get(
    "/download/:orderId/html",
    async (req, res) => {

        try {

            const order =
                await getPaidOrder(
                    req.params.orderId
                );


            /*
                Защита от скачивания
                неоплаченным пользователем.
            */

            if (!order) {

                return res.status(403).send(
                    "Оплата не подтверждена."
                );

            }


            const html =
                renderPortfolio(
                    order.portfolio
                );


            res.setHeader(
                "Content-Type",
                "text/html; charset=utf-8"
            );


            res.setHeader(
                "Content-Disposition",
                `attachment; filename="portfolio-${order.orderCode}.html"`
            );


            res.send(
                html
            );


        } catch (error) {

            console.error(
                error
            );


            res.status(500).send(
                "Не удалось подготовить HTML."
            );

        }

    }
);


/*
    ==========================================
    СКАЧАТЬ PDF
    ==========================================
*/

app.get(
    "/download/:orderId/pdf",
    async (req, res) => {

        const order =
            await getPaidOrder(
                req.params.orderId
            );


        /*
            Защита от скачивания
            неоплаченным пользователем.
        */

        if (!order) {

            return res.status(403).send(
                "Оплата не подтверждена."
            );

        }


        let browser;


        try {

            /*
                Создаём HTML портфолио.
            */

            const html =
                renderPortfolio(
                    order.portfolio
                );


            /*
                Запускаем Chromium.
            */

            browser =
                await puppeteer.launch({

                    headless:
                        true,

                    args: [

                        "--no-sandbox",

                        "--disable-setuid-sandbox"

                    ]

                });


            const page =
                await browser.newPage();


            /*
                Загружаем HTML.
            */

            await page.setContent(
                html,
                {
                    waitUntil:
                        "networkidle0"
                }
            );


            /*
                Генерируем PDF.
            */

            const pdf =
                await page.pdf({

                    format:
                        "A4",

                    printBackground:
                        true,

                    margin: {

                        top:
                            "0",

                        right:
                            "0",

                        bottom:
                            "0",

                        left:
                            "0"

                    }

                });


            await browser.close();

            browser =
                null;


            /*
                Отправляем PDF.
            */

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );


            res.setHeader(
                "Content-Disposition",
                `attachment; filename="portfolio-${order.orderCode}.pdf"`
            );


            res.send(
                pdf
            );


        } catch (error) {

            if (browser) {

                try {

                    await browser.close();

                } catch {}

            }


            console.error(
                "PDF error:",
                error
            );


            res.status(500).send(
                "Не удалось создать PDF."
            );

        }

    }
);


/*
    ==========================================
    ЗАПУСК СЕРВЕРА
    ==========================================
*/

async function startServer() {

    try {

        await initDatabase();


        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log("");

                console.log(
                    "============================================"
                );

                console.log(
                    " Portfolio Builder started!"
                );

                console.log(
                    "============================================"
                );

                console.log("");

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log("");

            }
        );


    } catch (error) {

        console.error(
            "Database startup error:",
            error
        );


        process.exit(
            1
        );

    }

}


startServer();