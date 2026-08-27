const crypto =
    require("crypto");


function generateOrderId() {

    return crypto
        .randomBytes(18)
        .toString("hex");

}


function generateOrderCode() {

    return (
        "PF-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );

}


module.exports = {

    generateOrderId,

    generateOrderCode

};
