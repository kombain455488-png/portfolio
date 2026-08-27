const API_URL =
    "https://www.donationalerts.com/api/v1";


async function getDonations() {

    const token =
        process.env.DONATION_ALERTS_ACCESS_TOKEN;


    if (!token) {

        throw new Error(
            "DONATION_ALERTS_ACCESS_TOKEN is not configured."
        );

    }


    const response =
        await fetch(
            `${API_URL}/alerts/donations?per_page=30`,
            {

                headers: {

                    Authorization:
                        `Bearer ${token}`

                }

            }
        );


    if (!response.ok) {

        const text =
            await response.text();


        throw new Error(
            `DonationAlerts API error: ${response.status} ${text}`
        );

    }


    return response.json();

}


async function findMatchingDonation(
    orderCode
) {

    const result =
        await getDonations();


    const donations =
        result.data || [];


    const requiredAmount =
        Number(
            process.env.DONATION_AMOUNT || 5
        );


    const requiredCurrency =
        (
            process.env.DONATION_CURRENCY ||
            "EUR"
        ).toUpperCase();


    const now =
        Date.now();


    const maxAge =
        60 * 60 * 1000;


    for (
        const donation
        of donations
    ) {


        const amount =
            Number(
                donation.amount
            );


        const currency =
            String(
                donation.currency || ""
            ).toUpperCase();


        const message =
            String(
                donation.message || ""
            );


        const createdAt =
            new Date(
                String(
                    donation.created_at
                ).replace(
                    " ",
                    "T"
                )
            ).getTime();


        const isRecent =
            Number.isFinite(
                createdAt
            )
                ? (
                    now - createdAt
                    <= maxAge
                )
                : false;


        const amountMatches =
            amount >= requiredAmount;


        const currencyMatches =
            currency ===
            requiredCurrency;


        const codeMatches =
            message
                .toUpperCase()
                .includes(
                    orderCode.toUpperCase()
                );


        if (
            amountMatches &&
            currencyMatches &&
            codeMatches &&
            isRecent
        ) {

            return donation;

        }

    }


    return null;

}


module.exports = {

    getDonations,

    findMatchingDonation

};
