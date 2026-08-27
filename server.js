require("dotenv").config();

const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer");
const { Pool } = require("pg");

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

const PORT = process.env.PORT || 10000;

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    })
    : null;


/*
    Создание таблицы заказов.
*/

async function initDatabase() {

    if (!pool) {
        console.log("DATABASE_URL не задан. PostgreSQL отключена.");
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

    console.log("PostgreSQL connected.");
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
        path.join(__dirname, "public")
    )
);


/*
    лавная
*/

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/*
    роверка сервера
*/

app.get("/health", async (req, res) => {

    try {

        if (pool) {
            await pool.query("SELECT 1");
        }

        res.json({
            ok: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            ok: false
        });

    }

});


/*
    Создание заказа
*/

app.post("/api/orders", async (req, res) => {

    try {

        const data = req.body;

        if (!data.name) {

            return res.status(400).json({
                error: "мя обязательно."
            });

        }

        if (!data.profession) {

            return res.status(400).json({
                error: "рофессия обязательна."
            });

        }

        if (
            data.photo &&
            data.photo.length > 3_000_000
        ) {

            return res.status(400).json({
                error: "Фотография слишком большая."
            });

        }

        const orderId =
            generateOrderId();

        const orderCode =
            generateOrderCode();

        const createdAt =
            Date.now();


        /*
            PostgreSQL
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
                ($1, $2, $3::jsonb, false, $4, NULL)
                `,
                [
                    orderId,
                    orderCode,
                    JSON.stringify(data),
                    createdAt
                ]
            );

        }


        res.json({
            ok: true,
            orderId,
            orderCode
        });


    } catch (error) {

        console.error(
            "Create order error:",
            error
        );

        res.status(500).json({
            error: "е удалось создать заказ."
        });

    }

});


/*
    олучение заказа из PostgreSQL
*/

async function getOrder(orderId) {

    if (!pool) {
        return null;
    }

    const result = await pool.query(
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
        [orderId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    return {
        orderId: row.order_id,
        orderCode: row.order_code,
        portfolio: row.portfolio,
        paid: row.paid,
        createdAt: Number(row.created_at),
        donationId: row.donation_id
    };

}


/*
    роверка оплаты
*/

app.get(
    "/api/orders/:orderId/payment",
    async (req, res) => {

        try {

            const order =
                await getOrder(
                    req.params.orderId
                );


            if (!order) {

                return res.status(404).json({
                    error: "аказ не найден."
                });

            }


            if (order.paid) {

                return res.json({
                    paid: true
                });

            }


            /*
                аказ действует 2 часа.
            */

            const age =
                Date.now() -
                order.createdAt;


            if (
                age >
                2 * 60 * 60 * 1000
            ) {

                return res.json({
                    paid: false,
                    expired: true
                });

            }


            /*
                DonationAlerts пока не настроен.
            */

            if (
                !process.env
                    .DONATION_ALERTS_ACCESS_TOKEN
            ) {

                return res.json({
                    paid: false,
                    notConfigured: true
                });

            }


            const donation =
                await findMatchingDonation(
                    order.orderCode
                );


            if (!donation) {

                return res.json({
                    paid: false
                });

            }


            /*
                тмечаем заказ оплаченным.
            */

            await pool.query(
                `
                UPDATE orders
                SET
                    paid = true,
                    donation_id = $1
                WHERE order_id = $2
                `,
                [
                    String(donation.id),
                    order.orderId
                ]
            );


            return res.json({
                paid: true,
                donationId: donation.id
            });


        } catch (error) {

            console.error(
                "Payment check error:",
                error
            );

            res.status(500).json({
                error: "шибка проверки оплаты."
            });

        }

    }
);


/*
    нформация о заказе
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
                    error: "аказ не найден."
                });

            }


            res.json({
                orderId: order.orderId,
                orderCode: order.orderCode,
                paid: order.paid
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "шибка получения заказа."
            });

        }

    }
);


/*
    олучить только оплаченный заказ
*/

async function getPaidOrder(orderId) {

    const order =
        await getOrder(orderId);

    if (!order) {
        return null;
    }

    if (!order.paid) {
        return null;
    }

    return order;

}


/*
    Скачать HTML
*/

app.get(
    "/download/:orderId/html",
    async (req, res) => {

        try {

            const order =
                await getPaidOrder(
                    req.params.orderId
                );


            if (!order) {

                return res.status(403).send(
                    "плата не подтверждена."
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

            res.send(html);


        } catch (error) {

            console.error(error);

            res.status(500).send(
                "е удалось подготовить HTML."
            );

        }

    }
);


/*
    Скачать PDF
*/

app.get(
    "/download/:orderId/pdf",
    async (req, res) => {

        const order =
            await getPaidOrder(
                req.params.orderId
            );


        if (!order) {

            return res.status(403).send(
                "плата не подтверждена."
            );

        }


        let browser;


        try {

            const html =
                renderPortfolio(
                    order.portfolio
                );


            browser =
                await puppeteer.launch({
                    headless: true,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox"
                    ]
                });


            const page =
                await browser.newPage();


            await page.setContent(
                html,
                {
                    waitUntil: "networkidle0"
                }
            );


            const pdf =
                await page.pdf({
                    format: "A4",
                    printBackground: true,
                    margin: {
                        top: "0",
                        right: "0",
                        bottom: "0",
                        left: "0"
                    }
                });


            await browser.close();


            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="portfolio-${order.orderCode}.pdf"`
            );

            res.send(pdf);


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
                "е удалось создать PDF."
            );

        }

    }
);


/*
    апуск сервера
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

        process.exit(1);

    }

}


startServer();
