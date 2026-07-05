import prisma from "db-server";
import { customerOrderCount } from "app/graphql/query/customers";

export async function loadCustomerDetails(admin, sessionId, customerId) {
    const customer = await prisma.customer.findFirst({
        where: {
            sessionId,
            id: customerId ? parseInt(customerId) : undefined,
        },
        include: {
            transactions: {
                orderBy: { createdAt: "desc" },
                include: { event: true },
            },
            rewards:       { orderBy: { createdAt: "desc" } },
            referralsSent: true,
            referralsUsed: true,
        },
    });

    if (!customer) return { customer: null };

    const orderCount = await customerOrderCount(admin, customer.shopifyId);

    return { customer: { ...customer, orderCount } };
}
