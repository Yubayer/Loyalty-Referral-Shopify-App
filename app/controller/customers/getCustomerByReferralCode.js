import prisma from "../../db.server.js";

export const getCustomerByReferralCode = async (code) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: {
                referralCode: code
            },
            include: {
                referralsSent: true,
                referralsUsed: true
            }
        });

        return customer;
    } catch (error) {
        console.log("## get customer by referral code error", error)
        return null;
    }
}