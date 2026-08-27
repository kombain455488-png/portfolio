function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function renderSkills(skills = []) {

    return skills
        .map(
            skill =>
                `
                <span class="skill">
                    ${escapeHtml(skill)}
                </span>
                `
        )
        .join("");

}


function renderSection(
    title,
    content
) {

    if (!content) {

        return "";

    }


    return `

        <section class="section">

            <h2>
                ${title}
            </h2>

            <div class="section-content">
                ${escapeHtml(content)}
            </div>

        </section>

    `;

}


function renderPortfolio(data) {

    return `

<!DOCTYPE html>

<html lang="en">


<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${escapeHtml(data.name)}
    - Portfolio
</title>


<style>

* {
    box-sizing: border-box;
}


@page {
    size: A4;
    margin: 0;
}


html,
body {

    margin: 0;

    padding: 0;

    background: #eeeeee;

    color: #16181d;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}


body {

    padding: 30px;

}


.page {

    width: 794px;

    min-height: 1123px;

    margin: 0 auto;

    background: white;

    padding: 65px 70px;

}


.header {

    display: flex;

    align-items: center;

    gap: 25px;

    padding-bottom: 30px;

    border-bottom:
        2px solid #16181d;

}


.photo {

    width: 105px;

    height: 105px;

    object-fit: cover;

    border-radius: 18px;

    background: #eeeeee;

}


.name {

    margin: 0;

    font-size: 42px;

    line-height: 1;

    letter-spacing: -1.8px;

}


.profession {

    margin-top: 10px;

    font-size: 17px;

    font-weight: bold;

    color: #635bff;

}


.location {

    margin-top: 6px;

    color: #747985;

    font-size: 13px;

}


.contact {

    display: flex;

    flex-wrap: wrap;

    gap: 8px 18px;

    margin-top: 14px;

    font-size: 12px;

}


.contact a {

    color: #454954;

    text-decoration: none;

}


.section {

    margin-top: 30px;

}


.section h2 {

    margin:
        0 0 10px;

    font-size: 11px;

    letter-spacing: 1.7px;

    text-transform: uppercase;

    color: #747985;

}


.section-content {

    white-space: pre-line;

    font-size: 13px;

    line-height: 1.65;

}


.skills {

    display: flex;

    flex-wrap: wrap;

    gap: 7px;

}


.skill {

    padding: 6px 9px;

    border-radius: 7px;

    background: #f0f0f4;

    font-size: 11px;

}


.footer {

    margin-top: 45px;

    padding-top: 15px;

    border-top:
        1px solid #dddddd;

    color: #999da7;

    font-size: 10px;

}

</style>

</head>


<body>


<div class="page">


    <header class="header">


        ${
            data.photo
                ? `
                    <img
                        class="photo"
                        src="${data.photo}"
                        alt=""
                    >
                  `
                : ""
        }


        <div>


            <h1 class="name">

                ${escapeHtml(data.name)}

            </h1>


            <div class="profession">

                ${escapeHtml(data.profession)}

            </div>


            ${
                data.location
                    ? `
                        <div class="location">
                            ${escapeHtml(data.location)}
                        </div>
                      `
                    : ""
            }


            <div class="contact">


                ${
                    data.email
                        ? `
                            <a href="mailto:${escapeHtml(data.email)}">
                                ${escapeHtml(data.email)}
                            </a>
                          `
                        : ""
                }


                ${
                    data.phone
                        ? `
                            <span>
                                ${escapeHtml(data.phone)}
                            </span>
                          `
                        : ""
                }


                ${
                    data.website
                        ? `
                            <a href="${escapeHtml(data.website)}">
                                Website
                            </a>
                          `
                        : ""
                }


                ${
                    data.linkedin
                        ? `
                            <a href="${escapeHtml(data.linkedin)}">
                                LinkedIn
                            </a>
                          `
                        : ""
                }


                ${
                    data.github
                        ? `
                            <a href="${escapeHtml(data.github)}">
                                GitHub
                            </a>
                          `
                        : ""
                }


            </div>


        </div>


    </header>


    ${renderSection(
        "About",
        data.about
    )}


    ${
        data.skills &&
        data.skills.length
            ? `

                <section class="section">

                    <h2>
                        Skills
                    </h2>

                    <div class="skills">

                        ${renderSkills(
                            data.skills
                        )}

                    </div>

                </section>

              `
            : ""
    }


    ${renderSection(
        "Experience",
        data.experience
    )}


    ${renderSection(
        "Education",
        data.education
    )}


    ${renderSection(
        "Projects",
        data.projects
    )}


    <div class="footer">

        Generated with PortfolioBuilder

    </div>


</div>


</body>

</html>

    `;

}


module.exports = {
    renderPortfolio
};
