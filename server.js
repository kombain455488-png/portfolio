require("dotenv").config();


const express =
    require("express");


const path =
    require("path");


const puppeteer =
    require("puppeteer");


const {
    generateOrderId,
    generateOrderCode
} =
    require("./utils/portfolio");


const {
    findMatchingDonation
} =
    require("./utils/donationalerts");


const {
    renderPortfolio
} =
    require("./views/portfolio-template");


const app =
    express();


const PORT =
    process.env.PORT ||
    10000;


/*
    Временное хранилище заказов.

    Для первой локальной версии
    этого достаточно.

    Перед публичным запуском
    заменим это на PostgreSQL.
*/

const orders =
    new Map();


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
    Главная
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
    (req, res) => {

        res.json({
            ok: true
        });

    }
);


/*
    Создание заказа
*/

app.post(
    "/api/orders",
    (req, res) => {

        try {

            const data =
                req.body;


            if (!data.name) {

                return res.status(400).json({
                    error:
                        "Имя обязательно."
                });

            }


            if (!data.profession) {

                return res.status(400).json({
                    error:
                        "Профессия обязательна."
                });

            }


            if (
                data.photo &&
                data.photo.length > 3_000_000
            ) {

                return res.status(400).json({
                    error:
                        "Фотография слишком большая."
                });

            }


            const orderId =
                generateOrderId();


            const orderCode =
                generateOrderCode();


            const order = {

                orderId,

                orderCode,

                portfolio:
                    data,

                paid:
                    false,

                createdAt:
                    Date.now(),

                donationId:
                    null

            };


            orders.set(
                orderId,
                order
            );


            res.json({

                ok: true,

                orderId,

                orderCode

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({

                error:
                    "Не удалось создать заказ."

            });

        }

    }
);


/*
    Проверка оплаты
*/

app.get(
    "/api/orders/:orderId/payment",
    async (req, res) => {

        try {

            const order =
                orders.get(
                    req.params.orderId
                );


            if (!order) {

                return res.status(404).json({

                    error:
                        "Заказ не найден."

                });

            }


            if (order.paid) {

                return res.json({

                    paid: true

                });

            }


            const age =
                Date.now() -
                order.createdAt;


            /*
                Заказ действует 2 часа.
            */

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
                Если DonationAlerts
                ещё не настроен,
                просто сообщаем, что
                оплату проверить нельзя.
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


            order.paid =
                true;


            order.donationId =
                donation.id;


            orders.set(
                order.orderId,
                order
            );


            return res.json({

                paid: true,

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
    Информация о заказе
*/

app.get(
    "/api/orders/:orderId",
    (req, res) => {

        const order =
            orders.get(
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

    }
);


/*
    Получить только оплаченный заказ
*/

function getPaidOrder(
    orderId
) {

    const order =
        orders.get(
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
    Скачать HTML
*/

app.get(
    "/download/:orderId/html",
    (req, res) => {

        const order =
            getPaidOrder(
                req.params.orderId
            );


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

    }
);


/*
    Скачать PDF
*/

app.get(
    "/download/:orderId/pdf",
    async (req, res) => {

        const order =
            getPaidOrder(
                req.params.orderId
            );


        if (!order) {

            return res.status(403).send(
                "Оплата не подтверждена."
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
                    waitUntil:
                        "networkidle0"
                }
            );


            const pdf =
                await page.pdf({

                    format:
                        "A4",

                    printBackground:
                        true,

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
    Запускаем сервер
*/

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
            `Local URL: http://localhost:${PORT}`
        );

        console.log("");

    }
);
