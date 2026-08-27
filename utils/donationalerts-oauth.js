const axios = require("axios");

const AUTH_URL =
    "https://www.donationalerts.com/oauth/authorize";

const TOKEN_URL =
    "https://www.donationalerts.com/oauth/token";

const REDIRECT_URI =
    process.env.DONATION_ALERTS_REDIRECT_URI ||
    "https://portfolio-4vug.onrender.com/api/donationalerts/callback";

const SCOPE =
    "oauth-donation-index";


function getAuthorizationUrl() {

    const params = new URLSearchParams({
        client_id:
            process.env.DONATION_ALERTS_CLIENT_ID,

        redirect_uri:
            REDIRECT_URI,

        response_type:
            "code",

        scope:
            SCOPE
    });

    return `${AUTH_URL}?${params.toString()}`;
}


async function exchangeCodeForTokens(code) {

    const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({

            grant_type:
                "authorization_code",

            client_id:
                process.env.DONATION_ALERTS_CLIENT_ID,

            client_secret:
                process.env.DONATION_ALERTS_CLIENT_SECRET,

            redirect_uri:
                REDIRECT_URI,

            code

        }).toString(),

        {
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            }
        }
    );

    return response.data;
}


module.exports = {
    getAuthorizationUrl,
    exchangeCodeForTokens
};