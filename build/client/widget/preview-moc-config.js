// ── Mock data the widget needs to render a populated, realistic state ──
// api.js / html.js read these shapes — keep in sync if those files change.
window.NBL_v1 = window.NBL_v1 || {};
window.NBL_v1.appConfig = {
    appUrl: "https://jury-serum-kansas-ray.trycloudflare.com",
    shop: "nb-loyalty.myshopify.com",
    email: null,
    pointRules: [{
        id: 1,
        name: null,
        description: null,
        pointsType: "FIXED",
        pointsValue: 0,
        maxPoints: null,
        priority: 0,
        startDate: null,
        endDate: null,
        minOrderAmount: null,
        maxUsesPerUser: null,
        conditions: {
            order: {
                rate: {
                    amount: 1,
                    points: 50
                },
                type: "incremental",
                groups: [{
                    id: "38073e20-2eef-4a10-87ee-73c4f0f007f2",
                    name: "Group 1",
                    rate: {
                        amount: 10,
                        points: 2
                    },
                    products: [],
                    intervals: [],
                    fixedPoints: 150
                }],
                trigger: "both",
                intervals: [{
                    rate: {
                        amount: 1,
                        points: 60
                    },
                    interval: "monthly",
                    fixedPoints: 120
                },
                {
                    rate: {
                        amount: 10,
                        points: 2
                    },
                    interval: "weekly",
                    fixedPoints: 120
                }
                ],
                fixedPoints: 100,
                excludedProducts: []
            }
        },
        isActive: true,
        metadata: null,
        createdAt: "2026-06-14T17:21:44.054Z",
        updatedAt: "2026-06-18T14:58:02.931Z",
        sessionId: "offline_nb-loyalty.myshopify.com",
        eventId: 223,
        event: {
            name: "Direct Purchase",
            id: 223,
            type: "ORDER"
        }
    },
    {
        id: 2,
        name: null,
        description: null,
        pointsType: "FIXED",
        pointsValue: 0,
        maxPoints: null,
        priority: 0,
        startDate: null,
        endDate: null,
        minOrderAmount: null,
        maxUsesPerUser: null,
        conditions: {
            review: {
                text: {
                    points: 10,
                    isActive: true
                },
                image: {
                    points: 20,
                    isActive: true
                },
                video: {
                    points: 30,
                    isActive: true
                },
                rewardMode: "once"
            }
        },
        isActive: true,
        metadata: null,
        createdAt: "2026-06-05T10:06:02.627Z",
        updatedAt: "2026-06-20T18:05:11.774Z",
        sessionId: "offline_nb-loyalty.myshopify.com",
        eventId: 225,
        event: {
            name: "Loox Review Written",
            id: 225,
            type: "REVIEW"
        }
    },
    {
        id: 3,
        name: null,
        description: null,
        pointsType: "FIXED",
        pointsValue: 0,
        maxPoints: null,
        priority: 0,
        startDate: null,
        endDate: null,
        minOrderAmount: null,
        maxUsesPerUser: null,
        conditions: {
            referral: {
                groups: [{
                    id: "ba68ace4-ee6d-4f73-a2c9-2873c8a3ad55",
                    name: "Group 1",
                    products: [],
                    referred: {
                        points: 75,
                        renewalPoints: 60,
                        allowRenewalReward: false
                    },
                    referrer: {
                        points: 150,
                        renewalPoints: 120,
                        allowRenewalReward: false
                    },
                    intervals: [{
                        interval: "weekly",
                        referred: {
                            points: 60,
                            renewalPoints: 45,
                            allowRenewalReward: false
                        },
                        referrer: {
                            points: 120,
                            renewalPoints: 90,
                            allowRenewalReward: false
                        }
                    }]
                }],
                trigger: "subscription",
                referred: {
                    points: 50,
                    discountType: "fixed",
                    discountValue: 10,
                    renewalPoints: 40,
                    allowRenewalReward: false
                },
                referrer: {
                    points: 100,
                    renewalPoints: 80,
                    allowRenewalReward: false
                },
                intervals: [{
                    interval: "weekly",
                    referred: {
                        points: 65,
                        renewalPoints: 50,
                        allowRenewalReward: false
                    },
                    referrer: {
                        points: 130,
                        renewalPoints: 100,
                        allowRenewalReward: false
                    }
                }]
            }
        },
        isActive: true,
        metadata: null,
        createdAt: "2026-06-15T15:04:04.041Z",
        updatedAt: "2026-06-18T12:05:05.527Z",
        sessionId: "offline_nb-loyalty.myshopify.com",
        eventId: 224,
        event: {
            name: "Refer a Friend",
            id: 224,
            type: "REFERRAL"
        }
    }
    ],
    rewardRules: [
        {
            id: 1,
            title: "Voucher $5",
            description: "",
            pointsCost: 10,
            discountType: "fixed",
            rewardType: "orderDiscount",
            rewardValue: 5,
            couponPrefix: null,
            usageLimit: null,
            usagePerUser: null,
            usageCount: 39,
            isAutoApply: false,
            startDate: null,
            endDate: null,
            priority: 0,
            minOrderAmount: null,
            conditions: null,
            isActive: true,
            metadata: null,
            createdAt: "2026-05-06T08:05:23.059Z",
            updatedAt: "2026-06-20T13:01:51.475Z",
            sessionId: "offline_nb-loyalty.myshopify.com"
        },
        {
            id: 2,
            title: "Voucher $30",
            description: "",
            pointsCost: 300,
            discountType: "fixed",
            rewardType: "orderDiscount",
            rewardValue: 30,
            couponPrefix: null,
            usageLimit: null,
            usagePerUser: null,
            usageCount: 21,
            isAutoApply: false,
            startDate: null,
            endDate: null,
            priority: 0,
            minOrderAmount: null,
            conditions: null,
            isActive: true,
            metadata: null,
            createdAt: "2026-05-07T05:38:50.728Z",
            updatedAt: "2026-06-20T13:04:14.791Z",
            sessionId: "offline_nb-loyalty.myshopify.com"
        }
    ],
    physicalPrizes: [
        {
            id: 1,
            title: "2k Camera",
            description: "2k resolution camera with advanced features for photography enthusiasts.",
            imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQY89slUAEbgy_DU95GLBAb5YGnvd1wisgjfIDEw7TFvBcfWtqX2z1V1fzX&s=10",
            pointsCost: 150000,
            productValue: 1000,
            isActive: true
        },
        {
            id: 2,
            title: "4k Camera",
            description: "4k resolution camera with advanced features for photography enthusiasts.",
            imageUrl: "https://proav.co.uk/media/catalog/product/cache/9bb9d677791f8666003e194c8a94aeff/h/x/hxr-nx800_1.jpg",
            pointsCost: 516600,
            productValue: 3444,
            isActive: true
        }
    ],
    styles: {
        id: 4,
        shop: "nb-loyalty.myshopify.com",
        presetKey: "northBorders",
        widgetConfig: {
            prize: {
                imageFit: "cover",
                showImage: false,
                contactUrl: "/pages/contact",
                imageHeight: 150,
                imagePosition: "top",
                showAdminNote: true,
                showRequestDate: true,
                showTrackingInfo: true,
                showFulfilledDate: true
            },
            labels: {
                navEarn: "Earn",
                navHome: "Home",
                navPrizes: "Prizes",
                navRewards: "Rewards",
                emptyPrizes: "No prizes available",
                headerLabel: "Welcome, [name]",
                loadMoreBtn: "Load More",
                navActivity: "Activity",
                navMyPrizes: "My Prizes",
                pointsLabel: "[points] pts",
                emptyRewards: "No active rewards available",
                homeCardEarn: "Earn Points",
                loadMoreDone: "All loaded",
                navMyRewards: "My Rewards",
                claimingLabel: "Processing...",
                emptyActivity: "No account activities yet",
                emptyMyPrizes: "You have no prize requests yet",
                homeCardRefer: "Refer Friends",
                launcherTitle: "NBL Loyalty & Referral",
                homeCardBrowse: "Browse Rewards",
                activityColDate: "Date",
                claimRetryLabel: "Try again",
                launcherSubtitle: "Your balance: [points] pts",
                activityColPoints: "Points",
                notifyInfoClaimBtn: "Claim",
                prizeContactUsText: "Contact us",
                prizeStatusPending: "🕐 Pending",
                activityColActivity: "Activity",
                notifyRewardCopyBtn: "Copy",
                notifyRewardHeading: "Success! Use this code at checkout",
                prizeClaimSuccessMsg: "✅ Your request has been submitted! We'll contact you soon to arrange delivery.",
                prizeStatusCancelled: "❌ Cancelled",
                prizeStatusCompleted: "✅ Completed",
                prizeStatusFulfilled: "📦 Fulfilled",
                sectionActiveRewards: "Active Rewards",
                sectionPrizeRequests: "My Prize Requests",
                sectionRecentActivity: "Recent Activity"
            },
            paginationMode: "loadmore",
            myPrizesPerPage: 5,
            homeRewardsPerPage: 5,
            homeActivitiesPerPage: 5,
            showHomeRewardsSection: true,
            homePrizeRequestsPerPage: 5,
            showHomeActivitiesSection: true,
            showHomePrizeRequestsSection: true
        },
        updatedAt: "2026-06-21T07:21:42.759Z",
        sessionId: "offline_nb-loyalty.myshopify.com"
    }
},
    window.NBL_v1.customer = {
        id: 9441305526522,
        email: "articmaze@dev",
        name: "Artic Maze",
        first_name: "Artic",
        last_name: "Maze",
        config: {
            appName: "North Borders Loyalty App",
            id: 1,
            shopifyId: "gid://shopify/Customer/9441305526522",
            name: "Artic Maze",
            firstName: "Artic",
            lastName: "Maze",
            email: "yagaloc110@justnapa.com",
            points: 2563545,
            orders: 0,
            lifetimePoints: 9431270,
            referralCode: "NBL_3D3E3MBMOTOIN2S",
            birthday: null,
            isBlocked: false,
            activeStatus: "ACTIVE",
            metadata: {
                id: "gid://shopify/Customer/9441305526522",
                tags: [
                    "appstle_subscription_active_customer"
                ],
                state: "DISABLED",
                lastName: "Dev 21",
                createdAt: "2026-05-06T06:31:23Z",
                firstName: null,
                taxExempt: false,
                updatedAt: "2026-06-19T06:13:24Z",
                amountSpent: {
                    amount: "0.0",
                    currencyCode: "USD"
                },
                verifiedEmail: true,
                numberOfOrders: "1",
                defaultPhoneNumber: null,
                defaultEmailAddress: {
                    emailAddress: "yagaloc110@justnapa.com",
                    marketingState: "NOT_SUBSCRIBED"
                }
            },
            createdAt: "2026-05-06T06:31:25.781Z",
            enrolledAt: "2026-05-06T06:31:25.781Z",
            updatedAt: "2026-06-21T06:58:51.817Z",
            sessionId: "offline_nb-loyalty.myshopify.com",
            transactions: [
                {
                    id: 1,
                    customerId: 1,
                    type: "REDEEM",
                    points: -90,
                    balanceAfter: 2563545,
                    eventId: null,
                    expiresAt: null,
                    reason: "90 points redeemed for reward: Voucher $7",
                    metadata: {},
                    createdAt: "2026-06-21T06:58:51.810Z",
                    status: "COMPLETED",
                    activity: "-90 points redeemed for reward: Voucher $7",
                    pointsRuleId: null,
                    rewardId: 123,
                    referralId: null,
                    reward: {
                        id: 123,
                        status: "ACTIVE",
                        usedAt: null,
                        createdAt: "2026-06-21T06:58:51.795Z"
                    }
                },
                {
                    id: 2,
                    customerId: 1,
                    type: "ADJUST",
                    points: 0,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "Prize claim fulfilled: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:50.441Z",
                    status: "COMPLETED",
                    activity: "Prize 'abc' marked as fulfilled — no points changed",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
                {
                    id: 3,
                    customerId: 1,
                    type: "REDEEM",
                    points: -360000,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "360000 points redeemed for prize: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:15.593Z",
                    status: "COMPLETED",
                    activity: "-360000 points redeemed for prize: abc",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
                {
                    id: 1,
                    customerId: 1,
                    type: "REDEEM",
                    points: -90,
                    balanceAfter: 2563545,
                    eventId: null,
                    expiresAt: null,
                    reason: "90 points redeemed for reward: Voucher $7",
                    metadata: {},
                    createdAt: "2026-06-21T06:58:51.810Z",
                    status: "COMPLETED",
                    activity: "-90 points redeemed for reward: Voucher $7",
                    pointsRuleId: null,
                    rewardId: 123,
                    referralId: null,
                    reward: {
                        id: 123,
                        status: "ACTIVE",
                        usedAt: null,
                        createdAt: "2026-06-21T06:58:51.795Z"
                    }
                },
                {
                    id: 2,
                    customerId: 1,
                    type: "ADJUST",
                    points: 0,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "Prize claim fulfilled: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:50.441Z",
                    status: "COMPLETED",
                    activity: "Prize 'abc' marked as fulfilled — no points changed",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
                {
                    id: 3,
                    customerId: 1,
                    type: "REDEEM",
                    points: -360000,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "360000 points redeemed for prize: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:15.593Z",
                    status: "COMPLETED",
                    activity: "-360000 points redeemed for prize: abc",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
                {
                    id: 1,
                    customerId: 1,
                    type: "REDEEM",
                    points: -90,
                    balanceAfter: 2563545,
                    eventId: null,
                    expiresAt: null,
                    reason: "90 points redeemed for reward: Voucher $7",
                    metadata: {},
                    createdAt: "2026-06-21T06:58:51.810Z",
                    status: "COMPLETED",
                    activity: "-90 points redeemed for reward: Voucher $7",
                    pointsRuleId: null,
                    rewardId: 123,
                    referralId: null,
                    reward: {
                        id: 123,
                        status: "ACTIVE",
                        usedAt: null,
                        createdAt: "2026-06-21T06:58:51.795Z"
                    }
                },
                {
                    id: 2,
                    customerId: 1,
                    type: "ADJUST",
                    points: 0,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "Prize claim fulfilled: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:50.441Z",
                    status: "COMPLETED",
                    activity: "Prize 'abc' marked as fulfilled — no points changed",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
                {
                    id: 3,
                    customerId: 1,
                    type: "REDEEM",
                    points: -360000,
                    balanceAfter: 2563635,
                    eventId: null,
                    expiresAt: null,
                    reason: "360000 points redeemed for prize: abc",
                    metadata: {},
                    createdAt: "2026-06-20T20:24:15.593Z",
                    status: "COMPLETED",
                    activity: "-360000 points redeemed for prize: abc",
                    pointsRuleId: null,
                    rewardId: null,
                    referralId: null,
                    reward: null
                },
            ],
            rewards: [
                {
                    id: 1,
                    title: "Voucher $7",
                    event: "MANUAL",
                    type: "REDEEM",
                    code: "NBL_NC3BFRU",
                    rewardKey: "MANUAL:REDEEM:1:0:NBL_NC3BFRU:Voucher $7",
                    orderId: null,
                    pointsCost: 90,
                    status: "ACTIVE",
                    discountUsed: false,
                    usedAt: null,
                    expiresAt: null,
                    metadata: {},
                    description: "Redeemed points for a discount voucher",
                    createdAt: "2026-06-21T06:58:51.795Z",
                    updatedAt: "2026-06-21T06:58:51.795Z",
                    rewardRuleId: 15,
                    customerId: 1
                },
                {
                    id: 2,
                    title: "Voucher $50",
                    event: "MANUAL",
                    type: "REDEEM",
                    code: "NBL_QOY9HFW",
                    rewardKey: "MANUAL:REDEEM:1:0:NBL_QOY9HFW:Voucher $50",
                    orderId: null,
                    pointsCost: 1000,
                    status: "ACTIVE",
                    discountUsed: false,
                    usedAt: null,
                    expiresAt: null,
                    metadata: {},
                    description: "Redeemed points for a discount voucher",
                    createdAt: "2026-06-20T20:23:52.534Z",
                    updatedAt: "2026-06-20T20:23:52.534Z",
                    rewardRuleId: 14,
                    customerId: 1
                }
            ],
            prizeClaims: [
                {
                    id: 1,
                    status: "FULFILLED",
                    pointsCost: 360000,
                    physicalPrizeId: 2,
                    createdAt: "2026-06-20T20:24:15.580Z",
                    fulfilledAt: "2026-06-20T20:24:50.436Z"
                },
                {
                    id: 2,
                    status: "PENDING",
                    pointsCost: 150000,
                    physicalPrizeId: 1,
                    createdAt: "2026-06-20T12:43:59.159Z",
                    fulfilledAt: null
                }
            ]
        },
    };
window.NBL_v1.liquidData = {
    isLoggedIn: true,
    customerName: "Jordan Avery",
    shopUrl: "https://preview-store.myshopify.com",
    referralCode: "NBL_PREVIEW1",
    buttonPosition: "right"
};
window.NBL_v1.routes = { login_url: "#", register_url: "#" };
window.NBL_v1.__isPreview = true;