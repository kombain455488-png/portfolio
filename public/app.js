const form =
    document.getElementById(
        "portfolioForm"
    );


const previewContainer =
    document.getElementById(
        "previewContainer"
    );


const paymentPanel =
    document.getElementById(
        "paymentPanel"
    );


const orderCodeElement =
    document.getElementById(
        "orderCode"
    );


const checkPaymentButton =
    document.getElementById(
        "checkPaymentButton"
    );


const paymentStatus =
    document.getElementById(
        "paymentStatus"
    );


let currentOrderId = null;


function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function readPhoto(file) {

    return new Promise(
        (resolve, reject) => {

            if (!file) {

                resolve("");

                return;

            }


            if (
                file.size >
                2 * 1024 * 1024
            ) {

                reject(
                    new Error(
                        "Фотография должна быть меньше 2 MB."
                    )
                );

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                () => resolve(
                    reader.result
                );


            reader.onerror =
                reject;


            reader.readAsDataURL(file);

        }
    );

}


async function collectPortfolioData() {

    const photo =
        await readPhoto(
            document
                .getElementById("photo")
                .files[0]
        );


    return {

        name:
            document
                .getElementById("name")
                .value
                .trim(),

        profession:
            document
                .getElementById("profession")
                .value
                .trim(),

        location:
            document
                .getElementById("location")
                .value
                .trim(),

        about:
            document
                .getElementById("about")
                .value
                .trim(),

        skills:
            document
                .getElementById("skills")
                .value
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean),

        experience:
            document
                .getElementById("experience")
                .value
                .trim(),

        education:
            document
                .getElementById("education")
                .value
                .trim(),

        projects:
            document
                .getElementById("projects")
                .value
                .trim(),

        email:
            document
                .getElementById("email")
                .value
                .trim(),

        phone:
            document
                .getElementById("phone")
                .value
                .trim(),

        website:
            document
                .getElementById("website")
                .value
                .trim(),

        linkedin:
            document
                .getElementById("linkedin")
                .value
                .trim(),

        github:
            document
                .getElementById("github")
                .value
                .trim(),

        photo

    };

}


function showPreview(data) {

    const skills =
        data.skills
            .map(
                skill =>
                    `
                    <span class="skill">
                        ${escapeHtml(skill)}
                    </span>
                    `
            )
            .join("");


    const photo =
        data.photo

            ? `
                <img
                    class="preview-photo"
                    src="${data.photo}"
                    alt=""
                >
              `

            : `
                <div class="preview-photo"></div>
              `;


    previewContainer.innerHTML = `

        <div class="portfolio-preview">

            <div class="preview-content">

                <div class="preview-profile">

                    ${photo}

                    <div>

                        <h2 class="preview-name">
                            ${escapeHtml(data.name)}
                        </h2>

                        <div class="preview-profession">
                            ${escapeHtml(data.profession)}
                        </div>

                        ${
                            data.location
                                ? `
                                    <div class="preview-location">
                                        ${escapeHtml(data.location)}
                                    </div>
                                  `
                                : ""
                        }

                    </div>

                </div>


                ${
                    data.about
                        ? `
                            <section class="preview-section">

                                <h3>
                                    About
                                </h3>

                                <p>
                                    ${escapeHtml(data.about)}
                                </p>

                            </section>
                          `
                        : ""
                }


                ${
                    data.skills.length
                        ? `
                            <section class="preview-section">

                                <h3>
                                    Skills
                                </h3>

                                <div class="skill-list">
                                    ${skills}
                                </div>

                            </section>
                          `
                        : ""
                }


                ${
                    data.experience
                        ? `
                            <section class="preview-section">

                                <h3>
                                    Experience
                                </h3>

                                <p>
                                    ${escapeHtml(data.experience)}
                                </p>

                            </section>
                          `
                        : ""
                }


                ${
                    data.education
                        ? `
                            <section class="preview-section">

                                <h3>
                                    Education
                                </h3>

                                <p>
                                    ${escapeHtml(data.education)}
                                </p>

                            </section>
                          `
                        : ""
                }


                ${
                    data.projects
                        ? `
                            <section class="preview-section">

                                <h3>
                                    Projects
                                </h3>

                                <p>
                                    ${escapeHtml(data.projects)}
                                </p>

                            </section>
                          `
                        : ""
                }


                <section class="preview-section">

                    <h3>
                        Contact
                    </h3>

                    <div class="preview-links">

                        ${
                            data.email
                                ? `
                                    <a href="#">
                                        ${escapeHtml(data.email)}
                                    </a>
                                  `
                                : ""
                        }

                        ${
                            data.website
                                ? `
                                    <a href="#">
                                        Website
                                    </a>
                                  `
                                : ""
                        }

                        ${
                            data.linkedin
                                ? `
                                    <a href="#">
                                        LinkedIn
                                    </a>
                                  `
                                : ""
                        }

                        ${
                            data.github
                                ? `
                                    <a href="#">
                                        GitHub
                                    </a>
                                  `
                                : ""
                        }

                    </div>

                </section>

            </div>

        </div>

    `;

}


form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        try {

            const data =
                await collectPortfolioData();


            showPreview(data);


            const response =
                await fetch(
                    "/api/orders",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(data)

                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Не удалось создать заказ."
                );

            }


            currentOrderId =
                result.orderId;


            orderCodeElement.textContent =
                result.orderCode;


            paymentPanel
                .classList
                .remove("hidden");


            localStorage.setItem(
                "portfolioOrder",
                JSON.stringify({
                    orderId:
                        result.orderId,

                    orderCode:
                        result.orderCode
                })
            );


            paymentPanel.scrollIntoView({
                behavior: "smooth"
            });


        } catch (error) {

            alert(
                error.message
            );

        }

    }
);


async function checkPayment() {

    if (!currentOrderId) {

        return;

    }


    paymentStatus.textContent =
        "Проверяем оплату...";


    checkPaymentButton.disabled =
        true;


    try {

        const response =
            await fetch(
                `/api/orders/${encodeURIComponent(currentOrderId)}/payment`
            );


        const result =
            await response.json();


        if (result.paid) {

            paymentStatus.textContent =
                "Оплата подтверждена ✓";


            setTimeout(
                () => {

                    window.location.href =
                        `/success.html?order=${encodeURIComponent(currentOrderId)}`;

                },
                700
            );


            return;

        }


        if (result.expired) {

            paymentStatus.textContent =
                "Срок действия заказа истёк.";

            return;

        }


        paymentStatus.textContent =
            "Оплата пока не найдена. Подожди немного и попробуй снова.";

    } catch (error) {

        paymentStatus.textContent =
            "Не удалось проверить оплату.";

    } finally {

        checkPaymentButton.disabled =
            false;

    }

}


checkPaymentButton.addEventListener(
    "click",
    checkPayment
);
