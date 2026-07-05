var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, useSubmit, useNavigation, useNavigate, useRevalidator, useSearchParams, useFetcher } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import React, { useState, useCallback, useMemo, useEffect, Suspense, useRef, useDeferredValue, memo } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { createPortal } from "react-dom";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const APP_NAME = "NBL";
const isDev = process.env.NODE_ENV !== "production";
const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? "debug" : "warn");
const LEVELS = {
  debug: 10,
  info: 20,
  success: 25,
  warn: 30,
  error: 40
};
const EMOJIS = {
  debug: "🔍",
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌"
};
const shouldLog = (level) => LEVELS[level] >= LEVELS[LOG_LEVEL];
const parseShop = (args) => {
  if (args[0] && typeof args[0] === "string" && args[0].includes("myshopify.com")) {
    return { shop: args[0], rest: args.slice(1) };
  }
  if (args[0] === null || args[0] === void 0) {
    return { shop: null, rest: args.slice(1) };
  }
  return { shop: null, rest: args };
};
const compactStack = (stack) => {
  if (!stack) return void 0;
  const lines = stack.split("\n").slice(1);
  const appFrame = lines.find(
    (l) => l.includes("/app/") && !l.includes("node_modules")
  );
  const raw = appFrame || lines[0] || "";
  return raw.replace(/^\s+at\s+/, "").trim();
};
const normalizeExtras = (extras) => {
  return extras.reduce((acc, item, i) => {
    if (item instanceof Error) {
      acc.error = item.message;
      if (isDev) acc.at = compactStack(item.stack);
    } else if (typeof item === "object" && item !== null) {
      const { stack, ...rest } = item;
      Object.assign(acc, rest);
      if (stack && isDev) acc.at = compactStack(stack);
    } else {
      acc[`extra${i + 1}`] = item;
    }
    return acc;
  }, {});
};
function logMessage(level, ...args) {
  if (!shouldLog(level)) return;
  const { shop, rest } = parseShop(args);
  const message = rest[0] || "(no message)";
  const extras = normalizeExtras(rest.slice(1));
  const payload = {
    app: APP_NAME,
    level,
    time: (/* @__PURE__ */ new Date()).toISOString(),
    shop,
    message,
    ...extras
  };
  if (isDev) {
    const emoji = EMOJIS[level] || "→";
    console[level === "error" ? "error" : "log"](
      `## [${APP_NAME}] ${emoji} [${level.toUpperCase()}] ${shop ? `[${shop}] ` : ""}${message}`
    );
    if (Object.keys(extras).length) {
      console.log(extras);
    }
  } else {
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](JSON.stringify(payload));
  }
}
const logger = {
  debug: (...a) => logMessage("debug", ...a),
  info: (...a) => logMessage("info", ...a),
  success: (...a) => logMessage("success", ...a),
  warn: (...a) => logMessage("warn", ...a),
  error: (...a) => logMessage("error", ...a)
};
async function shopId(admin) {
  try {
    const shopDataResponse = await admin.graphql(
      `#graphql
                query {
                    shop {
                        id
                    }
                }
            `
    );
    const shopDataJson = await shopDataResponse.json();
    const shopData = shopDataJson.data.shop;
    return (shopData == null ? void 0 : shopData.id) || null;
  } catch (error) {
    logger.error("## Error fetching shop data:", error);
    return null;
  }
}
async function configMetafieldSyncMutation(admin, metafield) {
  metafield = metafield || {};
  if (!admin) {
    logger.error("Admin client is required for metafield sync mutation");
    return;
  }
  if (!metafield.ownerId || !metafield.key || !metafield.namespace) {
    logger.error("Metafield ownerId, key and namespace are required for metafield sync mutation");
    return;
  }
  if (typeof metafield.value !== "string") {
    logger.error("Metafield value must be a string for metafield sync mutation");
    return;
  }
  try {
    const response = await admin.graphql(
      `#graphql
            mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                metafields {
                    key
                    namespace
                    value
                    createdAt
                    updatedAt
                }
                userErrors {
                    field
                    message
                    code
                }
            }
        }`,
      {
        variables: {
          metafields: [
            { ...metafield }
            // {
            //     namespace: "shield_insurance_app_new",
            //     key: "config",
            //     value: JSON.stringify(data),
            //     type: "json",
            //     ownerId: shopId,
            // },
          ]
        }
      }
    );
    if (response.errors) {
      throw new Error("Something went wrong! please try again later.");
    } else {
      logger.success("Metafield successfully synced");
    }
  } catch (err) {
    logger.error("Metafield sync mutation error", {
      module: "graphql/mutation/metafieldSync.js",
      error: err == null ? void 0 : err.message,
      stack: err == null ? void 0 : err.stack
    });
  }
}
async function syncAppConfig(admin, session) {
  try {
    const shop_id = await shopId(admin);
    const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
    const shop = await prisma.session.findFirst({
      where: { id: session == null ? void 0 : session.id },
      select: {
        shop: true,
        email: true,
        pointRules: {
          include: {
            event: {
              select: {
                name: true,
                id: true,
                type: true
              }
            }
          }
        },
        rewardRules: true,
        styles: true,
        physicalPrizes: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            pointsCost: true,
            productValue: true,
            isActive: true
          }
        }
      }
    });
    const metafield = {
      namespace: "app",
      key: "nbl_config_v1",
      value: JSON.stringify({
        appUrl,
        ...shop
      }),
      type: "json",
      ownerId: shop_id
    };
    await configMetafieldSyncMutation(admin, metafield);
  } catch (error) {
    console.error("## Error in syncAppConfig:", error);
  }
}
const syncAppConfig$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: syncAppConfig
}, Symbol.toStringTag, { value: "Module" }));
async function afterAuthSetup({ admin, session }) {
  try {
    await eventSeeder(session);
    await syncAppConfig(admin, session);
  } catch (error) {
    logger.error("## Error in afterAuthSetup:", error);
  }
}
const eventSeeder = async (session) => {
  const SEED_EVENTS = [
    {
      name: "Direct Purchase",
      type: "ORDER",
      description: "Customer places an order and completes the checkout process. Rewards are granted when the order is marked as paid in Shopify."
    },
    {
      name: "Refer a Friend",
      type: "REFERRAL",
      description: "Customer refers a friend who makes a purchase using their referral code. Rewards are granted when the referred friend completes a purchase using the referral code."
    },
    {
      name: "Loox Review Written",
      type: "REVIEW",
      description: "Customer writes a product review on Loox, There are three types of reviews that can be rewarded: Text Review: A standard written review without photos. Photo Review: A review that includes photos of the product. Video Review: A review that includes a video showcasing the product."
    }
  ];
  try {
    await Promise.all(
      SEED_EVENTS.map(
        (event) => prisma.event.upsert({
          where: {
            sessionId_type: {
              sessionId: session.id,
              type: event.type
            }
          },
          update: {
            name: event.name,
            description: event.description
          },
          create: {
            shop: session.shop,
            sessionId: session.id,
            name: event.name,
            type: event.type,
            description: event.description
          }
        })
      )
    );
    logger.info(`## eventSeeder: Seeded ${SEED_EVENTS.length} events for shop "${session.shop}"`);
  } catch (error) {
    logger.error("## eventSeeder: Failed to seed events", { shop: session.shop, error });
  }
};
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  hooks: {
    afterAuth: async ({ session, admin }) => {
      try {
        afterAuthSetup({ session, admin });
      } catch (error) {
        console.error("## Error in afterAuth hook:", error);
      }
    }
  },
  future: {
    expiringOfflineAccessTokens: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.October25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
const unauthenticated = shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, reactRouterContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const callbackName = "onAllReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: reactRouterContext, url: request.url }),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://cdn.shopify.com/"
      }), /* @__PURE__ */ jsx("link", {
        rel: "stylesheet",
        href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$p = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$q = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const route$e = UNSAFE_withComponentProps(function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const {
    errors
  } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, {
    embedded: false,
    children: /* @__PURE__ */ jsx("s-page", {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs("s-section", {
          heading: "Log in",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            name: "shop",
            label: "Shop domain",
            details: "example.myshopify.com",
            value: shop,
            onChange: (e) => setShop(e.currentTarget.value),
            autocomplete: "on",
            error: errors.shop
          }), /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            children: "Log in"
          })]
        })
      })
    })
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$q,
  default: route$e,
  loader: loader$p
}, Symbol.toStringTag, { value: "Module" }));
const index$1 = "_index_12yiq_1";
const heading = "_heading_12yiq_11";
const text = "_text_12yiq_12";
const content = "_content_12yiq_22";
const form = "_form_12yiq_27";
const label = "_label_12yiq_35";
const input = "_input_12yiq_43";
const button = "_button_12yiq_47";
const list = "_list_12yiq_51";
const styles = {
  index: index$1,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$o = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return redirect(`/app`);
};
const route$d = UNSAFE_withComponentProps(function App2() {
  const {
    showForm
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: styles.index,
    children: /* @__PURE__ */ jsxs("div", {
      className: styles.content,
      children: [/* @__PURE__ */ jsx("h1", {
        className: styles.heading,
        children: "A short heading about [your app]"
      }), /* @__PURE__ */ jsx("p", {
        className: styles.text,
        children: "A tagline about [your app] that describes your value proposition."
      }), showForm && /* @__PURE__ */ jsxs(Form, {
        className: styles.form,
        method: "post",
        action: "/auth/login",
        children: [/* @__PURE__ */ jsxs("label", {
          className: styles.label,
          children: [/* @__PURE__ */ jsx("span", {
            children: "Shop domain"
          }), /* @__PURE__ */ jsx("input", {
            className: styles.input,
            type: "text",
            name: "shop"
          }), /* @__PURE__ */ jsx("span", {
            children: "e.g: my-shop-domain.myshopify.com"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: styles.button,
          type: "submit",
          children: "Log in"
        })]
      }), /* @__PURE__ */ jsxs("ul", {
        className: styles.list,
        children: [/* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        })]
      })]
    })
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route$d,
  loader: loader$o
}, Symbol.toStringTag, { value: "Module" }));
const loader$n = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$2 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$2,
  loader: loader$n
}, Symbol.toStringTag, { value: "Module" }));
function AppNav() {
  return /* @__PURE__ */ jsxs("s-app-nav", { children: [
    /* @__PURE__ */ jsx("s-link", { href: "/app/dashboard", children: "Dashboard" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/customers", children: "Customers" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/points-rules", children: "Points Earning Rules" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/rewards-rules", children: "Reward Rules" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/physical-prizes-rules", children: "Physical Prize Rules" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/physical-prizes-claims-manage", children: "Physical Prize Claims" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/customize", children: "Widget Customize" }),
    /* @__PURE__ */ jsx("s-link", { href: "/app/jobs", children: "Background Jobs" })
  ] });
}
const loader$m = async ({
  request
}) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsx(AppNav, {}), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary$1 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary() {
  return boundary.error(useRouteError());
});
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary$1,
  default: app,
  headers: headers$1,
  loader: loader$m
}, Symbol.toStringTag, { value: "Module" }));
const loader$l = async ({
  request
}) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  throw redirect(`/app/dashboard?${url.searchParams.toString()}`);
};
const app__index = UNSAFE_withComponentProps(function Dashboard() {
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Dashboard",
    children: /* @__PURE__ */ jsx("s-section", {
      children: "Under development"
    })
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app__index,
  loader: loader$l
}, Symbol.toStringTag, { value: "Module" }));
const loader$k = async ({
  request
}) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};
const index = UNSAFE_withComponentProps(function AppIndex() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsx(AppNav, {}), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary2 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary3() {
  return boundary.error(useRouteError());
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary2,
  default: index,
  headers,
  loader: loader$k
}, Symbol.toStringTag, { value: "Module" }));
async function loadDashboardData(sessionId) {
  const twoYearsAgo = /* @__PURE__ */ new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const [transactions, rewards, customerCount, prizeClaims] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: twoYearsAgo }, customer: { sessionId } },
      select: { id: true, type: true, points: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.reward.findMany({
      where: { createdAt: { gte: twoYearsAgo }, customer: { sessionId } },
      select: { id: true, status: true, pointsCost: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.customer.count({
      where: { sessionId, activeStatus: "ACTIVE" }
    }),
    // Date-range filterable — used for both stat cards and the prize activity chart.
    prisma.physicalPrizeClaim.findMany({
      where: { createdAt: { gte: twoYearsAgo }, prize: { sessionId } },
      select: { id: true, pointsCost: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    })
  ]);
  return { transactions, rewards, customerCount, prizeClaims };
}
const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 3 days", value: "last_3_days" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "This week", value: "this_week" },
  { label: "Past week", value: "past_week" },
  { label: "Last 15 days", value: "last_15_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Last 3 months", value: "last_3_months" },
  { label: "Last 6 months", value: "last_6_months" },
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
  { label: "Custom range", value: "custom" }
];
const DEFAULT_PRESET = "last_7_days";
const TOMORROW_STR = (() => {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
})();
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
function getPresetRange(preset) {
  const now = /* @__PURE__ */ new Date();
  const today = dayStart(now);
  const end = dayEnd(now);
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  switch (preset) {
    case "today":
      return { start: today, end };
    case "yesterday":
      return { start: daysAgo(1), end: dayEnd(daysAgo(1)) };
    case "last_3_days":
      return { start: daysAgo(2), end };
    case "last_7_days":
      return { start: daysAgo(6), end };
    case "last_15_days":
      return { start: daysAgo(14), end };
    case "last_30_days":
      return { start: daysAgo(29), end };
    case "this_week": {
      const s = new Date(today);
      s.setDate(s.getDate() - s.getDay());
      return { start: s, end };
    }
    case "past_week": {
      const sat = new Date(today);
      sat.setDate(sat.getDate() - sat.getDay() - 1);
      const sun = new Date(sat);
      sun.setDate(sun.getDate() - 6);
      return { start: dayStart(sun), end: dayEnd(sat) };
    }
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: dayEnd(e) };
    }
    case "last_3_months":
      return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end };
    case "last_6_months":
      return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end };
    case "this_year":
      return { start: new Date(now.getFullYear(), 0, 1), end };
    case "last_year": {
      const y = now.getFullYear() - 1;
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
    }
    default:
      return { start: daysAgo(6), end };
  }
}
function resolveDateRange(preset, customStart, customEnd) {
  if (preset === "custom" && customStart && customEnd) {
    return {
      start: /* @__PURE__ */ new Date(`${customStart}T00:00:00`),
      end: /* @__PURE__ */ new Date(`${customEnd}T23:59:59.999`)
    };
  }
  return getPresetRange(preset);
}
function getGranularity(start, end, preset) {
  switch (preset) {
    case "today":
    case "yesterday":
      return "hourly";
    case "last_3_days":
    case "last_7_days":
    case "this_week":
    case "past_week":
    case "last_15_days":
    case "last_30_days":
    case "this_month":
    case "last_month":
      return "daily";
    case "last_3_months":
    case "last_6_months":
      return "weekly";
    case "this_year":
    case "last_year":
      return "monthly";
    default: {
      const days = (end - start) / 864e5;
      if (days <= 1) return "hourly";
      if (days <= 90) return "daily";
      if (days <= 365) return "weekly";
      return "monthly";
    }
  }
}
function generateLabels(start, end, granularity) {
  if (granularity === "hourly") {
    return Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  }
  const labels = [];
  const cursor = new Date(start);
  const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtMon = (d) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  if (granularity === "daily") {
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      labels.push(fmtDay(new Date(cursor)));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === "weekly") {
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      labels.push(fmtDay(new Date(cursor)));
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      labels.push(fmtMon(new Date(cursor)));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return labels;
}
function getBucketIndex(date, start, granularity) {
  if (granularity === "hourly") return date.getHours();
  if (granularity === "daily") return Math.floor((dayStart(date) - dayStart(start)) / 864e5);
  if (granularity === "weekly") return Math.floor((date - start) / (864e5 * 7));
  return (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
}
function bucketRecords(records, length, start, granularity, getValue) {
  const buckets = Array(length).fill(0);
  for (const r of records) {
    const idx = getBucketIndex(new Date(r.createdAt), start, granularity);
    if (idx >= 0 && idx < length) buckets[idx] += getValue(r);
  }
  return buckets;
}
function mergeBuckets(buckets, labels, targetCount) {
  if (!targetCount || targetCount >= buckets.length) {
    return { mergedData: buckets, mergedLabels: labels };
  }
  const total = buckets.length;
  const mergedData = [];
  const mergedLabels = [];
  for (let i = 0; i < targetCount; i++) {
    const s = Math.floor(i / targetCount * total);
    const e = Math.floor((i + 1) / targetCount * total);
    mergedData.push(buckets.slice(s, e).reduce((a, v) => a + v, 0));
    mergedLabels.push(labels[s]);
  }
  return { mergedData, mergedLabels };
}
function makeChartOptions(colors, labels) {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      animations: { enabled: true, speed: 400 }
    },
    colors,
    xaxis: { categories: labels, labels: { style: { fontSize: "11px" } } },
    yaxis: { labels: { style: { fontSize: "11px" } } },
    dataLabels: { enabled: false },
    grid: { borderColor: "#e8e8e8", strokeDashArray: 4 },
    tooltip: { shared: true, intersect: false },
    legend: { position: "top", fontSize: "13px" },
    stroke: { curve: "smooth", width: 2 }
  };
}
function buildChartSeries({ start, end, preset, interval, series }) {
  const granularity = getGranularity(start, end, preset);
  const rawLabels = generateLabels(start, end, granularity);
  const len = rawLabels.length;
  const target = interval && interval < len ? interval : null;
  const data = {};
  let labels = rawLabels;
  for (const { key, records, getValue } of series) {
    const raw = bucketRecords(records, len, start, granularity, getValue);
    const { mergedData, mergedLabels } = mergeBuckets(raw, rawLabels, target);
    data[key] = mergedData;
    if (labels === rawLabels) labels = mergedLabels;
  }
  return { granularity, labels, labelCount: len, data };
}
function useDashboardPage(loaderData) {
  const {
    transactions = [],
    rewards = [],
    customerCount = 0,
    prizeClaims = []
  } = loaderData ?? {};
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [interval, setInterval2] = useState(null);
  const handleCustomApply = useCallback(({ start: start2, end: end2 }) => {
    setCustomStart(start2);
    setCustomEnd(end2);
  }, []);
  const handleIntervalChange = useCallback((e) => {
    const v = e.target.value;
    setInterval2(v === "" ? null : Number(v));
  }, []);
  const { start, end } = useMemo(
    () => resolveDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );
  const inRange = useCallback(
    (r) => {
      const d = new Date(r.createdAt);
      return d >= start && d <= end;
    },
    [start, end]
  );
  const tx = useMemo(() => transactions.filter(inRange), [transactions, inRange]);
  const rw = useMemo(() => rewards.filter(inRange), [rewards, inRange]);
  const pc = useMemo(() => prizeClaims.filter(inRange), [prizeClaims, inRange]);
  const earnTx = useMemo(() => tx.filter((t) => ["EARN", "REFERRAL"].includes(t.type) && t.points > 0), [tx]);
  const redeemTx = useMemo(() => tx.filter((t) => t.type === "REDEEM"), [tx]);
  const prizeStats = useMemo(() => ({
    total: pc.length,
    pending: pc.filter((c) => c.status === "PENDING").length,
    fulfilled: pc.filter((c) => c.status === "FULFILLED").length,
    completed: pc.filter((c) => c.status === "COMPLETED").length,
    cancelled: pc.filter((c) => c.status === "CANCELLED").length
  }), [pc]);
  const overviewStats = useMemo(() => ({
    pointsEarned: earnTx.reduce((s, t) => s + t.points, 0),
    pointsRedeemed: redeemTx.reduce((s, t) => s + Math.abs(t.points), 0),
    rewardsIssued: rw.length,
    activeRewards: rw.filter((r) => r.status === "ACTIVE").length,
    activeCustomers: customerCount
  }), [earnTx, redeemTx, rw, customerCount]);
  const { granularity, labels, labelCount, data: chartData } = useMemo(
    () => buildChartSeries({
      start,
      end,
      preset,
      interval,
      series: [
        { key: "earned", records: earnTx, getValue: (t) => t.points },
        { key: "redeemed", records: redeemTx, getValue: (t) => Math.abs(t.points) },
        { key: "rewards", records: rw, getValue: () => 1 },
        { key: "prizePending", records: pc.filter((c) => c.status === "PENDING"), getValue: () => 1 },
        { key: "prizeFulfilled", records: pc.filter((c) => c.status === "FULFILLED"), getValue: () => 1 },
        { key: "prizeCompleted", records: pc.filter((c) => c.status === "COMPLETED"), getValue: () => 1 },
        { key: "prizeCancelled", records: pc.filter((c) => c.status === "CANCELLED"), getValue: () => 1 }
      ]
    }),
    [start, end, preset, interval, earnTx, redeemTx, rw, pc]
  );
  const rangeKey = `${preset}-${customStart}-${customEnd}-${interval ?? "auto"}`;
  const chartOptions = useCallback((colors) => makeChartOptions(colors, labels), [labels]);
  return {
    // Date range controls
    preset,
    setPreset,
    customStart,
    customEnd,
    handleCustomApply,
    granularity,
    labelCount,
    interval,
    handleIntervalChange,
    // Stats
    overviewStats,
    prizeStats,
    // Charts
    chartData,
    rangeKey,
    chartOptions
  };
}
const IntervalSelect = ({ labelCount, interval, onChange }) => {
  if (labelCount <= 4) return null;
  const candidates = [2, 4, 6, 8, 10, 12, 15, 20, 30];
  const options = candidates.filter((n) => n < labelCount);
  return /* @__PURE__ */ jsxs("s-box", { children: [
    /* @__PURE__ */ jsx("s-heading", { children: "Select Date Range" }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsxs(
      "s-select",
      {
        label: "Interval",
        labelAccessibilityVisibility: "exclusive",
        value: interval === null ? "" : String(interval),
        onChange,
        children: [
          /* @__PURE__ */ jsx("s-option", { value: "", children: "Auto" }),
          options.map((n) => /* @__PURE__ */ jsxs("s-option", { value: String(n), children: [
            n,
            " ticks"
          ] }, n)),
          /* @__PURE__ */ jsxs("s-option", { value: String(labelCount), children: [
            "All (",
            labelCount,
            ")"
          ] })
        ]
      }
    )
  ] });
};
const DateRangePicker = ({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomApply,
  granularity,
  labelCount,
  interval,
  onIntervalChange
}) => {
  var _a2;
  const [pendingStart, setPendingStart] = useState(customStart);
  const [pendingEnd, setPendingEnd] = useState(customEnd);
  const [showCalendar, setShowCalendar] = useState(!(customStart && customEnd));
  useEffect(() => {
    if (preset === "custom") {
      setPendingStart(customStart);
      setPendingEnd(customEnd);
      setShowCalendar(!(customStart && customEnd));
    }
  }, [preset]);
  const handleDatePickerChange = useCallback((e) => {
    var _a3;
    const parts = (((_a3 = e.target) == null ? void 0 : _a3.value) || "").split("--");
    if (parts.length === 2 && parts[0] && parts[1]) {
      setPendingStart(parts[0]);
      setPendingEnd(parts[1]);
    }
  }, []);
  const handleApply = useCallback(() => {
    if (pendingStart && pendingEnd) {
      onCustomApply({ start: pendingStart, end: pendingEnd });
      setShowCalendar(false);
    }
  }, [pendingStart, pendingEnd, onCustomApply]);
  const activeLabel = ((_a2 = DATE_PRESETS.find((p) => p.value === preset)) == null ? void 0 : _a2.label) ?? "";
  const calendarValue = pendingStart && pendingEnd ? `${pendingStart}--${pendingEnd}` : "";
  const canApply = !!(pendingStart && pendingEnd);
  const hasAppliedRange = !!(customStart && customEnd);
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
    /* @__PURE__ */ jsx("s-query-container", { children: /* @__PURE__ */ jsxs(
      "s-grid",
      {
        gridTemplateColumns: "@container (inline-size > 500px) 1fr 1fr, 1fr",
        gap: "base",
        "align-items": "end",
        children: [
          /* @__PURE__ */ jsxs("s-grid-item", { children: [
            /* @__PURE__ */ jsx("s-heading", { children: "Select Date Range" }),
            /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
            /* @__PURE__ */ jsx(
              "s-select",
              {
                label: "Date range",
                labelAccessibilityVisibility: "exclusive",
                value: preset,
                onChange: (e) => onPresetChange(e.target.value),
                children: DATE_PRESETS.map((p) => /* @__PURE__ */ jsx("s-option", { value: p.value, children: p.label }, p.value))
              }
            )
          ] }),
          /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(
            IntervalSelect,
            {
              labelCount,
              interval,
              onChange: onIntervalChange
            }
          ) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", "align-items": "center", children: [
      preset !== "custom" && /* @__PURE__ */ jsx("s-badge", { children: activeLabel }),
      /* @__PURE__ */ jsxs("s-badge", { tone: "info", children: [
        granularity,
        " view"
      ] }),
      preset === "custom" && hasAppliedRange && !showCalendar && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small-200", "align-items": "center", children: [
        /* @__PURE__ */ jsxs("s-badge", { tone: "success", children: [
          customStart,
          " to ",
          customEnd
        ] }),
        /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: () => setShowCalendar(true), children: "Edit" })
      ] })
    ] }),
    preset === "custom" && showCalendar && /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-date-picker",
        {
          type: "range",
          value: calendarValue,
          disallow: `${TOMORROW_STR}--`,
          onChange: handleDatePickerChange
        }
      ),
      /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", "align-items": "center", children: [
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "primary",
            disabled: canApply ? void 0 : true,
            onClick: handleApply,
            children: "Apply"
          }
        ),
        hasAppliedRange && /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: () => setShowCalendar(false), children: "Cancel" })
      ] })
    ] })
  ] }) });
};
const ReactApexChart = React.lazy(() => import("react-apexcharts"));
const StatCardNew = ({ label: label2, value, color }) => /* @__PURE__ */ jsxs("div", { style: {
  background: "var(--p-color-bg-surface-secondary)",
  borderRadius: "var(--p-border-radius-200)",
  padding: "1rem",
  borderTop: `3px solid ${color}`
}, children: [
  /* @__PURE__ */ jsx("s-heading", { tone: "subdued", children: label2 }),
  /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
  /* @__PURE__ */ jsx("p", { style: { fontSize: "22px", fontWeight: 500, margin: 0, color }, children: value })
] });
const ChartCard = ({ heading: heading2, chartKey, options, series, type = "bar", height = 300 }) => /* @__PURE__ */ jsx("s-section", { heading: heading2, children: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", "justify-content": "center", children: [
  /* @__PURE__ */ jsx("s-text", { children: "Loading chart..." }),
  /* @__PURE__ */ jsx("s-spinner", { "access-label": "Loading chart" })
] }), children: /* @__PURE__ */ jsx(ReactApexChart, { options, series, type, height }, chartKey) }) });
const COLORS$1 = {
  pointsEarned: "#1D9E75",
  pointsRedeemed: "#E24B4A",
  rewardsIssued: "#378ADD",
  activeRewards: "#BA7517",
  activeCustomers: "#534AB7"
};
function OverviewSection({ stats }) {
  return /* @__PURE__ */ jsx("s-section", { heading: "Overview", children: /* @__PURE__ */ jsx("s-query-container", { children: /* @__PURE__ */ jsxs(
    "s-grid",
    {
      gridTemplateColumns: "@container (inline-size > 600px) 1fr 1fr 1fr 1fr 1fr, 1fr",
      gap: "base",
      children: [
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Points earned", value: stats.pointsEarned.toLocaleString(), color: COLORS$1.pointsEarned }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Points redeemed", value: stats.pointsRedeemed.toLocaleString(), color: COLORS$1.pointsRedeemed }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Rewards issued", value: stats.rewardsIssued.toLocaleString(), color: COLORS$1.rewardsIssued }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Active rewards", value: stats.activeRewards.toLocaleString(), color: COLORS$1.activeRewards }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Active customers", value: stats.activeCustomers.toLocaleString(), color: COLORS$1.activeCustomers }) })
      ]
    }
  ) }) });
}
const COLORS = {
  total: "#534AB7",
  pending: "#BA7517",
  fulfilled: "#378ADD",
  completed: "#1D9E75",
  cancelled: "#E24B4A"
};
function PrizeStatsSection({ stats }) {
  return /* @__PURE__ */ jsx("s-section", { heading: "Physical Prizes", children: /* @__PURE__ */ jsx("s-query-container", { children: /* @__PURE__ */ jsxs(
    "s-grid",
    {
      gridTemplateColumns: "@container (inline-size > 600px) 1fr 1fr 1fr 1fr 1fr, 1fr",
      gap: "base",
      children: [
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Total claims", value: stats.total.toLocaleString(), color: COLORS.total }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Pending", value: stats.pending.toLocaleString(), color: COLORS.pending }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Fulfilled", value: stats.fulfilled.toLocaleString(), color: COLORS.fulfilled }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Completed", value: stats.completed.toLocaleString(), color: COLORS.completed }) }),
        /* @__PURE__ */ jsx("s-grid-item", { children: /* @__PURE__ */ jsx(StatCardNew, { label: "Cancelled", value: stats.cancelled.toLocaleString(), color: COLORS.cancelled }) })
      ]
    }
  ) }) });
}
function ChartsSection({ chartData, rangeKey, chartOptions }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      ChartCard,
      {
        heading: "Points activity",
        chartKey: `points-${rangeKey}`,
        options: chartOptions(["#1D9E75", "#E24B4A"]),
        series: [
          { name: "Earned", data: chartData.earned },
          { name: "Redeemed", data: chartData.redeemed }
        ],
        type: "bar",
        height: 320
      }
    ),
    /* @__PURE__ */ jsx(
      ChartCard,
      {
        heading: "Rewards issued",
        chartKey: `rewards-${rangeKey}`,
        options: chartOptions(["#378ADD"]),
        series: [{ name: "Rewards", data: chartData.rewards }],
        type: "area",
        height: 280
      }
    )
  ] });
}
function PrizeChartsSection({ chartData, rangeKey, chartOptions }) {
  return /* @__PURE__ */ jsx(
    ChartCard,
    {
      heading: "Physical prize activity",
      chartKey: `prize-activity-${rangeKey}`,
      options: chartOptions(["#BA7517", "#378ADD", "#1D9E75", "#E24B4A"]),
      series: [
        { name: "Pending", data: chartData.prizePending },
        { name: "Fulfilled", data: chartData.prizeFulfilled },
        { name: "Completed", data: chartData.prizeCompleted },
        { name: "Cancelled", data: chartData.prizeCancelled }
      ],
      type: "area",
      height: 320
    }
  );
}
const loader$j = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  return loadDashboardData(session.id);
};
const route$c = UNSAFE_withComponentProps(function Dashboard2() {
  const loaderData = useLoaderData();
  const page = useDashboardPage(loaderData);
  return /* @__PURE__ */ jsxs("s-page", {
    children: [/* @__PURE__ */ jsx(DateRangePicker, {
      preset: page.preset,
      onPresetChange: page.setPreset,
      customStart: page.customStart,
      customEnd: page.customEnd,
      onCustomApply: page.handleCustomApply,
      granularity: page.granularity,
      labelCount: page.labelCount,
      interval: page.interval,
      onIntervalChange: page.handleIntervalChange
    }), /* @__PURE__ */ jsx(OverviewSection, {
      stats: page.overviewStats
    }), /* @__PURE__ */ jsx(PrizeStatsSection, {
      stats: page.prizeStats
    }), /* @__PURE__ */ jsx(ChartsSection, {
      chartData: page.chartData,
      rangeKey: page.rangeKey,
      chartOptions: page.chartOptions
    }), /* @__PURE__ */ jsx(PrizeChartsSection, {
      chartData: page.chartData,
      rangeKey: page.rangeKey,
      chartOptions: page.chartOptions
    })]
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route$c,
  loader: loader$j
}, Symbol.toStringTag, { value: "Module" }));
const ALLOWED_PAGE_SIZES = [5, 10, 25, 50];
const DEFAULT_PAGE_SIZE$1 = 50;
const SORT_OPTIONS$1 = [
  { value: "enrolledAt-desc", label: "Latest enrolled" },
  { value: "enrolledAt-asc", label: "Oldest enrolled" },
  { value: "id-asc", label: "ID (ascending)" },
  { value: "id-desc", label: "ID (descending)" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "email-asc", label: "Email (A–Z)" },
  { value: "email-desc", label: "Email (Z–A)" },
  { value: "points-desc", label: "Points (high to low)" },
  { value: "points-asc", label: "Points (low to high)" }
];
const SORTABLE_FIELDS = /* @__PURE__ */ new Set(["id", "name", "email", "points", "enrolledAt"]);
function parseSortBy(raw) {
  const fallback = "enrolledAt-desc";
  if (!raw || typeof raw !== "string") return fallback;
  return SORT_OPTIONS$1.map((o) => o.value).includes(raw) ? raw : fallback;
}
function parsePageSize(raw) {
  const n = parseInt(raw, 10);
  return ALLOWED_PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE$1;
}
async function loadCustomers(sessionId, shop, searchParams) {
  var _a2;
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const search = ((_a2 = searchParams.get("search")) == null ? void 0 : _a2.trim().slice(0, 100)) || "";
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const [field, direction] = sortBy.split("-");
  const orderDir = direction === "asc" ? "asc" : "desc";
  const where = {
    sessionId,
    ...search && {
      OR: [
        { name: { startsWith: search, mode: "insensitive" } },
        { email: { startsWith: search, mode: "insensitive" } }
      ]
    }
  };
  try {
    const [[customers2, totalCount], activeSyncJob] = await Promise.all([
      prisma.$transaction([
        prisma.customer.findMany({
          where,
          orderBy: SORTABLE_FIELDS.has(field) ? { [field]: orderDir } : { enrolledAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            points: true,
            enrolledAt: true,
            activeStatus: true,
            _count: { select: { rewards: true, transactions: true } }
          }
        }),
        prisma.customer.count({ where })
      ]),
      // Check for an active sync job for this shop
      prisma.job.findFirst({
        where: {
          type: "CUSTOMER_SYNC",
          shop,
          status: { in: ["PENDING", "PROCESSING"] }
        },
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return {
      customers: customers2,
      totalCount,
      page,
      pageSize,
      search,
      sortBy,
      error: null,
      syncJobId: (activeSyncJob == null ? void 0 : activeSyncJob.id) ?? null,
      syncJobStatus: (activeSyncJob == null ? void 0 : activeSyncJob.status) ?? null
    };
  } catch (err) {
    console.error("[customers.loader]", err);
    return {
      customers: [],
      totalCount: 0,
      page: 1,
      pageSize,
      search,
      sortBy,
      error: "Failed to load customers.",
      syncJobId: null,
      syncJobStatus: null
    };
  }
}
const normalizeCustomerGid = (customerId) => {
  if (!customerId) return null;
  if (typeof customerId === "string" && customerId.startsWith("gid://shopify/Customer/")) {
    return customerId;
  }
  return `gid://shopify/Customer/${customerId}`;
};
const MODULE$b = "graphql/query/customers";
const CUSTOMER_FIELDS = `#graphql
    id
    firstName
    lastName
    defaultEmailAddress {
        emailAddress
        marketingState
    }
    defaultPhoneNumber {
        phoneNumber
        marketingState
        marketingCollectedFrom
    }
    createdAt
    updatedAt
    numberOfOrders
    state
    amountSpent {
        amount
        currencyCode
    }
    verifiedEmail
    taxExempt
    tags
`;
async function customers(admin) {
  var _a2;
  const allCustomers = [];
  let cursor = null;
  let hasNextPage = true;
  try {
    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
                query CustomerList($cursor: String) {
                    customers(first: 250, after: $cursor) {
                        nodes {
                            ${CUSTOMER_FIELDS}
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }`,
        { variables: { cursor } }
      );
      const json = await response.json();
      const data = (_a2 = json.data) == null ? void 0 : _a2.customers;
      if (!data) throw new Error("Invalid response from Shopify API");
      allCustomers.push(...data.nodes);
      hasNextPage = data.pageInfo.hasNextPage;
      cursor = data.pageInfo.endCursor;
    }
    return { customers: { nodes: allCustomers } };
  } catch (error) {
    logger.error(MODULE$b, "Failed to fetch customers", { error: error == null ? void 0 : error.message });
    return null;
  }
}
const customer = async (admin, id) => {
  var _a2;
  try {
    if (!id) throw new Error("Valid customer ID required");
    const gid = normalizeCustomerGid(id);
    const response = await admin.graphql(
      `#graphql
            query CustomerById($id: ID!) {
                customer(id: $id) {
                    ${CUSTOMER_FIELDS}
                }
            }`,
      { variables: { id: gid } }
    );
    const json = await response.json();
    return ((_a2 = json.data) == null ? void 0 : _a2.customer) ?? null;
  } catch (error) {
    logger.error(MODULE$b, "Failed to fetch customer", { error: error == null ? void 0 : error.message, id });
    return null;
  }
};
const customerOrderCount = async (admin, id) => {
  var _a2;
  if (!id) {
    logger.error(MODULE$b, "customerOrderCount: missing required id");
    return 0;
  }
  try {
    const numericId = String(id).includes("gid://") ? String(id).split("/").pop() : String(id);
    const response = await admin.graphql(
      `#graphql
            query CustomerOrderCount($query: String!) {
                ordersCount(query: $query) {
                    count
                    precision
                }
            }`,
      { variables: { query: `customer_id:${numericId}` } }
    );
    const json = await response.json();
    const result = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.ordersCount;
    if (!result) {
      logger.warn(MODULE$b, "customerOrderCount: no result from ordersCount query", { id, numericId });
      return 0;
    }
    logger.info(MODULE$b, "customerOrderCount resolved", {
      id,
      count: result.count,
      precision: result.precision
    });
    return result.count ?? 0;
  } catch (error) {
    logger.error(MODULE$b, "customerOrderCount: failed", { error: error == null ? void 0 : error.message, id });
    return 0;
  }
};
const PREFIX$1 = "NBL";
const MAX_ATTEMPTS$1 = 5;
function generateCode$1() {
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `${PREFIX$1}_${random}`;
}
async function generateReferralCode() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS$1; attempt++) {
    const code = generateCode$1();
    const exists = await prisma.customer.findUnique({
      where: { referralCode: code },
      select: { id: true }
    });
    if (!exists) {
      if (attempt > 1) {
        logger.info(`Referral code generated after ${attempt} attempts`, { code });
      }
      return code;
    }
    logger.warn(`Referral code collision on attempt ${attempt}/${MAX_ATTEMPTS$1}`, { code });
  }
  throw new Error(`Failed to generate a unique referral code after ${MAX_ATTEMPTS$1} attempts`);
}
const storeCustomer = async (session, customer2) => {
  var _a2;
  const email = ((_a2 = customer2 == null ? void 0 : customer2.defaultEmailAddress) == null ? void 0 : _a2.emailAddress) || (customer2 == null ? void 0 : customer2.email) || null;
  if (!email) {
    logger.warn("storeCustomer: no email in payload, skipping", {
      shopifyId: (customer2 == null ? void 0 : customer2.admin_graphql_api_id) || (customer2 == null ? void 0 : customer2.id)
    });
    return null;
  }
  const shopifyId = (customer2 == null ? void 0 : customer2.admin_graphql_api_id) || String(customer2.id);
  const name = `${customer2.firstName || customer2.first_name || ""} ${customer2.lastName || customer2.last_name || ""}`.trim();
  const referralCode = await generateReferralCode();
  if (!referralCode) {
    logger.error("storeCustomer: failed to generate referral code", {
      shopifyId,
      email
    });
    return null;
  }
  try {
    return await prisma.customer.upsert({
      where: {
        shopifyId
      },
      update: {
        email,
        name: name || null,
        firstName: customer2.firstName || customer2.first_name || null,
        lastName: customer2.lastName || customer2.last_name || null,
        metadata: customer2
      },
      create: {
        shopifyId,
        name: name || null,
        firstName: customer2.firstName || customer2.first_name || null,
        lastName: customer2.lastName || customer2.last_name || null,
        email,
        referralCode,
        sessionId: session.id,
        metadata: customer2
      }
    });
  } catch (error) {
    logger.error("storeCustomer: upsert failed", {
      shopifyId,
      email,
      error: error == null ? void 0 : error.message
    });
    return null;
  }
};
const BATCH_SIZE = 10;
async function oldCustomerStoreFromShop(admin, session) {
  var _a2;
  const response = await customers(admin);
  if (!((_a2 = response == null ? void 0 : response.customers) == null ? void 0 : _a2.nodes)) {
    throw new Error("Invalid response from Shopify API");
  }
  const allCustomers = response.customers.nodes;
  const results = { total: allCustomers.length, success: 0, failed: 0, errors: [] };
  for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
    const batch = allCustomers.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((c) => storeCustomer(session, c)));
    settled.forEach((result, idx) => {
      var _a3, _b;
      if (result.status === "fulfilled") {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ customerId: (_a3 = batch[idx]) == null ? void 0 : _a3.id, reason: (_b = result.reason) == null ? void 0 : _b.message });
      }
    });
  }
  return results;
}
const MODULE$a = "customerSyncProcessor";
async function processCustomerSync(admin, session, jobId) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "PROCESSING", lockedAt: /* @__PURE__ */ new Date(), attempts: { increment: 1 } }
  });
  logger.info(MODULE$a, "Customer sync started", { shop: session.shop, jobId });
  try {
    const result = await oldCustomerStoreFromShop(admin, session);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: /* @__PURE__ */ new Date(),
        lockedAt: null,
        payload: {
          shop: session.shop,
          sessionId: session.id,
          result: { total: result.total, success: result.success, failed: result.failed }
        }
      }
    });
    logger.success(MODULE$a, "Customer sync completed", {
      shop: session.shop,
      jobId,
      total: result.total,
      success: result.success,
      failed: result.failed
    });
  } catch (err) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: (err == null ? void 0 : err.message) ?? "Unknown error",
        failedAt: /* @__PURE__ */ new Date()
      }
    });
    logger.error(MODULE$a, "Customer sync failed", {
      shop: session.shop,
      jobId,
      error: err == null ? void 0 : err.message
    });
    throw err;
  }
}
async function handleSyncCustomers({ admin, session }) {
  const submitType = "sync-customers";
  const existing = await prisma.job.findFirst({
    where: {
      type: "CUSTOMER_SYNC",
      shop: session.shop,
      status: { in: ["PENDING", "PROCESSING"] }
    },
    select: { id: true, status: true }
  });
  if (existing) {
    return Response.json({
      message: "Sync is already in progress.",
      isError: false,
      submitType,
      syncJobId: existing.id,
      syncStatus: existing.status
    });
  }
  const job = await prisma.job.create({
    data: {
      type: "CUSTOMER_SYNC",
      shop: session.shop,
      status: "PENDING",
      idempotencyKey: `CUSTOMER_SYNC:${session.shop}:${Date.now()}`,
      payload: { shop: session.shop, sessionId: session.id }
    }
  });
  setImmediate(() => {
    processCustomerSync(admin, session, job.id).catch((err) => {
      console.error(`[customerSync] Background error for job #${job.id}:`, err == null ? void 0 : err.message);
    });
  });
  return Response.json({
    message: "Sync started.",
    isError: false,
    submitType,
    syncJobId: job.id,
    syncStatus: "PROCESSING"
  });
}
const POLL_INTERVAL_MS = 3e3;
function useCustomersPage(loaderData, actionData) {
  var _a2;
  const submit = useSubmit();
  const nav = useNavigation();
  const navigate = useNavigate();
  const shopify2 = useAppBridge();
  const { revalidate } = useRevalidator();
  const {
    customers: customers2 = [],
    totalCount = 0,
    page,
    pageSize,
    search,
    sortBy,
    error,
    syncJobId,
    syncJobStatus
  } = loaderData ?? {};
  const isSubmittingSync = nav.state === "submitting" && nav.formMethod === "POST";
  const isSyncRunning = isSubmittingSync || ["PENDING", "PROCESSING"].includes(syncJobStatus);
  const pollRef = useRef(null);
  useEffect(() => {
    if (isSyncRunning && !isSubmittingSync) {
      pollRef.current = setInterval(() => revalidate(), POLL_INTERVAL_MS);
    } else {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => clearInterval(pollRef.current);
  }, [isSyncRunning, isSubmittingSync, revalidate]);
  const prevSyncStatus = useRef(syncJobStatus);
  useEffect(() => {
    const wasRunning = ["PENDING", "PROCESSING"].includes(prevSyncStatus.current);
    const isNowDone = syncJobStatus === "COMPLETED" || syncJobStatus === null;
    if (wasRunning && isNowDone && prevSyncStatus.current !== null) {
      shopify2.toast.show("Customers synced successfully.");
    }
    if (syncJobStatus === "FAILED") {
      shopify2.toast.show("Sync failed. Please try again.", { isError: true });
    }
    prevSyncStatus.current = syncJobStatus;
  }, [syncJobStatus, shopify2]);
  useEffect(() => {
    if (!(actionData == null ? void 0 : actionData.message)) return;
    if (actionData.submitType === "sync-customers") return;
    shopify2.toast.show(actionData.message, { isError: actionData.isError ?? false });
  }, [actionData, shopify2]);
  const [navigatingTo, setNavigatingTo] = useState(null);
  useEffect(() => {
    if (nav.state === "idle") setNavigatingTo(null);
  }, [nav.state]);
  const isLoading = nav.state === "loading" && nav.formMethod !== "POST" && navigatingTo === null && ((_a2 = nav.location) == null ? void 0 : _a2.pathname) === window.location.pathname;
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef(null);
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);
  const updateURL = useCallback((params) => {
    const next = new URLSearchParams({
      search: params.search ?? search,
      sortBy: params.sortBy ?? sortBy,
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? pageSize)
    });
    submit(next, { method: "GET", replace: true });
  }, [submit, search, sortBy, pageSize]);
  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setLocalSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateURL({ search: val, page: 1 }), 400);
  }, [updateURL]);
  const handleSortChange = useCallback((e) => updateURL({ sortBy: e.target.value, page: 1 }), [updateURL]);
  const handlePageChange = useCallback((p) => updateURL({ page: p }), [updateURL]);
  const handlePageSizeChange = useCallback((pp) => updateURL({ pageSize: pp, page: 1 }), [updateURL]);
  const handleSync = useCallback(() => {
    submit({ submitType: "sync-customers" }, { method: "POST" });
  }, [submit]);
  const handleDetails = useCallback((customerId) => {
    setNavigatingTo(customerId);
    navigate(`/app/customers/${customerId}`);
  }, [navigate]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    customers: customers2,
    totalCount,
    totalPages,
    page,
    pageSize,
    search,
    sortBy,
    localSearch,
    loaderError: error,
    isSyncRunning,
    isLoading,
    navigatingTo,
    handleSearch,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
    handleSync,
    handleDetails
  };
}
const DEFAULT_PER_PAGE_OPTIONS = [5, 10, 25, 50];
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
function navBtnStyle(disabled) {
  return {
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid var(--p-color-border, #c9cccf)",
    background: disabled ? "var(--p-color-bg-surface-disabled, #f1f2f3)" : "var(--p-color-bg-surface, #fff)",
    color: disabled ? "var(--p-color-text-disabled, #a4a6a8)" : "var(--p-color-text, #202223)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: "500",
    transition: "background 0.15s"
  };
}
function pageBtnStyle(isActive) {
  return {
    padding: "4px 10px",
    borderRadius: "6px",
    border: isActive ? "1px solid var(--p-color-border-interactive, #2c6ecb)" : "1px solid var(--p-color-border, #c9cccf)",
    background: isActive ? "var(--p-color-bg-interactive, #2c6ecb)" : "var(--p-color-bg-surface, #fff)",
    color: isActive ? "#fff" : "var(--p-color-text, #202223)",
    cursor: isActive ? "default" : "pointer",
    fontSize: "13px",
    fontWeight: isActive ? "600" : "400",
    minWidth: "32px",
    transition: "all 0.15s"
  };
}
function Pagination({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  startIndex,
  setCurrentPage,
  setPerPage,
  label: label2 = "items",
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS
}) {
  const endIndex = Math.min(startIndex + perPage, totalItems);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginTop: "16px",
        paddingTop: "16px",
        borderTop: "1px solid var(--p-color-border)"
      },
      children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", color: "var(--p-color-text-secondary, #6d7175)" }, children: totalItems === 0 ? `No ${label2}` : `Showing ${startIndex + 1}–${endIndex} of ${totalItems} ${label2}` }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  fontSize: "13px",
                  color: "var(--p-color-text-secondary, #6d7175)",
                  whiteSpace: "nowrap"
                },
                children: "Per page:"
              }
            ),
            /* @__PURE__ */ jsx(
              "select",
              {
                value: perPage,
                onChange: (e) => setPerPage(Number(e.target.value)),
                style: {
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--p-color-border, #c9cccf)",
                  fontSize: "13px",
                  background: "var(--p-color-bg-surface, #fff)",
                  color: "var(--p-color-text, #202223)",
                  cursor: "pointer"
                },
                children: perPageOptions.map((opt) => /* @__PURE__ */ jsx("option", { value: opt, children: opt }, opt))
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCurrentPage(1),
              disabled: currentPage === 1,
              title: "First page",
              style: navBtnStyle(currentPage === 1),
              children: "«"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
              disabled: currentPage === 1,
              title: "Previous page",
              style: navBtnStyle(currentPage === 1),
              children: "‹"
            }
          ),
          getPageNumbers(currentPage, totalPages).map(
            (page, i) => page === "..." ? /* @__PURE__ */ jsx(
              "span",
              {
                style: { padding: "0 4px", color: "var(--p-color-text-secondary, #6d7175)" },
                children: "…"
              },
              `ellipsis-${i}`
            ) : /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCurrentPage(page),
                style: pageBtnStyle(page === currentPage),
                children: page
              },
              page
            )
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
              disabled: currentPage === totalPages,
              title: "Next page",
              style: navBtnStyle(currentPage === totalPages),
              children: "›"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCurrentPage(totalPages),
              disabled: currentPage === totalPages,
              title: "Last page",
              style: navBtnStyle(currentPage === totalPages),
              children: "»"
            }
          )
        ] })
      ]
    }
  );
}
function CustomerTable({
  customers: customers2,
  totalCount,
  totalPages,
  page,
  pageSize,
  localSearch,
  sortBy,
  isLoading,
  navigatingTo,
  loaderError,
  onSearch,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onDetails
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", gap: "base", children: [
      /* @__PURE__ */ jsxs("h2", { style: { margin: 0 }, children: [
        "Customers (",
        totalCount.toLocaleString(),
        ")"
      ] }),
      /* @__PURE__ */ jsx(
        "s-search-field",
        {
          label: "Search customers",
          labelAccessibilityVisibility: "exclusive",
          placeholder: "Search by name or email",
          value: localSearch,
          onInput: onSearch,
          disabled: isLoading
        }
      ),
      /* @__PURE__ */ jsx(
        "s-select",
        {
          label: "Sort by",
          labelAccessibilityVisibility: "exclusive",
          value: sortBy,
          onChange: onSortChange,
          disabled: isLoading,
          children: SORT_OPTIONS$1.map((o) => /* @__PURE__ */ jsx("s-option", { value: o.value, children: o.label }, o.value))
        }
      )
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlock: "base", children: /* @__PURE__ */ jsx("s-divider", {}) }),
    loaderError && /* @__PURE__ */ jsx("s-banner", { tone: "critical", style: { marginBottom: "16px" }, children: loaderError }),
    isLoading ? /* @__PURE__ */ jsx("s-box", { padding: "base", style: { textAlign: "center", minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx("s-spinner", {}) }) : /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Customer" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Events" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Rewards" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Enrolled At" }),
        /* @__PURE__ */ jsx("s-table-header", {})
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: customers2.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: 6, style: { textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)", padding: "32px 0" }, children: localSearch ? `No customers found for "${localSearch}".` : "No customers yet. Click Sync Customers to get started." }) }) : customers2.map((c) => {
        const isThisNavigating = navigatingTo === c.id;
        const isOtherNavigating = navigatingTo !== null && navigatingTo !== c.id;
        return /* @__PURE__ */ jsxs("s-table-row", { children: [
          /* @__PURE__ */ jsxs("s-table-cell", { children: [
            /* @__PURE__ */ jsx("s-heading", { children: c.name || "N/A" }),
            /* @__PURE__ */ jsx("s-box", {}),
            /* @__PURE__ */ jsx("s-text", { children: c.email || "N/A" })
          ] }),
          /* @__PURE__ */ jsx("s-table-cell", { children: c._count.transactions }),
          /* @__PURE__ */ jsx("s-table-cell", { children: c.points.toLocaleString() }),
          /* @__PURE__ */ jsx("s-table-cell", { children: c._count.rewards }),
          /* @__PURE__ */ jsx("s-table-cell", { children: c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : "N/A" }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              loading: isThisNavigating,
              disabled: isThisNavigating || isOtherNavigating,
              onClick: () => onDetails(c.id),
              children: isThisNavigating ? "Loading…" : "Details"
            }
          ) })
        ] }, c.id);
      }) })
    ] }),
    !loaderError && totalCount > 0 && /* @__PURE__ */ jsx(
      Pagination,
      {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        perPage: pageSize,
        startIndex: (page - 1) * pageSize,
        setCurrentPage: onPageChange,
        setPerPage: onPageSizeChange,
        label: "customers",
        perPageOptions: ALLOWED_PAGE_SIZES
      }
    )
  ] });
}
const loader$i = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const url = new URL(request.url);
  return loadCustomers(session.id, session.shop, url.searchParams);
};
const action$p = async ({
  request
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const ctx = {
    session,
    admin
  };
  switch (submitType) {
    case "sync-customers":
      return handleSyncCustomers(ctx);
    default:
      return Response.json({
        message: "Unknown action.",
        isError: true
      });
  }
};
const route$b = UNSAFE_withComponentProps(function Customers() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = useCustomersPage(loaderData, actionData);
  return /* @__PURE__ */ jsxs("s-page", {
    title: "Customers",
    inlineSize: "base",
    children: [/* @__PURE__ */ jsx("s-button", {
      slot: "primary-action",
      variant: "primary",
      icon: "refresh",
      loading: page.isSyncRunning,
      disabled: page.isSyncRunning,
      onClick: page.handleSync,
      children: page.isSyncRunning ? "Syncing…" : "Sync Customers"
    }), /* @__PURE__ */ jsx(CustomerTable, {
      customers: page.customers,
      totalCount: page.totalCount,
      totalPages: page.totalPages,
      page: page.page,
      pageSize: page.pageSize,
      localSearch: page.localSearch,
      sortBy: page.sortBy,
      isLoading: page.isLoading,
      navigatingTo: page.navigatingTo,
      loaderError: page.loaderError,
      onSearch: page.handleSearch,
      onSortChange: page.handleSortChange,
      onPageChange: page.handlePageChange,
      onPageSizeChange: page.handlePageSizeChange,
      onDetails: page.handleDetails
    })]
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$p,
  default: route$b,
  loader: loader$i
}, Symbol.toStringTag, { value: "Module" }));
async function loadCustomerDetails(admin, sessionId, customerId) {
  const customer2 = await prisma.customer.findFirst({
    where: {
      sessionId,
      id: customerId ? parseInt(customerId) : void 0
    },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        include: { event: true }
      },
      rewards: { orderBy: { createdAt: "desc" } },
      referralsSent: true,
      referralsUsed: true
    }
  });
  if (!customer2) return { customer: null };
  const orderCount = await customerOrderCount(admin, customer2.shopifyId);
  return { customer: { ...customer2, orderCount } };
}
const DEFAULT_TRANSACTION_SELECT = {
  id: true,
  customerId: true,
  type: true,
  points: true,
  balanceAfter: true,
  status: true,
  reason: true,
  activity: true,
  eventId: true,
  rewardId: true,
  referralId: true,
  pointsRuleId: true,
  expiresAt: true,
  metadata: true,
  createdAt: true,
  notifiedAt: true
};
async function createTransaction(input2, session, select = DEFAULT_TRANSACTION_SELECT) {
  try {
    return await prisma.$transaction(async (tx) => {
      const customer2 = await tx.customer.findUnique({
        where: { id: input2.customerId },
        select: {
          points: true,
          lifetimePoints: true,
          sessionId: true
        }
      });
      if (!customer2) {
        throw new Error("Customer not found");
      }
      if (customer2.sessionId !== session.id) {
        throw new Error("Unauthorized: customer does not belong to this shop");
      }
      const amount = Number(input2.points);
      let signedPoints;
      let newBalance;
      let newLifetimePoints = customer2.lifetimePoints;
      switch (input2.type) {
        case "EARN":
        case "REFERRAL":
          signedPoints = amount;
          newBalance = customer2.points + amount;
          newLifetimePoints += amount;
          break;
        case "REDEEM":
        case "EXPIRE":
          if (amount > customer2.points) {
            throw new Error(
              `Insufficient points: has ${customer2.points}, attempted ${amount}`
            );
          }
          signedPoints = -amount;
          newBalance = customer2.points - amount;
          break;
        case "ADJUST":
          signedPoints = amount;
          newBalance = Math.max(0, customer2.points + amount);
          newLifetimePoints += amount;
          break;
        case "REVERSAL":
          signedPoints = amount;
          newBalance = Math.max(0, customer2.points + amount);
          break;
        default:
          throw new Error(`Unknown transaction type: ${input2.type}`);
      }
      const transaction = await tx.transaction.create({
        data: {
          customerId: input2.customerId,
          type: input2.type,
          points: signedPoints,
          balanceAfter: newBalance,
          status: input2.status ?? "COMPLETED",
          reason: input2.reason ?? null,
          activity: input2.activity ?? null,
          eventId: input2.eventId ?? null,
          rewardId: input2.rewardId ?? null,
          referralId: input2.referralId ?? null,
          pointsRuleId: input2.pointsRuleId ?? null,
          expiresAt: input2.expiresAt ?? null,
          metadata: input2.metadata ?? {},
          notifiedAt: input2.notifiedAt ?? null
        },
        select
      });
      await tx.customer.update({
        where: { id: input2.customerId },
        data: {
          points: newBalance,
          lifetimePoints: newLifetimePoints
        }
      });
      logger.info("Transaction created", {
        transactionId: transaction.id,
        customerId: input2.customerId,
        type: input2.type,
        points: signedPoints,
        balanceAfter: newBalance
      });
      return transaction;
    });
  } catch (error) {
    logger.error("Failed to create transaction", {
      error: error == null ? void 0 : error.message,
      input: input2,
      module: "createTransaction.js"
    });
    return null;
  }
}
const CUSTOMER_SELECT = {
  id: true,
  shopifyId: true,
  points: true,
  referralCode: true,
  // ActivityRow + the toast notification list read: id, type, points,
  // activity, reason (fallback text), createdAt, notifiedAt. Nothing reads
  // the nested `reward` sub-object that used to be included here.
  transactions: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      points: true,
      activity: true,
      reason: true,
      createdAt: true,
      notifiedAt: true
    }
  },
  // ActiveRewardItem + the discountUsed/status filters (Home/Rewards/
  // Activities tabs) are all that touch this array.
  rewards: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      discountUsed: true,
      status: true
    }
  },
  // referralsSent / referralsUsed removed entirely — grep confirms nothing
  // in app/widget-ui reads them. Dashboard pages and orderPaidJob.js query
  // these directly from Postgres themselves; they don't go through this
  // metafield, so dropping them here doesn't affect either.
  prizeClaims: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      pointsCost: true,
      physicalPrizeId: true
    }
  }
};
const buildMetafield = (customer2) => {
  const bm = {
    namespace: "app",
    key: "nbl_customer_v1",
    value: JSON.stringify({
      appName: "North Borders Loyalty App",
      ...customer2
    }),
    type: "json",
    ownerId: customer2.shopifyId
  };
  return bm;
};
const syncCustomerConfig = async (admin, customerId) => {
  var _a2;
  try {
    let customer2 = null;
    let normalizedId = null;
    if (((_a2 = customerId == null ? void 0 : customerId.toString()) == null ? void 0 : _a2.length) <= 6) {
      customer2 = await prisma.customer.findFirst({
        where: { id: Number(customerId) },
        select: CUSTOMER_SELECT
      });
    } else {
      normalizedId = normalizeCustomerGid(customerId);
      if (!normalizedId) {
        throw new Error("Customer ID is required");
      }
      customer2 = await prisma.customer.findFirst({
        where: { shopifyId: normalizedId },
        select: CUSTOMER_SELECT
      });
    }
    if (!customer2) {
      throw new Error(`Customer not found: ${normalizedId ?? customerId}`);
    }
    await configMetafieldSyncMutation(admin, buildMetafield(customer2));
    return customer2;
  } catch (error) {
    logger.error("## Error in syncCustomerConfig:", error);
    return null;
  }
};
async function handleAdjustPoints({ formData, session, admin }) {
  var _a2;
  const submitType = "adjustPoints";
  const customerId = parseInt(formData.get("customerId"), 10);
  const shopifyId = formData.get("shopifyId");
  const mode = formData.get("mode");
  const amount = parseInt(formData.get("amount"), 10);
  const reason = ((_a2 = formData.get("reason")) == null ? void 0 : _a2.trim()) || null;
  if (!customerId) return { message: "Customer ID is required.", status: "error", submitType };
  if (!["add", "remove"].includes(mode)) return { message: "Invalid mode.", status: "error", submitType };
  if (!amount || amount <= 0) return { message: "Points must be greater than 0.", status: "error", submitType };
  const signedPoints = mode === "add" ? amount : -amount;
  try {
    const tx = await createTransaction({
      customerId,
      type: "ADJUST",
      points: signedPoints,
      reason: reason ?? `Admin ${mode === "add" ? "added" : "removed"} ${amount} points`,
      activity: `Admin ${mode === "add" ? "added" : "removed"} ${amount} points`,
      status: "COMPLETED"
    }, session);
    if (!tx) return { message: "Failed to adjust points.", status: "error", submitType };
    await syncCustomerConfig(admin, shopifyId);
    return {
      message: `${amount.toLocaleString()} points ${mode === "add" ? "added" : "removed"} successfully.`,
      status: "success",
      submitType,
      balanceAfter: tx.balanceAfter
    };
  } catch (err) {
    console.error("[adjustPoints]", err);
    return { message: err.message || "Failed to adjust points.", status: "error", submitType };
  }
}
function usePagination(data = [], defaultPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  useEffect(() => {
    setCurrentPage(1);
  }, [perPage, totalItems]);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedData = data.slice(startIndex, startIndex + perPage);
  return {
    currentPage,
    setCurrentPage,
    perPage,
    setPerPage,
    totalPages,
    totalItems,
    paginatedData,
    startIndex
  };
}
function useCustomerDetailsPage(loaderData, actionData) {
  var _a2;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify2 = useAppBridge();
  const customer2 = (loaderData == null ? void 0 : loaderData.customer) ?? {};
  const customerLabel = (customer2 == null ? void 0 : customer2.name) || (customer2 == null ? void 0 : customer2.email) || "Customer Details";
  const isSubmitting = navigation.state === "submitting";
  const pendingSubmit = (_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType");
  const isAdjusting = isSubmitting && pendingSubmit === "adjustPoints";
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
  }, [actionData, shopify2]);
  const handleBack = () => navigate("/app/customers", { replace: true });
  const handleAdjustPoints2 = ({ mode, amount, reason }) => {
    submit({
      submitType: "adjustPoints",
      customerId: String(customer2.id),
      shopifyId: customer2.shopifyId,
      mode,
      amount: String(amount),
      reason: reason || ""
    }, { method: "POST" });
  };
  const txPagination = usePagination((customer2 == null ? void 0 : customer2.transactions) ?? [], 25);
  const rwPagination = usePagination((customer2 == null ? void 0 : customer2.rewards) ?? [], 25);
  return {
    customer: customer2,
    customerLabel,
    isAdjusting,
    handleBack,
    handleAdjustPoints: handleAdjustPoints2,
    txPagination,
    rwPagination
  };
}
function SummaryCard({ customer: customer2 }) {
  var _a2, _b, _c;
  return /* @__PURE__ */ jsxs("s-box", { padding: "base", border: "base", borderRadius: "base", background: "base", children: [
    /* @__PURE__ */ jsx("h3", { style: { marginTop: 0 }, children: "Summary" }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Email:" }),
      " ",
      (customer2 == null ? void 0 : customer2.email) ?? "N/A"
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Lifetime Points:" }),
      " ",
      ((customer2 == null ? void 0 : customer2.lifetimePoints) ?? 0).toLocaleString()
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Rewards claimed:" }),
      " ",
      ((_a2 = customer2 == null ? void 0 : customer2.rewards) == null ? void 0 : _a2.length) ?? 0
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Referral Code:" }),
      " ",
      (customer2 == null ? void 0 : customer2.referralCode) ?? "N/A"
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Referrals Sent:" }),
      " ",
      ((_b = customer2 == null ? void 0 : customer2.referralsSent) == null ? void 0 : _b.length) ?? 0
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("strong", { children: "Referral Used:" }),
      " ",
      ((_c = customer2 == null ? void 0 : customer2.referralsUsed) == null ? void 0 : _c.status) ?? "N/A"
    ] })
  ] });
}
function StatBox({ label: label2, value }) {
  return /* @__PURE__ */ jsxs("s-box", { padding: "base", border: "base", borderRadius: "base", background: "base", children: [
    /* @__PURE__ */ jsx("s-heading", { children: label2 }),
    /* @__PURE__ */ jsx("h3", { style: { marginBlock: "4px 0" }, children: value })
  ] });
}
function StatsGrid({ customer: customer2 }) {
  var _a2, _b, _c;
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
    /* @__PURE__ */ jsx(StatBox, { label: "Current Points", value: ((customer2 == null ? void 0 : customer2.points) ?? 0).toLocaleString() }),
    /* @__PURE__ */ jsx(StatBox, { label: "Lifetime Points", value: ((customer2 == null ? void 0 : customer2.lifetimePoints) ?? 0).toLocaleString() }),
    /* @__PURE__ */ jsx(StatBox, { label: "Activities Completed", value: ((_a2 = customer2 == null ? void 0 : customer2.transactions) == null ? void 0 : _a2.length) ?? 0 }),
    /* @__PURE__ */ jsx(StatBox, { label: "Rewards Claimed", value: ((_b = customer2 == null ? void 0 : customer2.rewards) == null ? void 0 : _b.length) ?? 0 }),
    /* @__PURE__ */ jsx(StatBox, { label: "Total Orders", value: (customer2 == null ? void 0 : customer2.orderCount) ?? "N/A" }),
    /* @__PURE__ */ jsx(StatBox, { label: "Referrals Used", value: ((_c = customer2 == null ? void 0 : customer2.referralsUsed) == null ? void 0 : _c.status) ?? "N/A" })
  ] });
}
const MODAL_ID$2 = "adjust-points-modal";
function AdjustPointsModal({ customer: customer2, isAdjusting, onConfirm }) {
  const modalRef = useRef(null);
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const currentPoints = (customer2 == null ? void 0 : customer2.points) ?? 0;
  const parsedAmount = Math.max(0, parseInt(amount, 10) || 0);
  const previewBalance = mode === "add" ? currentPoints + parsedAmount : Math.max(0, currentPoints - parsedAmount);
  const insufficientBalance = mode === "remove" && parsedAmount > currentPoints;
  const isValid = parsedAmount > 0 && !insufficientBalance;
  const reset = useCallback(() => {
    setMode("add");
    setAmount("");
    setReason("");
  }, []);
  const handleConfirm = useCallback(() => {
    var _a2;
    if (!isValid) return;
    (_a2 = modalRef.current) == null ? void 0 : _a2.hideOverlay();
    onConfirm({ mode, amount: parsedAmount, reason });
    reset();
  }, [isValid, mode, parsedAmount, reason, onConfirm, reset]);
  const toggleStyle = (active) => ({
    flex: 1,
    padding: "8px 0",
    borderRadius: "6px",
    border: active ? `2px solid ${mode === "add" ? "#1D9E75" : "#E24B4A"}` : "2px solid var(--p-color-border, #c9cccf)",
    background: active ? mode === "add" ? "#f0faf6" : "#fdf2f2" : "var(--p-color-bg-surface, #fff)",
    color: active ? mode === "add" ? "#1D9E75" : "#E24B4A" : "var(--p-color-text-secondary, #6d7175)",
    fontWeight: active ? 600 : 400,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.15s"
  });
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(
    "s-modal",
    {
      ref: modalRef,
      id: MODAL_ID$2,
      heading: "Adjust Points",
      size: "base",
      onHide: reset,
      children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "20px" }, children: [
          /* @__PURE__ */ jsx("button", { style: toggleStyle(mode === "add"), onClick: () => setMode("add"), children: "+ Add Points" }),
          /* @__PURE__ */ jsx("button", { style: toggleStyle(mode === "remove"), onClick: () => setMode("remove"), children: "− Remove Points" })
        ] }),
        /* @__PURE__ */ jsx(
          "s-number-field",
          {
            label: "Points",
            placeholder: "0",
            min: "1",
            step: "1",
            value: amount,
            onInput: (e) => setAmount(e.target.value),
            error: amount && !isValid ? insufficientBalance ? `Customer only has ${currentPoints.toLocaleString()} points.` : "Points must be greater than 0." : null
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        parsedAmount > 0 && /* @__PURE__ */ jsxs("div", { style: {
          background: "var(--p-color-bg-surface-secondary)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "var(--p-color-text-secondary, #6d7175)"
        }, children: [
          "Preview:",
          " ",
          /* @__PURE__ */ jsx("strong", { style: { color: "var(--p-color-text)" }, children: currentPoints.toLocaleString() }),
          " → ",
          /* @__PURE__ */ jsxs("strong", { style: { color: mode === "add" ? "#1D9E75" : "#E24B4A" }, children: [
            previewBalance.toLocaleString(),
            " pts"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "s-text-area",
          {
            label: "Reason (optional)",
            placeholder: "Manually adjusting points for customer",
            value: reason,
            onInput: (e) => setReason(e.target.value)
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", justifyContent: "end", children: [
          /* @__PURE__ */ jsx("s-button", { commandFor: MODAL_ID$2, command: "--hide", children: "Cancel" }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "primary",
              icon: mode === "add" ? "plus-circle" : "minus-circle",
              disabled: !isValid || isAdjusting,
              loading: isAdjusting,
              onClick: handleConfirm,
              children: mode === "add" ? "Add Points" : "Remove Points"
            }
          )
        ] })
      ]
    }
  ) });
}
function TransactionsTable({ pagination }) {
  const { paginatedData: transactions } = pagination;
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("h3", { style: { marginTop: 0 }, children: "Transaction History" }),
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Date" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Type" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Balance After" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Note" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: transactions.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: 5, style: { textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)" }, children: "No transactions found." }) }) : transactions.map((tx) => {
        var _a2;
        return /* @__PURE__ */ jsxs("s-table-row", { children: [
          /* @__PURE__ */ jsx("s-table-cell", { children: new Date(tx.createdAt).toLocaleDateString() }),
          /* @__PURE__ */ jsx("s-table-cell", { children: ((_a2 = tx.event) == null ? void 0 : _a2.type) ?? tx.type }),
          /* @__PURE__ */ jsxs("s-table-cell", { style: { color: tx.points >= 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }, children: [
            tx.points >= 0 ? "+" : "",
            tx.points.toLocaleString()
          ] }),
          /* @__PURE__ */ jsx("s-table-cell", { children: tx.balanceAfter.toLocaleString() }),
          /* @__PURE__ */ jsx("s-table-cell", { children: tx.reason ?? "—" })
        ] }, tx.id);
      }) })
    ] }),
    /* @__PURE__ */ jsx(Pagination, { ...pagination, label: "transactions" })
  ] });
}
function RewardsTable({ pagination }) {
  const { paginatedData: rewards } = pagination;
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("h3", { style: { marginTop: 0 }, children: "Rewards History" }),
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Date" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Title" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Type" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points Cost" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Status" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: rewards.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: 5, style: { textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)" }, children: "No rewards found." }) }) : rewards.map((rw) => /* @__PURE__ */ jsxs("s-table-row", { children: [
        /* @__PURE__ */ jsx("s-table-cell", { children: new Date(rw.createdAt).toLocaleDateString() }),
        /* @__PURE__ */ jsx("s-table-cell", { children: rw.title ?? "—" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: rw.type ?? "—" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: (rw.pointsCost ?? 0).toLocaleString() }),
        /* @__PURE__ */ jsx("s-table-cell", { children: rw.status ?? "—" })
      ] }, rw.id)) })
    ] }),
    /* @__PURE__ */ jsx(Pagination, { ...pagination, label: "rewards" })
  ] });
}
const loader$h = async ({
  request,
  params
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  return loadCustomerDetails(admin, session.id, params.id);
};
const action$o = async ({
  request
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const ctx = {
    formData,
    session,
    admin
  };
  switch (submitType) {
    case "adjustPoints":
      return handleAdjustPoints(ctx);
    default:
      return {
        message: "Invalid action.",
        status: "error",
        submitType
      };
  }
};
const route$a = UNSAFE_withComponentProps(function CustomerDetails() {
  var _a2;
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = useCustomerDetailsPage(loaderData, actionData);
  if (!((_a2 = page.customer) == null ? void 0 : _a2.id)) {
    return /* @__PURE__ */ jsx("s-page", {
      children: /* @__PURE__ */ jsx("s-section", {
        children: /* @__PURE__ */ jsx("s-banner", {
          tone: "critical",
          children: "Customer not found."
        })
      })
    });
  }
  return /* @__PURE__ */ jsxs("s-page", {
    children: [/* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsxs("s-grid", {
        gridTemplateColumns: "1fr auto",
        gap: "base",
        alignItems: "center",
        children: [/* @__PURE__ */ jsxs("s-box", {
          children: [/* @__PURE__ */ jsxs("s-stack", {
            direction: "inline",
            gap: "small-200",
            alignItems: "center",
            children: [/* @__PURE__ */ jsx("s-button", {
              variant: "secondary",
              size: "small",
              onClick: page.handleBack,
              children: "Customers"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "›"
            }), /* @__PURE__ */ jsx("s-text", {
              children: page.customerLabel
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "small"
          }), /* @__PURE__ */ jsx("s-heading", {
            children: /* @__PURE__ */ jsxs("s-badge", {
              children: ["Details about: '", page.customerLabel, "'"]
            })
          })]
        }), /* @__PURE__ */ jsx("s-button", {
          variant: "primary",
          icon: "plus-circle",
          command: "--show",
          commandFor: "adjust-points-modal",
          children: "Adjust Points"
        })]
      })
    }), /* @__PURE__ */ jsx(AdjustPointsModal, {
      customer: page.customer,
      isAdjusting: page.isAdjusting,
      onConfirm: page.handleAdjustPoints
    }), /* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsxs("s-grid", {
        gridTemplateColumns: "1fr 2fr",
        gap: "base",
        children: [/* @__PURE__ */ jsx(SummaryCard, {
          customer: page.customer
        }), /* @__PURE__ */ jsx(StatsGrid, {
          customer: page.customer
        })]
      })
    }), /* @__PURE__ */ jsx(TransactionsTable, {
      pagination: page.txPagination
    }), /* @__PURE__ */ jsx(RewardsTable, {
      pagination: page.rwPagination
    })]
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$o,
  default: route$a,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
function normalizePosition(pos) {
  if (pos === "top") return "top-center";
  if (pos === "bottom") return "bottom-center";
  return pos;
}
function positionClass(pos) {
  const map = {
    "top-left": "savebar--top-left",
    "top-center": "savebar--top-center",
    "top-right": "savebar--top-right",
    "bottom-left": "savebar--bottom-left",
    "bottom-center": "savebar--bottom-center",
    "bottom-right": "savebar--bottom-right"
  };
  return map[pos] ?? "savebar--bottom-center";
}
const IconDiamond = () => /* @__PURE__ */ jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
  /* @__PURE__ */ jsx("path", { d: "M12 2L2 9l10 13L22 9 12 2zm0 2.5L20 9l-8 10.4L4 9l8-6.5z" }),
  /* @__PURE__ */ jsx("path", { d: "M12 5.5L5.5 9.5 12 17.5l6.5-8L12 5.5z", opacity: "0.35" })
] });
const IconAlert = () => /* @__PURE__ */ jsxs(
  "svg",
  {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
      /* @__PURE__ */ jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
      /* @__PURE__ */ jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
    ]
  }
);
const Spinner = () => /* @__PURE__ */ jsx("span", { className: "savebar-spinner", "aria-hidden": "true" });
function SaveBar({
  visible = false,
  position = "bottom-center",
  message = "You have unsaved changes",
  icon,
  variant = "default",
  primaryLabel = "Save",
  secondaryLabel = "Discard",
  onPrimary,
  onSecondary,
  loading = false,
  disabled = false,
  closeOnEscape = true,
  actions = null,
  className = ""
}) {
  const pos = normalizePosition(position);
  const [portalTarget, setPortalTarget] = useState(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);
  const handleKeyDown = useCallback((e) => {
    if (!visible || !closeOnEscape || actions) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onSecondary == null ? void 0 : onSecondary();
    }
  }, [visible, closeOnEscape, onSecondary, actions]);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
  const resolvedIcon = icon ?? (variant === "danger" ? /* @__PURE__ */ jsx(IconAlert, {}) : /* @__PURE__ */ jsx(IconDiamond, {}));
  const classes = [
    "savebar",
    positionClass(pos),
    // position + animation
    visible ? "savebar--visible" : "savebar--hidden",
    variant === "danger" ? "savebar--danger" : "",
    loading && !actions ? "savebar--loading" : "",
    // loading style only for built-in primary
    actions ? "savebar--custom-actions" : "",
    className
  ].filter(Boolean).join(" ");
  if (!portalTarget) return null;
  return createPortal(
    /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { role: "status", "aria-live": "polite", "aria-atomic": "true", className: "savebar-sr-only", children: visible ? message : "" }),
      /* @__PURE__ */ jsxs("div", { className: classes, role: "region", "aria-label": "Action notification bar", children: [
        /* @__PURE__ */ jsx("span", { className: "savebar-shimmer", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs("div", { className: "savebar-left", children: [
          /* @__PURE__ */ jsx("span", { className: "savebar-icon", children: resolvedIcon }),
          /* @__PURE__ */ jsx("span", { className: "savebar-message", children: message })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "savebar-actions", children: actions ? actions : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "savebar-btn savebar-btn--secondary",
              onClick: onSecondary,
              disabled: disabled || loading,
              "aria-label": secondaryLabel,
              children: secondaryLabel
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "savebar-btn savebar-btn--primary",
              onClick: onPrimary,
              disabled: disabled || loading,
              "aria-label": loading ? "Loading…" : primaryLabel,
              "aria-busy": loading,
              children: loading ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(Spinner, {}),
                /* @__PURE__ */ jsx("span", { children: "Saving…" })
              ] }) : primaryLabel
            }
          )
        ] }) })
      ] })
    ] }),
    document.body
    // always available here — guarded above
  );
}
async function loadCustomizeData(shop) {
  const style = await prisma.style.findUnique({ where: { shop } });
  return {
    savedCssVars: (style == null ? void 0 : style.cssVars) ?? null,
    savedPresetKey: (style == null ? void 0 : style.presetKey) ?? null,
    savedWidgetConfig: (style == null ? void 0 : style.widgetConfig) ?? null
  };
}
const LABEL_DEFAULTS = {
  // Header
  headerLabel: "Welcome, [name]",
  pointsLabel: "Account Balance: [points] pts",
  // Nav tabs
  navHome: "Home",
  navEarn: "Earn",
  navRewards: "Rewards",
  navMyRewards: "My Rewards",
  navActivity: "Activity",
  // Home nav cards
  homeCardBrowse: "Browse Rewards",
  homeCardEarn: "Earn Points",
  homeCardRefer: "Refer Friends",
  // Section headers
  sectionActiveRewards: "Active Rewards",
  sectionRecentActivity: "Recent Activity",
  // Activity table columns
  activityColDate: "Date",
  activityColActivity: "Activity",
  activityColPoints: "Points",
  // Empty states
  emptyRewards: "No active rewards available",
  emptyActivity: "No account activities yet",
  // Pagination
  loadMoreBtn: "Load More",
  loadMoreDone: "All loaded",
  // Notification
  notifyRewardHeading: "Success! Use this code at checkout",
  notifyRewardCopyBtn: "Copy",
  notifyInfoClaimBtn: "Claim",
  // Launcher
  launcherTitle: "Loyalty & Rewards",
  launcherSubtitle: "[points] pts",
  // Prizes
  navPrizes: "Prizes",
  navMyPrizes: "My Prizes",
  sectionPrizeRequests: "My Prize Requests",
  emptyPrizes: "No prizes available",
  emptyMyPrizes: "You have no prize requests yet",
  prizeStatusPending: "Pending",
  prizeStatusFulfilled: "Fulfilled",
  prizeStatusCompleted: "Completed",
  prizeStatusCancelled: "Cancelled",
  prizeContactUsText: "Contact us",
  prizeClaimSuccessMsg: "Your request has been submitted! We'll contact you soon to arrange delivery.",
  claimingLabel: "Processing...",
  claimRetryLabel: "Try again"
};
const WIDGET_CONFIG_DEFAULTS = {
  showHomeRewardsSection: true,
  showHomeActivitiesSection: true,
  showHomePrizeRequestsSection: true,
  enableToastNotifications: true,
  homeRewardsPerPage: 5,
  homeActivitiesPerPage: 5,
  homePrizeRequestsPerPage: 5,
  myPrizesPerPage: 5,
  paginationMode: "loadmore",
  labels: { ...LABEL_DEFAULTS },
  prize: {
    contactUrl: "",
    showAdminNote: true,
    showTrackingInfo: true,
    showRequestDate: true,
    showFulfilledDate: true
  }
};
const WIDGET_CONFIG_SECTIONS = [
  {
    key: "behaviour",
    label: "Behaviour",
    description: "Control what sections appear and how content is paged.",
    fields: [
      {
        key: "showHomeRewardsSection",
        label: "Show active rewards on Home tab",
        hint: "Display the 'Active Rewards' section on the Home tab",
        type: "toggle",
        configKey: "showHomeRewardsSection",
        default: true
      },
      {
        key: "showHomeActivitiesSection",
        label: "Show recent activity on Home tab",
        hint: "Display the 'Recent Activity' section on the Home tab",
        type: "toggle",
        configKey: "showHomeActivitiesSection",
        default: true
      },
      {
        key: "enableToastNotifications",
        label: "Show toast notifications on page load",
        hint: "When a customer earns points/rewards while away, show a stacked toast above the launcher button next time they visit — like a notification popup. Turn off to disable this entirely.",
        type: "toggle",
        configKey: "enableToastNotifications",
        default: true
      },
      {
        key: "homeRewardsPerPage",
        label: "Active rewards per page",
        hint: "How many active reward items to show at once on the Home tab",
        type: "range",
        min: 1,
        max: 10,
        unit: "",
        configKey: "homeRewardsPerPage",
        default: 5,
        parseValue: (v) => Number(v),
        displayValue: (v) => Number(v)
      },
      {
        key: "homeActivitiesPerPage",
        label: "Activity rows per page",
        hint: "How many activity rows to show at once on the Home tab",
        type: "range",
        min: 1,
        max: 15,
        unit: "",
        configKey: "homeActivitiesPerPage",
        default: 7,
        parseValue: (v) => Number(v),
        displayValue: (v) => Number(v)
      },
      {
        key: "paginationMode",
        label: "Pagination style",
        hint: "How to load more items in lists — arrow buttons or a Load More button",
        type: "select",
        options: [{ value: "pagination", label: "Arrows" }, { value: "loadmore", label: "Load More button" }],
        configKey: "paginationMode",
        default: "loadmore"
      },
      {
        key: "showHomePrizeRequestsSection",
        label: "Show prize requests on Home tab",
        hint: "Display the 'My Prize Requests' section on the Home tab",
        type: "toggle",
        configKey: "showHomePrizeRequestsSection",
        default: true
      },
      {
        key: "homePrizeRequestsPerPage",
        label: "Prize requests per page (Home)",
        hint: "How many prize request items to show at once on the Home tab",
        type: "range",
        min: 1,
        max: 10,
        unit: "",
        configKey: "homePrizeRequestsPerPage",
        default: 5,
        parseValue: (v) => Number(v),
        displayValue: (v) => Number(v)
      },
      {
        key: "myPrizesPerPage",
        label: "Prize requests per page (My Prizes tab)",
        hint: "How many prize request items to show at once on the My Prizes tab",
        type: "range",
        min: 1,
        max: 20,
        unit: "",
        configKey: "myPrizesPerPage",
        default: 8,
        parseValue: (v) => Number(v),
        displayValue: (v) => Number(v)
      }
    ]
  },
  {
    key: "prizeNotifications",
    label: "Prize Notifications",
    description: "Control how prize request details appear in the slide-up notification panel.",
    fields: [
      {
        key: "prize_contactUrl",
        label: "Contact page URL",
        hint: "URL shown as a 'Contact us' button on Pending and Cancelled prize notifications. Leave empty to hide the button. E.g. /pages/contact",
        type: "text",
        configKey: "prize.contactUrl",
        default: ""
      },
      {
        key: "prize_showRequestDate",
        label: "Show request date",
        hint: "Display when the prize was requested in the notification",
        type: "toggle",
        configKey: "prize.showRequestDate",
        default: true
      },
      {
        key: "prize_showFulfilledDate",
        label: "Show dispatch / completion date",
        hint: "Display when the prize was dispatched or completed in the notification",
        type: "toggle",
        configKey: "prize.showFulfilledDate",
        default: true
      },
      {
        key: "prize_showAdminNote",
        label: "Show admin note",
        hint: "Display the admin note in the notification (e.g. cancellation reason or delivery details)",
        type: "toggle",
        configKey: "prize.showAdminNote",
        default: true
      },
      {
        key: "prize_showTrackingInfo",
        label: "Show tracking info",
        hint: "Display tracking link or license key in the notification (shown for Fulfilled and Completed prizes)",
        type: "toggle",
        configKey: "prize.showTrackingInfo",
        default: true
      }
    ]
  },
  {
    key: "labels",
    label: "Labels & Text",
    description: "Customize all text labels shown inside the widget.",
    fields: [
      { key: "lbl_headerLabel", label: "Header greeting", hint: "Use [name] to insert the customer's name. E.g. 'Welcome, [name]'", type: "label", configKey: "labels.headerLabel", default: LABEL_DEFAULTS.headerLabel },
      { key: "lbl_pointsLabel", label: "Points balance text", hint: "Use [points] to insert the balance. E.g. '[points] pts'", type: "label", configKey: "labels.pointsLabel", default: LABEL_DEFAULTS.pointsLabel },
      { key: "lbl_navHome", label: "Nav — Home tab", hint: "Label shown on the Home navigation tab", type: "label", configKey: "labels.navHome", default: LABEL_DEFAULTS.navHome },
      { key: "lbl_navEarn", label: "Nav — Earn tab", hint: "Label shown on the Earn navigation tab", type: "label", configKey: "labels.navEarn", default: LABEL_DEFAULTS.navEarn },
      { key: "lbl_navRewards", label: "Nav — Rewards tab", hint: "Label shown on the Rewards navigation tab", type: "label", configKey: "labels.navRewards", default: LABEL_DEFAULTS.navRewards },
      { key: "lbl_navMyRewards", label: "Nav — My Rewards tab", hint: "Label shown on the My Rewards navigation tab", type: "label", configKey: "labels.navMyRewards", default: LABEL_DEFAULTS.navMyRewards },
      { key: "lbl_navActivity", label: "Nav — Activity tab", hint: "Label shown on the Activity navigation tab", type: "label", configKey: "labels.navActivity", default: LABEL_DEFAULTS.navActivity },
      { key: "lbl_homeCardBrowse", label: "Home card — Browse Rewards", hint: "Text on the Browse Rewards shortcut card on the Home tab", type: "label", configKey: "labels.homeCardBrowse", default: LABEL_DEFAULTS.homeCardBrowse },
      { key: "lbl_homeCardEarn", label: "Home card — Earn Points", hint: "Text on the Earn Points shortcut card on the Home tab", type: "label", configKey: "labels.homeCardEarn", default: LABEL_DEFAULTS.homeCardEarn },
      { key: "lbl_homeCardRefer", label: "Home card — Refer Friends", hint: "Text on the Refer Friends shortcut card on the Home tab", type: "label", configKey: "labels.homeCardRefer", default: LABEL_DEFAULTS.homeCardRefer },
      { key: "lbl_sectionRewards", label: "Section — Active Rewards", hint: "Heading of the Active Rewards section on the Home tab", type: "label", configKey: "labels.sectionActiveRewards", default: LABEL_DEFAULTS.sectionActiveRewards },
      { key: "lbl_sectionActivity", label: "Section — Recent Activity", hint: "Heading of the Recent Activity section on the Home tab", type: "label", configKey: "labels.sectionRecentActivity", default: LABEL_DEFAULTS.sectionRecentActivity },
      { key: "lbl_activityColDate", label: "Activity table — Date", hint: "Column header for the date column in activity tables", type: "label", configKey: "labels.activityColDate", default: LABEL_DEFAULTS.activityColDate },
      { key: "lbl_activityColAct", label: "Activity table — Activity", hint: "Column header for the activity description column", type: "label", configKey: "labels.activityColActivity", default: LABEL_DEFAULTS.activityColActivity },
      { key: "lbl_activityColPts", label: "Activity table — Points", hint: "Column header for the points column in activity tables", type: "label", configKey: "labels.activityColPoints", default: LABEL_DEFAULTS.activityColPoints },
      { key: "lbl_emptyRewards", label: "Empty state — No rewards", hint: "Message shown when there are no active rewards", type: "label", configKey: "labels.emptyRewards", default: LABEL_DEFAULTS.emptyRewards },
      { key: "lbl_emptyActivity", label: "Empty state — No activity", hint: "Message shown when there are no activity entries yet", type: "label", configKey: "labels.emptyActivity", default: LABEL_DEFAULTS.emptyActivity },
      { key: "lbl_loadMoreBtn", label: "Pagination — Load More", hint: "Text on the Load More button", type: "label", configKey: "labels.loadMoreBtn", default: LABEL_DEFAULTS.loadMoreBtn },
      { key: "lbl_loadMoreDone", label: "Pagination — All loaded", hint: "Text shown when all items have been loaded", type: "label", configKey: "labels.loadMoreDone", default: LABEL_DEFAULTS.loadMoreDone },
      { key: "lbl_notifyRewardHead", label: "Reward popup heading", hint: "Heading text inside the reward earned slide-up panel", type: "label", configKey: "labels.notifyRewardHeading", default: LABEL_DEFAULTS.notifyRewardHeading },
      { key: "lbl_notifyRewardCopy", label: "Reward popup copy button", hint: "Text on the Copy button inside the reward popup", type: "label", configKey: "labels.notifyRewardCopyBtn", default: LABEL_DEFAULTS.notifyRewardCopyBtn },
      { key: "lbl_notifyInfoClaim", label: "Info popup claim button", hint: "Text on the action button inside the info slide-up panel", type: "label", configKey: "labels.notifyInfoClaimBtn", default: LABEL_DEFAULTS.notifyInfoClaimBtn },
      { key: "lbl_launcherTitle", label: "Launcher title", hint: "Main title text on the floating launcher button", type: "label", configKey: "labels.launcherTitle", default: LABEL_DEFAULTS.launcherTitle },
      { key: "lbl_launcherSubtitle", label: "Launcher subtitle", hint: "Text shown below the launcher button title. Use [points] for balance. E.g. '[points] pts'", type: "label", configKey: "labels.launcherSubtitle", default: LABEL_DEFAULTS.launcherSubtitle },
      { key: "lbl_navPrizes", label: "Nav — Prizes tab", hint: "Label shown on the Prizes navigation tab", type: "label", configKey: "labels.navPrizes", default: LABEL_DEFAULTS.navPrizes },
      { key: "lbl_navMyPrizes", label: "Nav — My Prizes tab", hint: "Label shown on the My Prizes navigation tab", type: "label", configKey: "labels.navMyPrizes", default: LABEL_DEFAULTS.navMyPrizes },
      { key: "lbl_sectionPrizeRequests", label: "Section — My Prize Requests", hint: "Heading of the Prize Requests section on the Home tab", type: "label", configKey: "labels.sectionPrizeRequests", default: LABEL_DEFAULTS.sectionPrizeRequests },
      { key: "lbl_emptyPrizes", label: "Empty state — No prizes", hint: "Message shown when there are no prizes available", type: "label", configKey: "labels.emptyPrizes", default: LABEL_DEFAULTS.emptyPrizes },
      { key: "lbl_emptyMyPrizes", label: "Empty state — No prize requests", hint: "Message shown when the customer has no prize requests", type: "label", configKey: "labels.emptyMyPrizes", default: LABEL_DEFAULTS.emptyMyPrizes },
      { key: "lbl_prizeStatusPending", label: "Prize status — Pending", hint: "Text shown when a prize request is pending", type: "label", configKey: "labels.prizeStatusPending", default: LABEL_DEFAULTS.prizeStatusPending },
      { key: "lbl_prizeStatusFulfilled", label: "Prize status — Fulfilled", hint: "Text shown when a prize has been dispatched", type: "label", configKey: "labels.prizeStatusFulfilled", default: LABEL_DEFAULTS.prizeStatusFulfilled },
      { key: "lbl_prizeStatusCompleted", label: "Prize status — Completed", hint: "Text shown when a prize has been delivered", type: "label", configKey: "labels.prizeStatusCompleted", default: LABEL_DEFAULTS.prizeStatusCompleted },
      { key: "lbl_prizeStatusCancelled", label: "Prize status — Cancelled", hint: "Text shown when a prize request has been cancelled", type: "label", configKey: "labels.prizeStatusCancelled", default: LABEL_DEFAULTS.prizeStatusCancelled },
      { key: "lbl_prizeContactUsText", label: "Prize — Contact us button", hint: "Label on the Contact us button shown in prize notifications", type: "label", configKey: "labels.prizeContactUsText", default: LABEL_DEFAULTS.prizeContactUsText },
      { key: "lbl_prizeClaimSuccessMsg", label: "Prize — Claim success message", hint: "Message shown after a prize is successfully claimed", type: "label", configKey: "labels.prizeClaimSuccessMsg", default: LABEL_DEFAULTS.prizeClaimSuccessMsg },
      { key: "lbl_claimingLabel", label: "Claim button — Processing", hint: "Text on the claim button while the request is being submitted", type: "label", configKey: "labels.claimingLabel", default: LABEL_DEFAULTS.claimingLabel },
      { key: "lbl_claimRetryLabel", label: "Claim button — Retry", hint: "Text on the claim button after a failed attempt", type: "label", configKey: "labels.claimRetryLabel", default: LABEL_DEFAULTS.claimRetryLabel }
    ]
  }
];
const SIMPLE_SECTIONS = [
  {
    key: "header",
    label: "Header",
    description: "The coloured strip at the top of the widget — background, text and points badge.",
    fields: [
      { key: "headerBg", label: "Header color", hint: "Background color of the banner at the top of your widget", type: "color", maps: ["--nbl-header-bg"], default: "#8b5cf6" },
      { key: "headerColor", label: "Header title color", hint: "Color of the welcome text shown in the header", type: "color", maps: ["--nbl-header-color"], default: "#ffffff" },
      { key: "headerTitleSize", label: "Title size", hint: "How large the welcome title appears in the header", type: "range", min: 12, max: 22, unit: "px", maps: ["--nbl-header-title-font-size"], default: "16px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "pointsBg", label: "Points pill color", hint: "Background color of the points balance pill in the header", type: "color", maps: ["--nbl-points-bg"], default: "rgba(255, 255, 255, 0.2)", resolvedDefault: "#ffffff" },
      { key: "pointsColor", label: "Points pill text", hint: "Color of the number shown inside the points balance pill", type: "color", maps: ["--nbl-points-color"], default: "#ffffff" }
    ]
  },
  {
    key: "navigation",
    label: "Navigation Bar",
    description: "The tab bar below the header — background, tab text, active indicator and chevrons.",
    fields: [
      { key: "navBg", label: "Tab bar background", hint: "Background color of the navigation area below the header", type: "color", maps: ["--nbl-nav-bg"], default: "#ffffff" },
      { key: "navBorderColor", label: "Tab bar bottom line", hint: "Color of the divider line below the tab bar", type: "color", maps: ["--nbl-nav-border-color"], default: "#e9e7f0" },
      { key: "navItemColor", label: "Inactive tab color", hint: "Color of tabs that are not currently selected", type: "color", maps: ["--nbl-nav-item-color"], default: "#6b7280" },
      { key: "navActiveColor", label: "Selected tab color", hint: "Color of the currently active tab label and its underline", type: "color", maps: ["--nbl-nav-active-color", "--nbl-nav-active-border"], default: "#8b5cf6" },
      { key: "navChevronColor", label: "Scroll arrow color", hint: "Color of the left/right arrows that appear when there are too many tabs to show", type: "color", maps: ["--nbl-nav-chevron-color"], default: "#6b7280" },
      { key: "navChevronBg", label: "Scroll arrow background", hint: "Background behind the scroll arrows", type: "color", maps: ["--nbl-nav-chevron-bg"], default: "#ffffff" },
      { key: "navItemFontSize", label: "Tab label size", hint: "How large the tab label text appears", type: "range", min: 10, max: 16, unit: "px", maps: ["--nbl-nav-item-font-size"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "brand",
    label: "Brand Colors",
    description: "Primary and accent colors that flow through the whole widget.",
    fields: [
      { key: "primary", label: "Brand primary color", hint: "Your main brand color — used for active tabs and highlights throughout the widget", type: "color", maps: ["--nbl-primary", "--nbl-nav-active-color", "--nbl-nav-active-border", "--nbl-loadmore-color"], default: "#8b5cf6" },
      { key: "accent", label: "Accent color", hint: "Secondary color used for active reward highlights and positive indicators", type: "color", maps: ["--nbl-accent", "--nbl-item-active-border"], default: "#4ecba8" }
    ]
  },
  {
    key: "buttons",
    label: "Action Buttons",
    description: "The CTA buttons shared across all widget tabs.",
    fields: [
      { key: "btnBg", label: "Button background", hint: "Background color of action buttons like 'Claim Reward'", type: "color", maps: ["--nbl-btn-bg", "--nbl-btn-border"], default: "#4ecba8" },
      { key: "btnColor", label: "Button text color", hint: "Color of the text written on buttons", type: "color", maps: ["--nbl-btn-color"], default: "#ffffff" },
      { key: "btnRadius", label: "Button corner roundness", hint: "How rounded the button corners appear — 0 = sharp, 24 = very rounded", type: "range", min: 0, max: 24, unit: "px", maps: ["--nbl-btn-radius"], default: "10px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "btnFontSize", label: "Button text size", hint: "How large the text on buttons appears", type: "range", min: 11, max: 18, unit: "px", maps: ["--nbl-btn-font-size"], default: "14px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "text",
    label: "Text & Fonts",
    description: "Text colors and font size scale used throughout the widget.",
    fields: [
      { key: "textMain", label: "Main text color", hint: "Color for headings, reward names and important labels", type: "color", maps: ["--nbl-text"], default: "#1a1a1a" },
      { key: "textMuted", label: "Subtitle / hint color", hint: "Color for descriptions, dates and secondary information", type: "color", maps: ["--nbl-text-muted"], default: "#6b7280" },
      { key: "textBase", label: "Body text size", hint: "Standard text size used throughout the widget", type: "range", min: 11, max: 16, unit: "px", maps: ["--nbl-text-base"], default: "13px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "textLg", label: "Heading text size", hint: "Size of headings and section titles", type: "range", min: 13, max: 22, unit: "px", maps: ["--nbl-text-lg"], default: "16px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "surfaces",
    label: "Surfaces & Layout",
    description: "Widget body background, card backgrounds, borders and border radius.",
    fields: [
      { key: "surface", label: "Widget background", hint: "Main background color of the widget content area", type: "color", maps: ["--nbl-surface"], default: "#ffffff" },
      { key: "surface2", label: "Card background", hint: "Background color for reward cards and section panels", type: "color", maps: ["--nbl-surface-2", "--nbl-item-bg", "--nbl-section-header-bg", "--nbl-card-bg"], default: "#f8f7ff" },
      { key: "surfaceHover", label: "Hover highlight", hint: "Background color that appears when hovering over clickable items", type: "color", maps: ["--nbl-surface-hover"], default: "#f3f1fc" },
      { key: "borderColor", label: "Border & divider color", hint: "Color of lines that separate sections and outline cards", type: "color", maps: ["--nbl-border", "--nbl-nav-border-color", "--nbl-card-border", "--nbl-item-border"], default: "#e9e7f0" },
      { key: "radius", label: "Widget corner roundness", hint: "How rounded the outer corners of the widget appear", type: "range", min: 0, max: 28, unit: "px", maps: ["--nbl-radius", "--nbl-radius-xl"], default: "16px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "cardRadius", label: "Card corner roundness", hint: "How rounded the corners of cards and rows appear", type: "range", min: 0, max: 20, unit: "px", maps: ["--nbl-card-radius", "--nbl-item-radius", "--nbl-radius-lg"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "widgetBodyPadding", label: "Content area spacing", hint: "Inner spacing of the main widget content area", type: "text", maps: ["--nbl-widget-body-padding"], default: "14px 14px 24px" }
    ]
  },
  {
    key: "rewards",
    label: "Reward Items",
    description: "Cards shown in the Rewards and Active Rewards tabs.",
    fields: [
      { key: "rewardItemBg", label: "Reward card background", hint: "Background color of each reward item card", type: "color", maps: ["--nbl-item-bg"], default: "#f8f7ff" },
      { key: "rewardItemActiveBg", label: "Redeemed card background", hint: "Background color of a reward card that has been claimed or is active", type: "color", maps: ["--nbl-item-active-bg"], default: "#f0fdf9" },
      { key: "rewardItemActiveBorder", label: "Redeemed card border", hint: "Border color highlighting a claimed or active reward card", type: "color", maps: ["--nbl-item-active-border"], default: "#4ecba8" },
      { key: "rewardTitleFontSize", label: "Reward name size", hint: "How large the reward title text appears on each card", type: "range", min: 11, max: 17, unit: "px", maps: ["--nbl-item-title-font-size"], default: "13.5px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "activity",
    label: "Activity Table",
    description: "Points history rows — dividers, earned/spent colors and typography.",
    fields: [
      { key: "activityBorderColor", label: "Row separator color", hint: "Color of the thin line between activity history rows", type: "color", maps: ["--nbl-activity-border-color"], default: "rgba(0,0,0,0.04)" },
      { key: "activityPositive", label: "Points earned color", hint: "Color of the '+' number shown when points are added to the account", type: "color", maps: ["--nbl-activity-positive-color"], default: "#16a34a" },
      { key: "activityNegative", label: "Points spent color", hint: "Color of the '−' number shown when points are used", type: "color", maps: ["--nbl-activity-negative-color"], default: "#dc2626" },
      { key: "activityRowFontSize", label: "Row text size", hint: "How large the text in each activity history row appears", type: "range", min: 10, max: 15, unit: "px", maps: ["--nbl-activity-row-font-size"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "pagination",
    label: "Pagination",
    description: "Arrow buttons, dot indicators and the Load More button.",
    fields: [
      { key: "paginationBtnBg", label: "Navigation arrow background", hint: "Background color of the previous/next arrow buttons", type: "color", maps: ["--nbl-pagination-btn-bg"], default: "#ffffff" },
      { key: "paginationBtnColor", label: "Navigation arrow color", hint: "Color of the arrow icon inside the prev/next buttons", type: "color", maps: ["--nbl-pagination-btn-color"], default: "#6b7280" },
      { key: "paginationBtnRadius", label: "Navigation arrow roundness", hint: "How rounded the corners of navigation arrow buttons appear", type: "range", min: 0, max: 20, unit: "px", maps: ["--nbl-pagination-btn-radius"], default: "10px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "loadmoreBg", label: "'Load More' button background", hint: "Background color of the Load More button at the bottom of lists", type: "color", maps: ["--nbl-loadmore-bg"], default: "#ffffff" },
      { key: "loadmoreColor", label: "'Load More' text color", hint: "Color of the text on the Load More button", type: "color", maps: ["--nbl-loadmore-color"], default: "#8b5cf6" },
      { key: "loadmoreRadius", label: "'Load More' corner roundness", hint: "How rounded the corners of the Load More button appear", type: "range", min: 0, max: 20, unit: "px", maps: ["--nbl-loadmore-radius"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Slide-up panels — reward earned (green) and generic info (dark).",
    fields: [
      { key: "notifyBgFrom", label: "Popup gradient — top color", hint: "First gradient color shared by both reward and info slide-up panels", type: "color", maps: ["--nbl-notify-bg-from"], default: "#15803d" },
      { key: "notifyBgTo", label: "Popup gradient — bottom color", hint: "Second gradient color shared by both reward and info slide-up panels", type: "color", maps: ["--nbl-notify-bg-to"], default: "#22c55e" },
      { key: "notifyColor", label: "Popup text color", hint: "Color of text inside both reward and info slide-up panels", type: "color", maps: ["--nbl-notify-color"], default: "#ffffff" },
      { key: "notifyRewardCodeBg", label: "Reward code box color", hint: "Background color of the code display box inside the reward popup", type: "color", maps: ["--nbl-notify-reward-code-bg"], default: "rgba(255,255,255,0.22)", resolvedDefault: "#b0e8d4" },
      { key: "notifyRewardBtnBg", label: "Reward button background", hint: "Background color of the Copy button inside the reward popup", type: "color", maps: ["--nbl-notify-reward-btn-bg"], default: "#4ecba8" },
      { key: "notifyRewardBtnColor", label: "Reward button text color", hint: "Text color of the Copy button inside the reward popup", type: "color", maps: ["--nbl-notify-reward-btn-color"], default: "#16a34a" },
      { key: "notifyRewardBtnBorder", label: "Reward button border", hint: "Border color of the Copy button inside the reward popup", type: "color", maps: ["--nbl-notify-reward-btn-border"], default: "#4ecba8" },
      { key: "notifyInfoBtnBg", label: "Info button background", hint: "Background color of the action button inside the info popup", type: "color", maps: ["--nbl-notify-info-btn-bg"], default: "#4ecba8" },
      { key: "notifyInfoBtnColor", label: "Info button text color", hint: "Text color of the action button inside the info popup", type: "color", maps: ["--nbl-notify-info-btn-color"], default: "#ffffff" },
      { key: "notifyInfoBtnBorder", label: "Info button border", hint: "Border color of the action button inside the info popup", type: "color", maps: ["--nbl-notify-info-btn-border"], default: "#4ecba8" }
    ]
  },
  {
    key: "status",
    label: "Status Colors",
    description: "Semantic success / error / warning / info tints used in alerts and badges.",
    fields: [
      { key: "statusSuccessBg", label: "Success highlight color", hint: "Background color used in success messages and badges", type: "color", maps: ["--nbl-status-success-bg"], default: "#f0fdf4" },
      { key: "statusSuccessColor", label: "Success text color", hint: "Color of text inside success messages", type: "color", maps: ["--nbl-status-success-color", "--nbl-status-success-text"], default: "#166534" },
      { key: "statusErrorBg", label: "Error highlight color", hint: "Background color used in error messages", type: "color", maps: ["--nbl-status-error-bg"], default: "#fef2f2" },
      { key: "statusErrorColor", label: "Error text color", hint: "Color of text inside error messages", type: "color", maps: ["--nbl-status-error-color"], default: "#b91c1c" },
      { key: "statusWarningBg", label: "Warning highlight color", hint: "Background color used in warning messages", type: "color", maps: ["--nbl-status-warning-bg"], default: "#fffbeb" },
      { key: "statusWarningColor", label: "Warning text color", hint: "Color of text inside warning messages", type: "color", maps: ["--nbl-status-warning-color", "--nbl-status-warning-strong"], default: "#854d0e" },
      { key: "statusInfoBg", label: "Info highlight color", hint: "Background color used in informational badges", type: "color", maps: ["--nbl-status-info-bg"], default: "#eff6ff" },
      { key: "statusInfoColor", label: "Info text color", hint: "Color of text inside informational messages", type: "color", maps: ["--nbl-status-info-color"], default: "#1e40af" }
    ]
  },
  {
    key: "modal",
    label: "Referral Modal",
    description: "The referral flow modal that overlays the widget.",
    fields: [
      { key: "modalBg", label: "Popup background", hint: "Background color of the referral invite popup", type: "color", maps: ["--nbl-modal-bg"], default: "#ffffff" },
      { key: "modalRadius", label: "Popup corner roundness", hint: "How rounded the corners of the popup appear", type: "range", min: 0, max: 28, unit: "px", maps: ["--nbl-modal-radius"], default: "20px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "modalPadding", label: "Popup inner spacing", hint: "Padding inside the popup content area", type: "text", maps: ["--nbl-modal-padding"], default: "24px 22px 22px" },
      { key: "modalTitleColor", label: "Popup title color", hint: "Color of the large heading text in the popup", type: "color", maps: ["--nbl-modal-title-color"], default: "#111827" },
      { key: "modalTextColor", label: "Popup body text", hint: "Color of the regular paragraph text in the popup", type: "color", maps: ["--nbl-modal-text-color"], default: "#374151" },
      { key: "modalMutedColor", label: "Popup hint text color", hint: "Color of smaller secondary text in the popup", type: "color", maps: ["--nbl-modal-muted-color"], default: "#9ca3af" },
      { key: "modalInputBg", label: "Text field background", hint: "Background color of input boxes inside the popup", type: "color", maps: ["--nbl-modal-input-bg"], default: "#f9fafb" },
      { key: "modalInputBorder", label: "Text field border", hint: "Border color around input boxes", type: "color", maps: ["--nbl-modal-input-border"], default: "#e5e7eb" },
      { key: "modalInputFocus", label: "Text field focus color", hint: "Border color that appears when clicking into an input box", type: "color", maps: ["--nbl-modal-input-focus"], default: "#16a34a" },
      { key: "modalBtnBg", label: "Popup button color", hint: "Background color of the main action button in the popup", type: "color", maps: ["--nbl-modal-btn-primary-bg"], default: "#111827" },
      { key: "modalCodeBg", label: "Referral code box color", hint: "Background color of the box that displays the referral link", type: "color", maps: ["--nbl-modal-code-bg"], default: "#f8fafc" },
      { key: "modalCodeBorder", label: "Referral code box border", hint: "Border color around the referral link box", type: "color", maps: ["--nbl-modal-code-border"], default: "#d1d5db" },
      { key: "modalBrandBg", label: "App badge background", hint: "Background color of the app name badge at the top of the popup", type: "color", maps: ["--nbl-modal-brand-bg"], default: "#ecfdf5" },
      { key: "modalBrandColor", label: "App badge text color", hint: "Color of the text inside the app name badge", type: "color", maps: ["--nbl-modal-brand-color"], default: "#15803d" }
    ]
  },
  {
    key: "launcher",
    label: "Launcher Button",
    description: "The floating pill on your storefront that opens the widget.",
    fields: [
      { key: "launcherIcon", label: "Button icon", hint: "Icon displayed on the floating button", type: "icon", options: ["gift", "star", "trophy", "gem"], maps: ["--nbl-launcher-icon"], default: "'gift'", displayValue: (v) => v.replace(/^'|'$/g, ""), parseValue: (v) => `'${v}'` },
      { key: "launcherBg", label: "Button background", hint: "Background color of the floating button on your storefront", type: "color", maps: ["--nbl-launcher-bg"], default: "var(--nbl-btn-bg)", resolvedDefault: "#4ecba8" },
      { key: "launcherColor", label: "Button text color", hint: "Color of the text and subtitle on the floating button", type: "color", maps: ["--nbl-launcher-color"], default: "var(--nbl-btn-color)", resolvedDefault: "#ffffff" },
      { key: "launcherRadius", label: "Button shape", hint: "Shape of the floating launcher button", type: "select", options: [{ value: "999px", label: "Pill (default)" }, { value: "16px", label: "Rounded" }, { value: "8px", label: "Slightly rounded" }, { value: "0px", label: "Square" }], maps: ["--nbl-launcher-border-radius"], default: "999px" },
      { key: "launcherPosition", label: "Button position", hint: "Which side of the screen the launcher appears on", type: "select", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }], maps: ["--nbl-launcher-position"], default: "right" },
      { key: "launcherBottom", label: "Distance from bottom", hint: "How far from the bottom edge of the screen the button sits", type: "text", maps: ["--nbl-launcher-bottom"], default: "24px" },
      { key: "launcherSideOffset", label: "Side offset", hint: "How far from the left or right edge of the screen the button sits", type: "text", maps: ["--nbl-launcher-side-offset"], default: "20px" },
      { key: "launcherTitleSize", label: "Button text size", hint: "How large the text on the floating button appears", type: "range", min: 10, max: 18, unit: "px", maps: ["--nbl-launcher-title-size"], default: "13px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "animations",
    label: "Animations",
    description: "Speed controls for widget transitions.",
    fields: [
      { key: "durFast", label: "Quick animation speed", hint: "Speed of hover and badge transitions", type: "range", min: 50, max: 500, unit: "ms", maps: ["--nbl-dur-fast"], default: "0.18s", parseValue: (v) => `${(v / 1e3).toFixed(2)}s`, displayValue: (v) => {
        const n = parseFloat(v);
        return Math.round((isNaN(n) ? 0.18 : n) * 1e3);
      } },
      { key: "durNormal", label: "Normal animation speed", hint: "Speed of tab switching and card transitions", type: "range", min: 50, max: 600, unit: "ms", maps: ["--nbl-dur-normal"], default: "0.28s", parseValue: (v) => `${(v / 1e3).toFixed(2)}s`, displayValue: (v) => {
        const n = parseFloat(v);
        return Math.round((isNaN(n) ? 0.28 : n) * 1e3);
      } },
      { key: "durSlow", label: "Slow animation speed", hint: "Speed of the widget opening and closing", type: "range", min: 100, max: 800, unit: "ms", maps: ["--nbl-dur-slow"], default: "0.42s", parseValue: (v) => `${(v / 1e3).toFixed(2)}s`, displayValue: (v) => {
        const n = parseFloat(v);
        return Math.round((isNaN(n) ? 0.42 : n) * 1e3);
      } },
      { key: "easeSpring", label: "Open animation style", hint: "How the widget feels when it opens", type: "select", options: [{ value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "Springy (default)" }, { value: "cubic-bezier(0.22, 1, 0.36, 1)", label: "Smooth" }, { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: "Snappy" }, { value: "linear", label: "Linear" }], maps: ["--nbl-ease-spring"], default: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      { key: "easeOut", label: "Close animation style", hint: "How the widget feels when it closes", type: "select", options: [{ value: "cubic-bezier(0.22, 1, 0.36, 1)", label: "Smooth (default)" }, { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: "Snappy" }, { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "Springy" }, { value: "linear", label: "Linear" }], maps: ["--nbl-ease-out"], default: "cubic-bezier(0.22, 1, 0.36, 1)" }
    ]
  },
  {
    key: "glow",
    label: "Widget Glow Effect",
    description: "Ambient glow ring around the open widget container.",
    fields: [
      { key: "glowPrimary", label: "Primary glow strength", hint: "How strong the inner glow around the widget appears", type: "range", min: 0, max: 30, unit: "%", maps: ["--nbl-widget-glow-primary"], default: "color-mix(in srgb, var(--nbl-primary) 12%, transparent)", parseValue: (v) => `color-mix(in srgb, var(--nbl-primary) ${v}%, transparent)`, displayValue: (v) => {
        const m = String(v).match(/(\d+)%/);
        return m ? parseInt(m[1]) : 12;
      } },
      { key: "glowHalo", label: "Halo glow strength", hint: "How strong the outer soft halo glow appears", type: "range", min: 0, max: 20, unit: "%", maps: ["--nbl-widget-glow-halo"], default: "color-mix(in srgb, var(--nbl-primary) 5%, transparent)", parseValue: (v) => `color-mix(in srgb, var(--nbl-primary) ${v}%, transparent)`, displayValue: (v) => {
        const m = String(v).match(/(\d+)%/);
        return m ? parseInt(m[1]) : 5;
      } }
    ]
  },
  {
    key: "borders",
    label: "Borders",
    description: "Color and thickness of dividers and outlines throughout the widget.",
    fields: [
      { key: "borderColor2", label: "Border color", hint: "Color used for all dividers and outline borders", type: "color", maps: ["--nbl-border"], default: "#e9e7f0" },
      { key: "borderWidth", label: "Border thickness", hint: "Thickness of thin dividers and outlines", type: "range", min: 0, max: 4, unit: "px", maps: ["--nbl-border-width"], default: "1px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "borderWidthMd", label: "Medium border thickness", hint: "Thickness of slightly heavier outlines", type: "range", min: 0, max: 4, unit: "px", maps: ["--nbl-border-width-md"], default: "1.5px", parseValue: (v) => `${v}px`, displayValue: (v) => parseFloat(v) }
    ]
  },
  {
    key: "borderRadius",
    label: "Border Radius",
    description: "Corner rounding scale used across the whole widget.",
    fields: [
      { key: "radiusBase", label: "Base corner radius", hint: "Default rounding for most elements", type: "range", min: 0, max: 20, unit: "px", maps: ["--nbl-radius"], default: "16px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "radiusSm", label: "Small corner radius", hint: "Rounding for small elements like tags and badges", type: "range", min: 0, max: 12, unit: "px", maps: ["--nbl-radius-sm"], default: "6px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "radiusMd", label: "Medium corner radius", hint: "Rounding for medium UI elements like inputs", type: "range", min: 0, max: 16, unit: "px", maps: ["--nbl-radius-md"], default: "8px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "radiusLg", label: "Large corner radius", hint: "Rounding for cards and panels", type: "range", min: 0, max: 24, unit: "px", maps: ["--nbl-radius-lg"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "radiusXl", label: "Extra-large corner radius", hint: "Rounding for the main widget container", type: "range", min: 0, max: 32, unit: "px", maps: ["--nbl-radius-xl"], default: "16px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) }
    ]
  },
  {
    key: "shadows",
    label: "Shadows",
    description: "Drop shadows for the widget container, cards and navigation chevrons.",
    fields: [
      { key: "shadowWidget", label: "Widget shadow", hint: "How strong the shadow under the widget appears", type: "select", options: [{ value: "none", label: "None" }, { value: "0 4px 16px rgba(0,0,0,0.08)", label: "Subtle" }, { value: "0 8px 40px rgba(0,0,0,0.13)", label: "Medium (default)" }, { value: "0 20px 60px rgba(0,0,0,0.22)", label: "Strong" }], maps: ["--nbl-shadow"], default: "0 8px 40px rgba(0,0,0,0.13)" },
      { key: "shadowSm", label: "Small element shadow", hint: "Shadow on small elevated elements like badges", type: "select", options: [{ value: "none", label: "None" }, { value: "0 1px 4px rgba(0,0,0,0.08)", label: "Subtle (default)" }, { value: "0 2px 8px rgba(0,0,0,0.12)", label: "Medium" }], maps: ["--nbl-shadow-sm"], default: "0 1px 4px rgba(0,0,0,0.08)" },
      { key: "shadowMd", label: "Card shadow", hint: "Shadow on cards and panel menus", type: "select", options: [{ value: "none", label: "None" }, { value: "0 2px 8px rgba(0,0,0,0.06)", label: "Subtle" }, { value: "0 4px 16px rgba(0,0,0,0.10)", label: "Medium (default)" }, { value: "0 8px 24px rgba(0,0,0,0.16)", label: "Strong" }], maps: ["--nbl-shadow-md"], default: "0 4px 16px rgba(0,0,0,0.10)" },
      { key: "shadowChevron", label: "Scroll arrow shadow", hint: "Shadow on the navigation scroll arrows", type: "select", options: [{ value: "none", label: "None" }, { value: "0 2px 8px rgba(0,0,0,0.12)", label: "Subtle (default)" }, { value: "0 4px 12px rgba(0,0,0,0.18)", label: "Medium" }], maps: ["--nbl-shadow-nav-chevron"], default: "0 2px 8px rgba(0,0,0,0.12)" }
    ]
  },
  {
    key: "cards",
    label: "Cards & Sections",
    description: "Shared styling for every card-style container in the widget.",
    fields: [
      { key: "cardBg", label: "Card background", hint: "Background color of cards and content sections", type: "color", maps: ["--nbl-card-bg"], default: "#ffffff" },
      { key: "cardBorder", label: "Card border color", hint: "Color of the border around cards", type: "color", maps: ["--nbl-card-border"], default: "#e9e7f0" },
      { key: "cardRadius2", label: "Card corner radius", hint: "How rounded the corners of cards are", type: "range", min: 0, max: 24, unit: "px", maps: ["--nbl-card-radius"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "cardPadding", label: "Card inner spacing", hint: "Padding inside cards (e.g. 16px)", type: "text", maps: ["--nbl-card-padding"], default: "16px" },
      { key: "cardShadow", label: "Card shadow", hint: "Drop shadow on reward and content cards", type: "select", options: [{ value: "none", label: "None (default)" }, { value: "0 2px 8px rgba(0,0,0,0.06)", label: "Subtle" }, { value: "0 4px 16px rgba(0,0,0,0.10)", label: "Medium" }], maps: ["--nbl-card-shadow"], default: "none" }
    ]
  },
  {
    key: "homeSectionCards",
    label: "Home Section Headers",
    description: "The header strip shown above Active Rewards and Activity lists on the Home tab.",
    fields: [
      { key: "hscHeaderBg", label: "Section header background", hint: "Background of the section header strip on the Home tab", type: "color", maps: ["--nbl-section-header-bg"], default: "#f8f7ff" },
      { key: "hscHeaderPadding", label: "Section header padding", hint: "Inner spacing of the section header strip", type: "text", maps: ["--nbl-section-header-padding"], default: "10px 14px" },
      { key: "hscTitleFontSize", label: "Section title size", hint: "Font size of the section heading text", type: "range", min: 10, max: 16, unit: "px", maps: ["--nbl-section-title-font-size"], default: "12px", parseValue: (v) => `${v}px`, displayValue: (v) => parseInt(v) },
      { key: "hscTitleColor", label: "Section title color", hint: "Color of the section heading text", type: "color", maps: ["--nbl-section-title-color"], default: "#6b7280" },
      { key: "homeNavColor", label: "Home nav card text color", hint: "Text color on the navigation shortcut cards on the Home tab", type: "color", maps: ["--nbl-home-nav-color"], default: "#1a1a2e" }
    ]
  }
];
const PRESETS = [
  {
    key: "northBorders",
    label: "North Borders",
    swatches: ["#FEC643", "#EF633B", "#0a0a0a"],
    tagline: "Bold & automotive",
    vars: {
      "--nbl-primary": "#FEC643",
      "--nbl-header-bg": "#ef633b",
      "--nbl-nav-active-color": "#FEC643",
      "--nbl-nav-active-border": "#FEC643",
      "--nbl-loadmore-color": "#1a0011",
      "--nbl-loadmore-bg": "#FEC643",
      "--nbl-loadmore-border": "#FEC643",
      "--nbl-accent": "#EF633B",
      "--nbl-btn-bg": "#FEC643",
      "--nbl-btn-border": "#FEC643",
      "--nbl-btn-color": "#1a1208",
      "--nbl-item-active-border": "#EF633B",
      "--nbl-item-active-bg": "#1a1208",
      "--nbl-launcher-bg": "#ef633b",
      "--nbl-launcher-color": "#ffffff",
      "--nbl-surface": "#0a0a0a",
      "--nbl-surface-2": "#171717",
      "--nbl-item-bg": "#171717",
      "--nbl-section-header-bg": "#171717",
      "--nbl-nav-bg": "#0a0a0a",
      "--nbl-nav-item-color": "#a3a3a3",
      "--nbl-text": "#fafafa",
      "--nbl-text-muted": "#a3a3a3",
      "--nbl-border": "#262626",
      "--nbl-nav-border-color": "#262626",
      "--nbl-card-bg": "#171717",
      "--nbl-card-border": "#262626",
      "--nbl-home-nav-color": "#1a1208",
      "--nbl-notify-bg-from": "#EF633B",
      "--nbl-notify-bg-to": "#EF633B",
      "--nbl-notify-color": "#ffffff",
      "--nbl-notify-reward-code-bg": "#16A34A",
      "--nbl-notify-reward-btn-bg": "#FEC643",
      "--nbl-notify-reward-btn-color": "#1a1208",
      "--nbl-notify-reward-btn-border": "#FEC643",
      "--nbl-notify-info-btn-bg": "#FEC643",
      "--nbl-notify-info-btn-color": "#1a1208",
      "--nbl-notify-info-btn-border": "#FEC643",
      "--nbl-section-title-color": "#FEC643",
      "--nbl-modal-bg": "#FFFFFF",
      "--nbl-modal-btn-primary-bg": "#FEC643",
      "--nbl-modal-btn-primary-color": "#000000",
      "--nbl-modal-btn-finish-bg": "#FEC643",
      "--nbl-modal-btn-finish-color": "#000000",
      "--nbl-referral-copy-btn-color": "#000000",
      "--nbl-referral-copy-btn-bg": "#FEC643",
      "--nbl-referral-copy-btn-border": "#FEC643",
      "--nbl-modal-brand-color": "#000000",
      "--nbl-modal-brand-bg": "#FEC643",
      "--nbl-modal-code-border": "#EF633B",
      "--nbl-modal-input-border": "#EF633B",
      "--nbl-modal-btn-finish-hover": "#FEC643",
      "--nbl-status-negative-bg": "#EF633B",
      "--nbl-status-negative-border": "#ffffff",
      "--nbl-status-negative-color": "#ffffff",
      "--nbl-status-negative-soft-bg": "#EF633B"
    }
  },
  {
    key: "violet",
    label: "Violet Dream",
    swatches: ["#7c3aed", "#a78bfa", "#ede9fe"],
    tagline: "Rich purple tones",
    vars: {
      "--nbl-primary": "#7c3aed",
      "--nbl-header-bg": "#7c3aed",
      "--nbl-nav-active-color": "#7c3aed",
      "--nbl-nav-active-border": "#7c3aed",
      "--nbl-loadmore-color": "#ffffff",
      "--nbl-loadmore-bg": "#7c3aed",
      "--nbl-loadmore-border": "#7c3aed",
      "--nbl-accent": "#a78bfa",
      "--nbl-home-nav-color": "#ffffff",
      "--nbl-btn-bg": "#7c3aed",
      "--nbl-btn-border": "#7c3aed",
      "--nbl-btn-color": "#ffffff",
      "--nbl-item-active-border": "#a78bfa",
      "--nbl-item-active-bg": "#f5f3ff",
      "--nbl-launcher-bg": "#7c3aed",
      "--nbl-surface": "#ffffff",
      "--nbl-surface-2": "#f5f3ff",
      "--nbl-item-bg": "#f5f3ff",
      "--nbl-section-header-bg": "#f5f3ff",
      "--nbl-nav-bg": "#ffffff",
      "--nbl-nav-item-color": "#6b7280",
      "--nbl-text": "#1a1a2e",
      "--nbl-text-muted": "#6b7280",
      "--nbl-border": "#ede9fe",
      "--nbl-nav-border-color": "#ede9fe",
      "--nbl-card-bg": "#ffffff",
      "--nbl-card-border": "#ede9fe",
      "--nbl-notify-bg-from": "#4c1d95",
      "--nbl-notify-bg-to": "#7c3aed",
      "--nbl-notify-color": "#ffffff",
      "--nbl-section-title-color": "#7c3aed",
      "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.18)",
      "--nbl-notify-reward-btn-bg": "#a78bfa",
      "--nbl-notify-reward-btn-color": "#3b0764",
      "--nbl-notify-reward-btn-border": "#a78bfa",
      "--nbl-notify-info-btn-bg": "#a78bfa",
      "--nbl-notify-info-btn-color": "#3b0764",
      "--nbl-notify-info-btn-border": "#a78bfa"
    }
  },
  {
    key: "midnight",
    label: "Midnight Dark",
    swatches: ["#6366f1", "#818cf8", "#1e1b4b"],
    tagline: "Sleek dark mode",
    vars: {
      "--nbl-primary": "#4338ca",
      "--nbl-header-bg": "#1e1b4b",
      "--nbl-nav-active-color": "#818cf8",
      "--nbl-nav-active-border": "#818cf8",
      "--nbl-loadmore-color": "#ffffff",
      "--nbl-loadmore-bg": "#4338ca",
      "--nbl-loadmore-border": "#4338ca",
      "--nbl-accent": "#6366f1",
      "--nbl-btn-bg": "#6366f1",
      "--nbl-btn-border": "#6366f1",
      "--nbl-btn-color": "#ffffff",
      "--nbl-item-active-border": "#818cf8",
      "--nbl-item-active-bg": "#1e1b4b",
      "--nbl-launcher-bg": "#6366f1",
      "--nbl-surface": "#0f0e1a",
      "--nbl-surface-2": "#1a1833",
      "--nbl-item-bg": "#1a1833",
      "--nbl-section-header-bg": "#1a1833",
      "--nbl-nav-bg": "#12111f",
      "--nbl-nav-item-color": "#a5b4fc",
      "--nbl-text": "#e0e7ff",
      "--nbl-text-muted": "#a5b4fc",
      "--nbl-border": "#2d2b52",
      "--nbl-nav-border-color": "#2d2b52",
      "--nbl-card-bg": "#1a1833",
      "--nbl-card-border": "#2d2b52",
      "--nbl-home-nav-color": "#e0e7ff",
      "--nbl-notify-bg-from": "#3730a3",
      "--nbl-notify-bg-to": "#6366f1",
      "--nbl-notify-color": "#ffffff",
      "--nbl-section-title-color": "#ffffff",
      "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.18)",
      "--nbl-notify-reward-btn-bg": "#818cf8",
      "--nbl-notify-reward-btn-color": "#1e1b4b",
      "--nbl-notify-reward-btn-border": "#818cf8",
      "--nbl-notify-info-btn-bg": "#818cf8",
      "--nbl-notify-info-btn-color": "#1e1b4b",
      "--nbl-notify-info-btn-border": "#818cf8"
    }
  },
  {
    key: "emerald",
    label: "Emerald Forest",
    swatches: ["#059669", "#34d399", "#ecfdf5"],
    tagline: "Fresh & natural",
    vars: {
      "--nbl-primary": "#059669",
      "--nbl-header-bg": "#059669",
      "--nbl-nav-active-color": "#059669",
      "--nbl-nav-active-border": "#059669",
      "--nbl-loadmore-color": "#ffffff",
      "--nbl-loadmore-bg": "#059669",
      "--nbl-loadmore-border": "#059669",
      "--nbl-accent": "#34d399",
      "--nbl-btn-bg": "#059669",
      "--nbl-btn-border": "#059669",
      "--nbl-btn-color": "#ffffff",
      "--nbl-item-active-border": "#34d399",
      "--nbl-item-active-bg": "#ecfdf5",
      "--nbl-launcher-bg": "#059669",
      "--nbl-home-nav-color": "#ffffff",
      "--nbl-surface": "#ffffff",
      "--nbl-surface-2": "#ecfdf5",
      "--nbl-item-bg": "#ecfdf5",
      "--nbl-section-header-bg": "#ecfdf5",
      "--nbl-nav-bg": "#ffffff",
      "--nbl-nav-item-color": "#6b7280",
      "--nbl-text": "#0a1f18",
      "--nbl-text-muted": "#6b7280",
      "--nbl-border": "#a7f3d0",
      "--nbl-nav-border-color": "#a7f3d0",
      "--nbl-card-bg": "#ffffff",
      "--nbl-card-border": "#a7f3d0",
      "--nbl-notify-bg-from": "#065f46",
      "--nbl-notify-bg-to": "#059669",
      "--nbl-notify-color": "#ffffff",
      "--nbl-section-title-color": "#059669",
      "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
      "--nbl-notify-reward-btn-bg": "#34d399",
      "--nbl-notify-reward-btn-color": "#064e3b",
      "--nbl-notify-reward-btn-border": "#34d399",
      "--nbl-notify-info-btn-bg": "#34d399",
      "--nbl-notify-info-btn-color": "#064e3b",
      "--nbl-notify-info-btn-border": "#34d399"
    }
  },
  {
    key: "ocean",
    label: "Ocean Breeze",
    swatches: ["#0284c7", "#38bdf8", "#f0f9ff"],
    tagline: "Cool & professional",
    vars: {
      "--nbl-primary": "#0284c7",
      "--nbl-header-bg": "#0284c7",
      "--nbl-nav-active-color": "#0284c7",
      "--nbl-nav-active-border": "#0284c7",
      "--nbl-loadmore-color": "#ffffff",
      "--nbl-loadmore-bg": "#0284c7",
      "--nbl-loadmore-border": "#0284c7",
      "--nbl-accent": "#38bdf8",
      "--nbl-btn-bg": "#0284c7",
      "--nbl-btn-border": "#0284c7",
      "--nbl-btn-color": "#ffffff",
      "--nbl-item-active-border": "#38bdf8",
      "--nbl-item-active-bg": "#f0f9ff",
      "--nbl-launcher-bg": "#0284c7",
      "--nbl-home-nav-color": "#ffffff",
      "--nbl-surface": "#ffffff",
      "--nbl-surface-2": "#f0f9ff",
      "--nbl-item-bg": "#f0f9ff",
      "--nbl-section-header-bg": "#f0f9ff",
      "--nbl-nav-bg": "#ffffff",
      "--nbl-nav-item-color": "#6b7280",
      "--nbl-text": "#0c1a2e",
      "--nbl-text-muted": "#6b7280",
      "--nbl-border": "#bae6fd",
      "--nbl-nav-border-color": "#bae6fd",
      "--nbl-card-bg": "#ffffff",
      "--nbl-card-border": "#bae6fd",
      "--nbl-notify-bg-from": "#075985",
      "--nbl-notify-bg-to": "#0284c7",
      "--nbl-notify-color": "#ffffff",
      "--nbl-section-title-color": "#0284c7",
      "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
      "--nbl-notify-reward-btn-bg": "#38bdf8",
      "--nbl-notify-reward-btn-color": "#0c4a6e",
      "--nbl-notify-reward-btn-border": "#38bdf8",
      "--nbl-notify-info-btn-bg": "#38bdf8",
      "--nbl-notify-info-btn-color": "#0c4a6e",
      "--nbl-notify-info-btn-border": "#38bdf8"
    }
  },
  {
    key: "blush",
    label: "Blush Pink",
    swatches: ["#db2777", "#f472b6", "#fdf2f8"],
    tagline: "Soft & feminine",
    vars: {
      "--nbl-primary": "#db2777",
      "--nbl-header-bg": "#db2777",
      "--nbl-nav-active-color": "#db2777",
      "--nbl-nav-active-border": "#db2777",
      "--nbl-accent": "#f472b6",
      "--nbl-btn-bg": "#db2777",
      "--nbl-btn-border": "#db2777",
      "--nbl-btn-color": "#ffffff",
      "--nbl-item-active-border": "#f472b6",
      "--nbl-item-active-bg": "#fdf2f8",
      "--nbl-launcher-bg": "#db2777",
      "--nbl-home-nav-color": "#ffffff",
      "--nbl-loadmore-color": "#ffffff",
      "--nbl-loadmore-bg": "#db2777",
      "--nbl-loadmore-border": "#db2777",
      "--nbl-surface": "#ffffff",
      "--nbl-surface-2": "#fdf2f8",
      "--nbl-item-bg": "#fdf2f8",
      "--nbl-section-header-bg": "#fdf2f8",
      "--nbl-nav-bg": "#ffffff",
      "--nbl-nav-item-color": "#9d174d",
      "--nbl-text": "#1a0011",
      "--nbl-text-muted": "#9d174d",
      "--nbl-border": "#fce7f3",
      "--nbl-nav-border-color": "#fce7f3",
      "--nbl-card-bg": "#ffffff",
      "--nbl-card-border": "#fce7f3",
      "--nbl-notify-bg-from": "#9d174d",
      "--nbl-notify-bg-to": "#db2777",
      "--nbl-notify-color": "#ffffff",
      "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
      "--nbl-section-title-color": "#db2777",
      "--nbl-notify-reward-btn-bg": "#f472b6",
      "--nbl-notify-reward-btn-color": "#831843",
      "--nbl-notify-reward-btn-border": "#f472b6",
      "--nbl-notify-info-btn-bg": "#f472b6",
      "--nbl-notify-info-btn-color": "#831843",
      "--nbl-notify-info-btn-border": "#f472b6"
    }
  }
];
const CSS_DEFAULTS = {
  // ── Added to match public/widget/module-preact/styles/ui.css (2026-07-03 audit) ──
  "--nbl-button-accent-bg": "var(--nbl-accent)",
  "--nbl-button-accent-color": "#ffffff",
  "--nbl-button-accent-hover": "var(--nbl-accent-hover)",
  "--nbl-button-font-size-lg": "var(--nbl-text-lg)",
  "--nbl-button-font-size-md": "var(--nbl-text-base)",
  "--nbl-button-font-size-sm": "var(--nbl-text-sm)",
  "--nbl-button-font-weight": "600",
  "--nbl-button-ghost-color": "var(--nbl-text-muted)",
  "--nbl-button-ghost-hover-bg": "var(--nbl-surface-2)",
  "--nbl-button-outline-border": "var(--nbl-border)",
  "--nbl-button-outline-color": "var(--nbl-text)",
  "--nbl-button-outline-hover-bg": "var(--nbl-surface-2)",
  "--nbl-button-padding-lg": "12px 24px",
  "--nbl-button-padding-md": "10px 18px",
  "--nbl-button-padding-sm": "7px 14px",
  "--nbl-button-primary-bg": "var(--nbl-primary)",
  "--nbl-button-primary-color": "#ffffff",
  "--nbl-button-primary-hover": "var(--nbl-primary-hover)",
  "--nbl-button-radius": "var(--nbl-radius-md)",
  "--nbl-divider-color": "var(--nbl-border)",
  "--nbl-divider-spacing": "12px",
  "--nbl-divider-width": "var(--nbl-border-width)",
  "--nbl-heading-color": "var(--nbl-text)",
  "--nbl-heading-font-weight": "700",
  "--nbl-heading-size-lg": "22px",
  "--nbl-heading-size-md": "18px",
  "--nbl-heading-size-sm": "var(--nbl-text-lg)",
  "--nbl-icon-color": "var(--nbl-accent)",
  "--nbl-icon-size-lg": "28px",
  "--nbl-icon-size-md": "20px",
  "--nbl-icon-size-sm": "14px",
  "--nbl-image-placeholder-bg": "var(--nbl-surface-2)",
  "--nbl-image-placeholder-color": "var(--nbl-accent)",
  "--nbl-image-radius": "var(--nbl-radius-sm)",
  "--nbl-image-size-md": "52px",
  "--nbl-image-size-sm": "36px",
  "--nbl-item-gap": "12px",
  "--nbl-item-row-border-color": "rgba(0, 0, 0, 0.04)",
  "--nbl-modal-btn-finish-bg": "#15803d",
  "--nbl-modal-btn-finish-color": "#ffffff",
  "--nbl-modal-btn-finish-hover": "#166534",
  "--nbl-modal-btn-primary-color": "#ffffff",
  "--nbl-notify-info-badge-font-size": "11px",
  "--nbl-notify-info-badge-padding": "4px 10px",
  "--nbl-notify-info-badge-radius": "99px",
  "--nbl-notify-info-contact-bg": "rgba(255, 255, 255, 0.12)",
  "--nbl-notify-info-contact-border": "rgba(255, 255, 255, 0.22)",
  "--nbl-notify-info-contact-color": "#ffffff",
  "--nbl-notify-info-contact-font-size": "13px",
  "--nbl-notify-info-contact-radius": "var(--nbl-radius-md)",
  "--nbl-notify-info-max-height": "78%",
  "--nbl-notify-info-title-size": "17px",
  "--nbl-notify-info-title-weight": "600",
  "--nbl-prize-status-cancelled": "#dc2626",
  "--nbl-prize-status-fulfilled": "#16a34a",
  "--nbl-prize-status-pending": "var(--nbl-text-muted)",
  "--nbl-status-negative-bg": "rgba(240, 100, 100, 0.22)",
  "--nbl-status-negative-border": "rgba(240, 100, 100, 0.4)",
  "--nbl-status-negative-color": "#f09595",
  "--nbl-status-negative-soft-bg": "rgba(240, 100, 100, 0.15)",
  "--nbl-status-pending-bg": "rgba(250, 199, 117, 0.22)",
  "--nbl-status-pending-border": "rgba(250, 199, 117, 0.4)",
  "--nbl-status-pending-color": "#fac775",
  "--nbl-status-positive-bg": "rgba(95, 214, 163, 0.22)",
  "--nbl-status-positive-border": "rgba(95, 214, 163, 0.4)",
  "--nbl-status-positive-color": "#5fd6a3",
  "--nbl-text-font-weight": "400",
  "--nbl-widget-origin": "bottom left",
  "--nbl-primary": "#8b5cf6",
  "--nbl-primary-hover": "color-mix(in srgb, var(--nbl-primary) 85%, #000)",
  "--nbl-primary-light": "color-mix(in srgb, var(--nbl-primary) 12%, #fff)",
  "--nbl-accent": "#4ecba8",
  "--nbl-accent-hover": "color-mix(in srgb, var(--nbl-accent) 85%, #000)",
  "--nbl-accent-light": "color-mix(in srgb, var(--nbl-accent) 12%, #fff)",
  "--nbl-header-bg": "#8b5cf6",
  "--nbl-header-color": "#ffffff",
  "--nbl-header-padding": "22px 20px 18px",
  "--nbl-header-compact-padding": "10px 20px",
  "--nbl-header-title-font-size": "16px",
  "--nbl-header-title-font-weight": "700",
  "--nbl-points-bg": "rgba(255, 255, 255, 0.2)",
  "--nbl-points-color": "#ffffff",
  "--nbl-points-font-size": "12px",
  "--nbl-points-padding": "5px 12px",
  "--nbl-points-border-radius": "99px",
  "--nbl-points-border-color": "rgba(255, 255, 255, 0.22)",
  "--nbl-nav-bg": "#ffffff",
  "--nbl-nav-border-color": "#e9e7f0",
  "--nbl-nav-active-color": "#8b5cf6",
  "--nbl-nav-active-border": "#8b5cf6",
  "--nbl-nav-item-color": "#6b7280",
  "--nbl-nav-item-font-size": "12px",
  "--nbl-nav-item-font-weight": "500",
  "--nbl-nav-item-padding": "14px 4px 12px",
  "--nbl-nav-chevron-color": "#6b7280",
  "--nbl-nav-chevron-hover-color": "#8b5cf6",
  "--nbl-nav-chevron-bg": "#ffffff",
  "--nbl-nav-chevron-border": "#e9e7f0",
  "--nbl-nav-chevron-size": "28px",
  "--nbl-nav-chevron-icon-size": "14px",
  "--nbl-nav-chevron-radius": "8px",
  "--nbl-btn-bg": "#8b5cf6",
  "--nbl-btn-color": "#ffffff",
  "--nbl-btn-border": "#8b5cf6",
  "--nbl-btn-radius": "10px",
  "--nbl-btn-font-size": "14px",
  "--nbl-btn-font-weight": "600",
  "--nbl-btn-padding": "10px 20px",
  "--nbl-surface": "#ffffff",
  "--nbl-surface-2": "#f8f7ff",
  "--nbl-surface-hover": "#f3f1fc",
  "--nbl-text": "#1a1a1a",
  "--nbl-text-muted": "#6b7280",
  "--nbl-text-xs": "11px",
  "--nbl-text-sm": "12px",
  "--nbl-text-base": "13px",
  "--nbl-text-md": "13.5px",
  "--nbl-text-lg": "16px",
  "--nbl-border": "#e9e7f0",
  "--nbl-border-width": "1px",
  "--nbl-border-width-md": "1.5px",
  "--nbl-radius": "16px",
  "--nbl-radius-sm": "8px",
  "--nbl-radius-md": "10px",
  "--nbl-radius-lg": "12px",
  "--nbl-radius-xl": "16px",
  "--nbl-radius-full": "999px",
  "--nbl-shadow": "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
  "--nbl-shadow-sm": "0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  "--nbl-shadow-md": "0 6px 20px rgba(0,0,0,0.12)",
  "--nbl-shadow-nav-chevron": "0 2px 8px rgba(0,0,0,0.1)",
  "--nbl-card-bg": "#ffffff",
  "--nbl-card-border": "#e9e7f0",
  "--nbl-card-radius": "12px",
  "--nbl-card-padding": "14px 13px",
  "--nbl-card-shadow": "0 2px 12px rgba(0,0,0,0.06)",
  "--nbl-section-header-bg": "#f8f7ff",
  "--nbl-section-header-padding": "10px 14px",
  "--nbl-section-title-font-size": "13px",
  "--nbl-section-title-font-weight": "600",
  "--nbl-section-title-color": "#1a1a1a",
  "--nbl-home-nav-color": "#ffffff",
  "--nbl-item-bg": "#f8f7ff",
  "--nbl-item-border": "#e9e7f0",
  "--nbl-item-active-bg": "#f0fdf9",
  "--nbl-item-active-border": "#4ecba8",
  "--nbl-item-radius": "12px",
  "--nbl-item-padding": "14px 13px",
  "--nbl-item-title-font-size": "13.5px",
  "--nbl-item-title-font-weight": "600",
  "--nbl-item-meta-font-size": "12px",
  "--nbl-item-hover-shadow": "0 6px 18px rgba(78,203,168,0.25)",
  "--nbl-activity-header-font-size": "10px",
  "--nbl-activity-header-font-weight": "700",
  "--nbl-activity-row-font-size": "12px",
  "--nbl-activity-row-padding": "7px 4px",
  "--nbl-activity-border-color": "rgba(0,0,0,0.04)",
  "--nbl-activity-positive-color": "#16a34a",
  "--nbl-activity-negative-color": "#dc2626",
  "--nbl-pagination-btn-size": "32px",
  "--nbl-pagination-btn-radius": "10px",
  "--nbl-pagination-btn-border": "#e9e7f0",
  "--nbl-pagination-btn-bg": "#ffffff",
  "--nbl-pagination-btn-color": "#6b7280",
  "--nbl-pagination-dot-size": "7px",
  "--nbl-pagination-dot-active-width": "18px",
  "--nbl-pagination-dot-radius": "4px",
  "--nbl-loadmore-radius": "12px",
  "--nbl-loadmore-border": "#e9e7f0",
  "--nbl-loadmore-bg": "#ffffff",
  "--nbl-loadmore-color": "#8b5cf6",
  "--nbl-loadmore-font-size": "13px",
  "--nbl-loadmore-font-weight": "600",
  "--nbl-loadmore-padding": "11px 20px",
  "--nbl-notify-bg-from": "#15803d",
  "--nbl-notify-bg-to": "#22c55e",
  "--nbl-notify-color": "#ffffff",
  "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.22)",
  "--nbl-notify-reward-btn-bg": "#4ecba8",
  "--nbl-notify-reward-btn-color": "#16a34a",
  "--nbl-notify-reward-btn-border": "#4ecba8",
  "--nbl-notify-info-btn-bg": "#4ecba8",
  "--nbl-notify-info-btn-color": "#ffffff",
  "--nbl-notify-info-btn-border": "#4ecba8",
  "--nbl-status-success-bg": "#f0fdf4",
  "--nbl-status-success-border": "#86efac",
  "--nbl-status-success-color": "#166534",
  "--nbl-status-success-text": "#15803d",
  "--nbl-status-error-bg": "#fef2f2",
  "--nbl-status-error-border": "#fecaca",
  "--nbl-status-error-color": "#b91c1c",
  "--nbl-status-warning-bg": "#fffbeb",
  "--nbl-status-warning-border": "#FEC643",
  "--nbl-status-warning-color": "#854d0e",
  "--nbl-status-warning-strong": "#b45309",
  "--nbl-status-info-bg": "#eff6ff",
  "--nbl-status-info-border": "#bfdbfe",
  "--nbl-status-info-color": "#1e40af",
  "--nbl-modal-bg": "#ffffff",
  "--nbl-modal-title-color": "#111827",
  "--nbl-modal-subtitle-color": "#4b5563",
  "--nbl-modal-text-color": "#374151",
  "--nbl-modal-muted-color": "#9ca3af",
  "--nbl-modal-brand-bg": "#ecfdf5",
  "--nbl-modal-brand-color": "#15803d",
  "--nbl-modal-input-bg": "#f9fafb",
  "--nbl-modal-input-border": "#e5e7eb",
  "--nbl-modal-input-focus": "#16a34a",
  "--nbl-modal-input-readonly": "#f3f4f6",
  "--nbl-modal-btn-primary-bg": "#111827",
  "--nbl-modal-btn-primary-hover": "#1f2937",
  "--nbl-modal-code-bg": "#f8fafc",
  "--nbl-modal-code-border": "#d1d5db",
  "--nbl-modal-code-hover-bg": "#f0fdf4",
  "--nbl-modal-code-hover-border": "#16a34a",
  "--nbl-modal-scrollbar-color": "#d1d5db",
  "--nbl-ease-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  "--nbl-ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "--nbl-launcher-bg": "var(--nbl-btn-bg)",
  "--nbl-launcher-color": "var(--nbl-btn-color)",
  "--nbl-launcher-border-radius": "999px",
  "--nbl-launcher-shadow": "0 6px 24px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14), 0 0 0 3px rgba(255,255,255,0.15) inset",
  "--nbl-launcher-shadow-hover": "0 14px 36px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.18), 0 0 0 3px rgba(255,255,255,0.15) inset",
  "--nbl-launcher-shadow-float": "0 14px 32px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.16), 0 0 0 3px rgba(255,255,255,0.15) inset",
  "--nbl-launcher-icon": "'gift'",
  "--nbl-launcher-icon-size": "20px",
  "--nbl-launcher-icon-bg": "rgba(0,0,0,0.18)",
  "--nbl-launcher-icon-circle": "44px",
  "--nbl-launcher-title-size": "13px",
  "--nbl-launcher-title-weight": "700",
  "--nbl-launcher-sub-size": "11px",
  "--nbl-launcher-sub-weight": "500",
  "--nbl-launcher-sub-opacity": "0.82",
  "--nbl-launcher-bottom": "24px",
  "--nbl-launcher-position": "right",
  "--nbl-launcher-side-offset": "20px",
  "--nbl-widget-body-padding": "14px 14px 24px",
  "--nbl-modal-radius": "20px",
  "--nbl-modal-padding": "24px 22px 22px",
  "--nbl-dur-fast": "0.18s",
  "--nbl-dur-normal": "0.28s",
  "--nbl-dur-slow": "0.42s",
  "--nbl-widget-glow-primary": "color-mix(in srgb, var(--nbl-primary) 12%, transparent)",
  "--nbl-widget-glow-halo": "color-mix(in srgb, var(--nbl-primary) 5%, transparent)",
  "--nbl-referral-copy-btn-bg": "#4ecba8",
  "--nbl-referral-copy-btn-color": "#ffffff",
  "--nbl-referral-copy-btn-border": "#4ecba8"
};
function deepClone$1(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function matchesPreset(preset, cssVars) {
  return Object.keys(preset.vars).every((k) => cssVars[k] === preset.vars[k]);
}
function buildInitialVars(savedCssVars) {
  const base = deepClone$1(CSS_DEFAULTS);
  if (!savedCssVars || typeof savedCssVars !== "object") return base;
  return { ...base, ...savedCssVars };
}
function buildInitialWidgetConfig(saved) {
  const base = { ...WIDGET_CONFIG_DEFAULTS, labels: { ...LABEL_DEFAULTS }, prize: { ...WIDGET_CONFIG_DEFAULTS.prize } };
  if (!saved || typeof saved !== "object") return base;
  const merged = { ...base, ...saved };
  merged.labels = { ...LABEL_DEFAULTS, ...saved.labels || {} };
  merged.prize = { ...WIDGET_CONFIG_DEFAULTS.prize, ...saved.prize || {} };
  return merged;
}
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isHex(v) {
  return HEX_RE.test((v ?? "").trim());
}
const DS = {
  sp2: "2px",
  sp4: "4px",
  sp6: "6px",
  sp8: "8px",
  sp10: "10px",
  sp12: "12px",
  sp14: "14px",
  sp16: "16px",
  sp20: "20px",
  r6: "6px",
  r8: "8px",
  r10: "10px",
  r12: "12px",
  r99: "99px",
  bg: "#f9fafb",
  bgCard: "#ffffff",
  borderLight: "#e5e7eb",
  borderMid: "#d1d5db",
  text: "#111827",
  textSub: "#374151",
  textMuted: "#6b7280",
  textHint: "#9ca3af",
  accentBg: "#f5f3ff",
  accentText: "#6d28d9",
  accentBorder: "#ede9fe",
  warnBg: "#fffbeb",
  warnBorder: "#FEC643",
  warnText: "#92400e",
  dangerText: "#dc2626",
  dangerBg: "#fef2f2"
};
const SECTION_TO_SCENE = {
  header: "home",
  navigation: "home",
  brand: "home",
  buttons: "earn",
  text: "home",
  surfaces: "home",
  rewards: "rewards",
  activity: "home",
  pagination: "rewards",
  notifications: "notification-reward",
  status: "home",
  modal: "modal",
  animations: "home",
  glow: "home"
};
async function upsertAndSync(session, admin, cssVars, presetKey = null, widgetConfig = null) {
  const data = { cssVars, presetKey, widgetConfig };
  await prisma.style.upsert({
    where: { shop: session.shop },
    update: data,
    create: { shop: session.shop, sessionId: session.id, ...data }
  });
  await syncAppConfig(admin, session);
}
async function handleUpdate({ formData, session, admin }) {
  const intent = "update";
  try {
    const cssVars = JSON.parse(formData.get("cssVars") || "{}");
    const presetKey = formData.get("presetKey") || null;
    const rawWidgetConfig = formData.get("widgetConfig");
    const widgetConfig = rawWidgetConfig ? JSON.parse(rawWidgetConfig) : null;
    await upsertAndSync(session, admin, cssVars, presetKey, widgetConfig);
    return {
      ok: true,
      intent,
      message: "Widget styles saved successfully.",
      savedCssVars: cssVars,
      savedPresetKey: presetKey,
      savedWidgetConfig: widgetConfig
    };
  } catch (err) {
    console.error("[customize] update error:", err);
    return { ok: false, intent, message: "Something went wrong. Please try again." };
  }
}
async function handleResetAll({ session, admin }) {
  const intent = "resetAll";
  try {
    const fresh = { ...CSS_DEFAULTS };
    await upsertAndSync(session, admin, fresh, null, null);
    return {
      ok: true,
      intent,
      message: "All styles reset to defaults.",
      savedCssVars: fresh,
      savedPresetKey: null,
      savedWidgetConfig: null
    };
  } catch (err) {
    console.error("[customize] resetAll error:", err);
    return { ok: false, intent, message: "Something went wrong. Please try again." };
  }
}
async function handleClearAll({ session, admin }) {
  const intent = "clearAll";
  try {
    await prisma.style.upsert({
      where: { shop: session.shop },
      update: { cssVars: null, presetKey: null, widgetConfig: null },
      create: { shop: session.shop, sessionId: session.id, cssVars: null, presetKey: null, widgetConfig: null }
    });
    await syncAppConfig(admin, session);
    return {
      ok: true,
      intent,
      message: "Custom styles cleared. Widget is now using default CSS.",
      savedCssVars: null,
      savedPresetKey: null,
      savedWidgetConfig: null
    };
  } catch (err) {
    console.error("[customize] clearAll error:", err);
    return { ok: false, intent, message: "Something went wrong. Please try again." };
  }
}
function useCustomizePage(loaderData, actionData) {
  const { savedCssVars, savedWidgetConfig } = loaderData;
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const isNetworkSubmitting = navigation.state === "submitting";
  const initialVars = useMemo(() => buildInitialVars(savedCssVars), []);
  const [cssVars, setCssVars] = useState(() => deepClone$1(initialVars));
  const [persistedVars, setPersistedVars] = useState(() => deepClone$1(initialVars));
  const [widgetConfig, setWidgetConfig] = useState(() => buildInitialWidgetConfig(savedWidgetConfig));
  const [persistedWidgetConfig, setPersistedWidgetConfig] = useState(() => buildInitialWidgetConfig(savedWidgetConfig));
  const [hasSavedCustomStyles, setHasSavedCustomStyles] = useState(savedCssVars !== null);
  const [activeSimpleSection, setActiveSimpleSection] = useState(SIMPLE_SECTIONS[0].key);
  const [activeConfigSection, setActiveConfigSection] = useState(WIDGET_CONFIG_SECTIONS[0].key);
  const [pageTab, setPageTab] = useState("customize");
  const [activeIntent, setActiveIntent] = useState(null);
  const [notificationPreviewType, setNotificationPreviewType] = useState("reward");
  const activePreset = useMemo(
    () => {
      var _a2;
      return ((_a2 = PRESETS.find((p) => matchesPreset(p, cssVars))) == null ? void 0 : _a2.key) ?? null;
    },
    [cssVars]
  );
  const lastSyncedActionRef = useRef(null);
  useEffect(() => {
    if (!actionData) return;
    if (actionData === lastSyncedActionRef.current) return;
    lastSyncedActionRef.current = actionData;
    shopify2.toast.show(actionData.message, { isError: !actionData.ok });
    setActiveIntent(null);
    if (!actionData.ok) return;
    if (["update", "resetAll"].includes(actionData.intent)) {
      const freshVars = buildInitialVars(actionData.savedCssVars);
      const freshWc = buildInitialWidgetConfig(actionData.savedWidgetConfig ?? null);
      setCssVars(freshVars);
      setPersistedVars(freshVars);
      setWidgetConfig(freshWc);
      setPersistedWidgetConfig(freshWc);
      setHasSavedCustomStyles(true);
    }
    if (actionData.intent === "clearAll") {
      const freshVars = deepClone$1(CSS_DEFAULTS);
      const freshWc = buildInitialWidgetConfig(null);
      setCssVars(freshVars);
      setPersistedVars(freshVars);
      setWidgetConfig(freshWc);
      setPersistedWidgetConfig(freshWc);
      setHasSavedCustomStyles(false);
    }
  }, [actionData]);
  const hasStyleChanges = useMemo(() => !isEqual(cssVars, persistedVars), [cssVars, persistedVars]);
  const hasConfigChanges = useMemo(
    () => JSON.stringify(widgetConfig) !== JSON.stringify(persistedWidgetConfig),
    [widgetConfig, persistedWidgetConfig]
  );
  const hasChanges = hasStyleChanges || hasConfigChanges;
  const isUpdating = isNetworkSubmitting && activeIntent === "update";
  const isFirstSave = savedCssVars === null && !hasChanges;
  const totalDirtyVarCount = useMemo(
    () => Object.keys(cssVars).filter((k) => cssVars[k] !== persistedVars[k]).length,
    [cssVars, persistedVars]
  );
  const simpleSectionDirtyCount = useCallback((section) => {
    return section.fields.filter((f) => f.maps.some((v) => cssVars[v] !== persistedVars[v])).length;
  }, [cssVars, persistedVars]);
  const configSectionDirtyCount = useCallback((section) => {
    return section.fields.filter((f) => {
      var _a2, _b, _c, _d;
      if (f.configKey.startsWith("labels.")) {
        const labelKey = f.configKey.slice(7);
        return ((_a2 = widgetConfig.labels) == null ? void 0 : _a2[labelKey]) !== ((_b = persistedWidgetConfig.labels) == null ? void 0 : _b[labelKey]);
      }
      if (f.configKey.startsWith("prize.")) {
        const prizeKey = f.configKey.slice(6);
        return ((_c = widgetConfig.prize) == null ? void 0 : _c[prizeKey]) !== ((_d = persistedWidgetConfig.prize) == null ? void 0 : _d[prizeKey]);
      }
      return widgetConfig[f.configKey] !== persistedWidgetConfig[f.configKey];
    }).length;
  }, [widgetConfig, persistedWidgetConfig]);
  const deferredCssVars = useDeferredValue(cssVars);
  const handleSimpleChange = useCallback((updates) => {
    setCssVars((prev) => ({ ...prev, ...updates }));
  }, []);
  const handleConfigChange = useCallback((key, value) => {
    if (key.startsWith("labels.")) {
      const labelKey = key.slice(7);
      setWidgetConfig((prev) => ({ ...prev, labels: { ...prev.labels, [labelKey]: value } }));
    } else if (key.startsWith("prize.")) {
      const prizeKey = key.slice(6);
      setWidgetConfig((prev) => ({ ...prev, prize: { ...prev.prize, [prizeKey]: value } }));
    } else {
      setWidgetConfig((prev) => ({ ...prev, [key]: value }));
    }
  }, []);
  const handlePresetApply = useCallback((preset) => {
    setCssVars((prev) => ({ ...prev, ...preset.vars }));
  }, []);
  const handleDiscard = useCallback(() => {
    setCssVars(deepClone$1(persistedVars));
    setWidgetConfig(deepClone$1(persistedWidgetConfig));
  }, [persistedVars, persistedWidgetConfig]);
  const handleSave = useCallback(() => {
    setActiveIntent("update");
    const fd = new FormData();
    fd.set("intent", "update");
    fd.set("cssVars", JSON.stringify(cssVars));
    fd.set("presetKey", activePreset ?? "");
    fd.set("widgetConfig", JSON.stringify(widgetConfig));
    submit(fd, { method: "post" });
  }, [cssVars, activePreset, widgetConfig, submit]);
  const handleResetAll2 = useCallback(() => {
    setActiveIntent("resetAll");
    const fd = new FormData();
    fd.set("intent", "resetAll");
    submit(fd, { method: "post" });
  }, [submit]);
  const handleClearAll2 = useCallback(() => {
    setActiveIntent("clearAll");
    const fd = new FormData();
    fd.set("intent", "clearAll");
    submit(fd, { method: "post" });
  }, [submit]);
  const activeSimpleSectionDef = SIMPLE_SECTIONS.find((s) => s.key === activeSimpleSection) ?? SIMPLE_SECTIONS[0];
  return {
    cssVars,
    deferredCssVars,
    widgetConfig,
    activePreset,
    activeSimpleSection,
    activeConfigSection,
    activeSimpleSectionDef,
    pageTab,
    setPageTab,
    notificationPreviewType,
    setNotificationPreviewType,
    hasChanges,
    isFirstSave,
    isUpdating,
    isNetworkSubmitting,
    activeIntent,
    totalDirtyVarCount,
    simpleSectionDirtyCount,
    configSectionDirtyCount,
    setActiveSimpleSection,
    setActiveConfigSection,
    setWidgetConfig,
    handleSimpleChange,
    handleConfigChange,
    handlePresetApply,
    handleDiscard,
    handleSave,
    handleResetAll: handleResetAll2,
    handleClearAll: handleClearAll2
  };
}
const PREVIEW_SRC = "/widget/preview.html";
const POST_TARGET = "nbl-customize";
const CSS_VARS_DEBOUNCE_MS = 80;
const LivePreviewPanel = memo(function LivePreviewPanel2({
  cssVars,
  previewScene = "home",
  widgetConfig = null,
  hidden = false
}) {
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const cssVarsDebounceRef = useRef(null);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    function onMessage(e) {
      var _a2;
      if (((_a2 = e.data) == null ? void 0 : _a2.source) === "nbl-preview" && e.data.type === "ready") {
        setIframeReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const post = (type, payload) => {
    var _a2, _b;
    (_b = (_a2 = iframeRef.current) == null ? void 0 : _a2.contentWindow) == null ? void 0 : _b.postMessage(
      { source: POST_TARGET, type, payload },
      window.location.origin
    );
  };
  useEffect(() => {
    if (!iframeReady) return;
    if (cssVarsDebounceRef.current) clearTimeout(cssVarsDebounceRef.current);
    cssVarsDebounceRef.current = setTimeout(() => {
      post("cssVars", cssVars);
    }, CSS_VARS_DEBOUNCE_MS);
    return () => clearTimeout(cssVarsDebounceRef.current);
  }, [cssVars, iframeReady]);
  useEffect(() => {
    if (!iframeReady) return;
    post("widgetConfig", widgetConfig);
  }, [widgetConfig, iframeReady]);
  useEffect(() => {
    if (!iframeReady) return;
    post("scene", previewScene);
  }, [previewScene, iframeReady]);
  const isLeft = ((cssVars == null ? void 0 : cssVars["--nbl-launcher-position"]) || "right") === "left";
  const PREVIEW_SCALE = 0.92;
  return /* @__PURE__ */ jsx(Fragment, { children: isMounted && createPortal(
    /* @__PURE__ */ jsx(
      "iframe",
      {
        ref: iframeRef,
        src: PREVIEW_SRC,
        title: "Widget Live Preview",
        sandbox: "allow-scripts allow-same-origin",
        style: {
          position: "fixed",
          bottom: 0,
          ...isLeft ? { left: 0 } : { right: 0 },
          // True widget footprint from ui.css: 390px wide ×
          // (88px bottom offset + 520px panel) tall, plus a
          // little headroom for shadow/glow so nothing clips.
          width: 390,
          height: 630,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: isLeft ? "bottom left" : "bottom right",
          border: "none",
          background: "transparent",
          zIndex: 9999999999998,
          // iframe stays click-through everywhere except where the
          // real widget paints something (launcher / popup) — the
          // widget's own CSS sizes those, so no per-pixel overlay
          // logic is needed here.
          pointerEvents: "auto"
        }
      }
    ),
    document.body
  ) });
});
const PAGE_TABS = [
  { key: "customize", label: "Customize" },
  { key: "config", label: "Widget Config" },
  { key: "labels", label: "Labels & Text" },
  // Gated by ADVANCED_MODE_ENABLED (constants/cssVarsConfig.js) — flip that
  // one constant to hide this tab everywhere, no other changes needed.
  ...[{ key: "advanced", label: "Advanced" }]
];
function PageHeader$2({
  hasChanges,
  isFirstSave,
  totalDirtyVarCount,
  isNetworkSubmitting,
  isUpdating,
  activeIntent,
  pageTab,
  onTabChange,
  onDiscard,
  onResetAll,
  onSave
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: DS.sp10 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp10 }, children: [
        /* @__PURE__ */ jsx("h1", { style: { fontSize: 22, fontWeight: 800, color: DS.text, margin: 0, letterSpacing: "-0.02em" }, children: "Customize Widget" }),
        hasChanges && /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 5, background: "#fffbeb", color: "#92400e", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: DS.r99, border: "1px solid #fde68a" }, children: [
          /* @__PURE__ */ jsx("span", { style: { width: 6, height: 6, borderRadius: "50%", background: "#92400e", flexShrink: 0 } }),
          "Unsaved changes"
        ] }),
        isFirstSave && /* @__PURE__ */ jsx("span", { style: { background: "#eff6ff", color: "#1e40af", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: DS.r99, border: "1px solid #bfdbfe" }, children: "First setup" })
      ] }),
      /* @__PURE__ */ jsx("p", { style: { fontSize: 13, color: DS.textMuted, margin: 0 }, children: "Personalize your loyalty widget to match your store's brand. Changes show instantly in the preview." }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp8 }, children: [
        /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: onDiscard, disabled: !hasChanges || isNetworkSubmitting, children: "Discard" }),
        /* @__PURE__ */ jsx("s-button", { variant: "plain", tone: "critical", onClick: onResetAll, disabled: isNetworkSubmitting, loading: isNetworkSubmitting && activeIntent === "resetAll" ? true : void 0, children: "Reset all" }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "primary",
            onClick: onSave,
            disabled: !hasChanges || isNetworkSubmitting,
            loading: isUpdating ? true : void 0,
            children: hasChanges ? `Save changes${totalDirtyVarCount > 0 ? ` (${totalDirtyVarCount})` : ""}` : "Save changes"
          }
        )
      ] })
    ] }) }),
    isFirstSave && /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx("s-banner", { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No custom styles saved yet. The widget is using default values. Edit any value below and save to apply your brand." }) }) }),
    /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: DS.sp4, background: DS.bg, borderRadius: DS.r10, padding: 4, width: "fit-content" }, children: PAGE_TABS.map((tab) => /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => onTabChange(tab.key),
        style: {
          padding: "7px 18px",
          fontSize: 13,
          fontWeight: pageTab === tab.key ? 700 : 500,
          borderRadius: DS.r8,
          border: "none",
          background: pageTab === tab.key ? DS.bgCard : "transparent",
          color: pageTab === tab.key ? DS.text : DS.textMuted,
          cursor: "pointer",
          boxShadow: pageTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
          transition: "all 0.15s"
        },
        children: tab.label
      },
      tab.key
    )) }) })
  ] });
}
function PresetCard({ preset, isActive, onApply, disabled }) {
  return /* @__PURE__ */ jsx("div", { style: {
    background: isActive ? DS.accentBg : DS.bgCard,
    border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
    borderRadius: DS.r12,
    overflow: "hidden",
    transition: "all 0.18s",
    boxShadow: isActive ? "0 0 0 3px #ede9fe" : "none"
  }, children: /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        padding: `${DS.sp10} ${DS.sp12}`,
        display: "flex",
        alignItems: "center",
        gap: DS.sp8,
        cursor: disabled ? "default" : "pointer"
      },
      onClick: () => !disabled && onApply(preset),
      children: [
        /* @__PURE__ */ jsx("div", { style: {
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: isActive ? "5px solid #7c3aed" : `2px solid ${DS.borderMid}`,
          background: isActive ? "#fff" : "transparent",
          flexShrink: 0
        } }),
        /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#5b21b6" : DS.text }, children: preset.label }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: isActive ? "#7c3aed" : DS.textHint }, children: preset.tagline })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 3, flexShrink: 0 }, children: preset.swatches.map((color, i) => /* @__PURE__ */ jsx("div", { style: {
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: color,
          border: "1px solid rgba(0,0,0,0.1)"
        } }, i)) })
      ]
    }
  ) });
}
function SidebarNavItem({ label: label2, isActive, badge, onClick, disabled }) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      onClick,
      disabled,
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${DS.sp8} ${DS.sp12}`,
        borderRadius: DS.r10,
        border: isActive ? `1.5px solid ${DS.accentBorder}` : "1.5px solid transparent",
        background: isActive ? DS.accentBg : "transparent",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        transition: "all 0.15s"
      },
      children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? DS.accentText : DS.textSub }, children: label2 }),
        badge > 0 && /* @__PURE__ */ jsx("span", { style: {
          background: isActive ? DS.accentText : "#f59e0b",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: DS.r99,
          minWidth: 18,
          textAlign: "center"
        }, children: badge })
      ]
    }
  );
}
function FieldWrapper({ isDirty, children, onRevert, disabled }) {
  return /* @__PURE__ */ jsxs("div", { style: {
    background: isDirty ? DS.warnBg : DS.bgCard,
    border: `1.5px solid ${isDirty ? DS.warnBorder : DS.borderLight}`,
    borderRadius: DS.r12,
    padding: `${DS.sp14} ${DS.sp16}`,
    transition: "all 0.18s"
  }, children: [
    children,
    isDirty && /* @__PURE__ */ jsx("div", { style: { marginTop: DS.sp10, display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx(
      "button",
      {
        disabled,
        onClick: onRevert,
        style: {
          background: "none",
          border: `1px solid ${DS.warnBorder}`,
          borderRadius: DS.r6,
          padding: "3px 10px",
          fontSize: 11,
          color: DS.warnText,
          cursor: disabled ? "default" : "pointer",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 4
        },
        children: "↩ Revert to default"
      }
    ) })
  ] });
}
function FieldLabel({ label: label2, hint, isDirty }) {
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp10 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp8, marginBottom: DS.sp2 }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 600, color: DS.text }, children: label2 }),
      isDirty && /* @__PURE__ */ jsx("span", { style: {
        background: "#fef3c7",
        color: "#92400e",
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 7px",
        borderRadius: DS.r99,
        border: "1px solid #fde68a"
      }, children: "Modified" })
    ] }),
    hint && /* @__PURE__ */ jsx("p", { style: { fontSize: 12, color: DS.textMuted, margin: 0, lineHeight: 1.4 }, children: hint })
  ] });
}
function SimpleColorField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const displayHex = isHex(rawValue) ? rawValue : field.resolvedDefault ?? "#cccccc";
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handleChange(hex) {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = hex;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp12 }, children: [
      /* @__PURE__ */ jsx("div", { style: { position: "relative", flexShrink: 0 }, children: /* @__PURE__ */ jsx("div", { style: {
        width: 48,
        height: 48,
        borderRadius: DS.r10,
        border: `2px solid ${isDirty ? DS.warnBorder : DS.borderMid}`,
        background: displayHex,
        overflow: "hidden",
        cursor: disabled ? "default" : "pointer",
        boxShadow: `0 2px 8px ${displayHex}55`
      }, children: !disabled && /* @__PURE__ */ jsx(
        "input",
        {
          type: "color",
          value: displayHex,
          onChange: (e) => handleChange(e.target.value),
          style: { opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }
        }
      ) }) }),
      /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx(
          "s-text-field",
          {
            value: isHex(rawValue) ? rawValue : displayHex,
            onInput: (e) => {
              if (isHex(e.target.value)) handleChange(e.target.value);
            },
            disabled,
            "auto-complete": "off",
            placeholder: "#000000",
            style: { fontFamily: "monospace", maxWidth: 140 }
          }
        ),
        !isHex(rawValue) && rawValue && rawValue.startsWith("var(") && /* @__PURE__ */ jsxs("div", { style: { fontSize: 10, color: DS.textHint, marginTop: 4 }, children: [
          "Using theme default (",
          displayHex,
          "). Pick a color to override."
        ] })
      ] })
    ] })
  ] });
}
function SimpleRangeField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const numValue = field.displayValue ? field.displayValue(rawValue) : parseInt(rawValue);
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handleChange(num2) {
    const cssVal = field.parseValue ? field.parseValue(num2) : `${num2}px`;
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = cssVal;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  const safeNum = isNaN(numValue) ? field.min : numValue;
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp12 }, children: [
      /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        "input",
        {
          type: "range",
          min: field.min,
          max: field.max,
          step: 1,
          value: safeNum,
          disabled,
          onChange: (e) => handleChange(parseInt(e.target.value)),
          style: { width: "100%", accentColor: "#6d28d9", height: 4 }
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { style: {
        minWidth: 52,
        textAlign: "center",
        background: DS.accentBg,
        borderRadius: DS.r8,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 700,
        color: DS.accentText,
        border: `1px solid ${DS.accentBorder}`
      }, children: [
        safeNum,
        field.unit
      ] })
    ] })
  ] });
}
function SimpleEmojiField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const current = field.displayValue ? field.displayValue(rawValue) : rawValue;
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handlePick(emoji) {
    const cssVal = field.parseValue ? field.parseValue(emoji) : emoji;
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = cssVal;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: DS.sp8, flexWrap: "wrap" }, children: field.options.map((emoji) => /* @__PURE__ */ jsx(
      "button",
      {
        disabled,
        onClick: () => handlePick(emoji),
        style: {
          fontSize: 22,
          width: 46,
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: DS.r10,
          border: current === emoji ? "2.5px solid #7c3aed" : `1.5px solid ${DS.borderLight}`,
          background: current === emoji ? "#f5f3ff" : DS.bgCard,
          cursor: disabled ? "default" : "pointer",
          transform: current === emoji ? "scale(1.08)" : "scale(1)"
        },
        children: emoji
      },
      emoji
    )) })
  ] });
}
const PATHS = {
  // Widget mockup icons (mirrors storefront modules/icons.js)
  rewards: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" }),
    /* @__PURE__ */ jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
    /* @__PURE__ */ jsx("path", { d: "M16 10a4 4 0 0 1-8 0" })
  ] }),
  lightning: /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) }),
  referral: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "7", r: "4" }),
    /* @__PURE__ */ jsx("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
    /* @__PURE__ */ jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
  ] }),
  cart: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "21", r: "1" }),
    /* @__PURE__ */ jsx("circle", { cx: "20", cy: "21", r: "1" }),
    /* @__PURE__ */ jsx("path", { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" })
  ] }),
  star: /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }) }),
  chevronRight: /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("polyline", { points: "9 18 15 12 9 6" }) }),
  x: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
  ] }),
  alertCircle: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
    /* @__PURE__ */ jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
  ] }),
  // Launcher button icon picker options
  gift: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("polyline", { points: "20 12 20 22 4 22 4 12" }),
    /* @__PURE__ */ jsx("rect", { x: "2", y: "7", width: "20", height: "5" }),
    /* @__PURE__ */ jsx("line", { x1: "12", y1: "22", x2: "12", y2: "7" }),
    /* @__PURE__ */ jsx("path", { d: "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" }),
    /* @__PURE__ */ jsx("path", { d: "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" })
  ] }),
  trophy: /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("path", { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" }),
    /* @__PURE__ */ jsx("path", { d: "M7 5H4a2 2 0 0 0 0 4h3M17 5h3a2 2 0 0 1 0 4h-3" })
  ] }),
  gem: /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("path", { d: "m6 3 6 18 6-18M2 9h20M6 3 2 9l10 12L22 9l-4-6" }) })
};
function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.8 }) {
  const path = PATHS[name];
  if (!path) return null;
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: path
    }
  );
}
function SimpleIconField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const current = field.displayValue ? field.displayValue(rawValue) : rawValue;
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handlePick(iconName) {
    const cssVal = field.parseValue ? field.parseValue(iconName) : iconName;
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = cssVal;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: DS.sp8, flexWrap: "wrap" }, children: field.options.map((iconName) => /* @__PURE__ */ jsx(
      "button",
      {
        disabled,
        onClick: () => handlePick(iconName),
        "aria-label": iconName,
        style: {
          width: 46,
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: DS.r10,
          border: current === iconName ? "2.5px solid #7c3aed" : `1.5px solid ${DS.borderLight}`,
          background: current === iconName ? "#f5f3ff" : DS.bgCard,
          color: current === iconName ? "#7c3aed" : DS.textSub,
          cursor: disabled ? "default" : "pointer",
          transform: current === iconName ? "scale(1.08)" : "scale(1)",
          transition: "all 0.12s"
        },
        children: /* @__PURE__ */ jsx(Icon, { name: iconName, size: 20 })
      },
      iconName
    )) })
  ] });
}
function SimpleSelectField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handleChange(val) {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = val;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: DS.sp8 }, children: field.options.map((opt) => {
      const isActive = rawValue === opt.value;
      return /* @__PURE__ */ jsxs(
        "button",
        {
          disabled,
          onClick: () => handleChange(opt.value),
          style: {
            flex: 1,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: isActive ? 700 : 500,
            borderRadius: DS.r10,
            border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
            background: isActive ? "#f5f3ff" : DS.bgCard,
            color: isActive ? "#5b21b6" : DS.textSub,
            cursor: disabled ? "default" : "pointer",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: DS.sp6
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: {
              width: 14,
              height: 14,
              borderRadius: "50%",
              flexShrink: 0,
              border: `2px solid ${isActive ? "#7c3aed" : DS.borderMid}`,
              background: isActive ? "#7c3aed" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }, children: isActive && /* @__PURE__ */ jsx("span", { style: { width: 5, height: 5, borderRadius: "50%", background: "#fff" } }) }),
            opt.label
          ]
        },
        opt.value
      );
    }) })
  ] });
}
function SimpleTextField({ field, cssVars, onChange, disabled }) {
  const rawValue = cssVars[field.maps[0]] ?? field.default;
  const display = field.displayValue ? field.displayValue(rawValue) : rawValue;
  const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);
  function handleChange(val) {
    const cssVal = field.parseValue ? field.parseValue(val) : val;
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = cssVal;
    });
    onChange(updates);
  }
  function handleRevert() {
    const updates = {};
    field.maps.forEach((varName) => {
      updates[varName] = CSS_DEFAULTS[varName];
    });
    onChange(updates);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx(
      "s-text-field",
      {
        value: display,
        onInput: (e) => handleChange(e.target.value),
        disabled,
        "auto-complete": "off"
      }
    )
  ] });
}
function SimpleSectionPanel({ section, cssVars, onChange, disabled, notificationPreviewType, onNotificationPreviewChange }) {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp20 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 700, color: DS.text, lineHeight: 1.2, marginBottom: DS.sp6 }, children: section.label }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: DS.textMuted }, children: section.description }),
      section.key === "notifications" && onNotificationPreviewChange && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp8, marginTop: DS.sp10 }, children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: DS.textMuted, fontWeight: 500 }, children: "Preview:" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", background: "#ede9fe", borderRadius: DS.r8, padding: 3, gap: 2 }, children: [["reward", "Reward"], ["info", "Info"]].map(([val, label2]) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onNotificationPreviewChange(val),
            style: {
              padding: "5px 14px",
              borderRadius: DS.r6,
              border: "none",
              fontSize: 12,
              background: notificationPreviewType === val ? "#ffffff" : "transparent",
              color: notificationPreviewType === val ? DS.text : DS.textMuted,
              fontWeight: notificationPreviewType === val ? 600 : 400,
              cursor: "pointer",
              boxShadow: notificationPreviewType === val ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              whiteSpace: "nowrap"
            },
            children: label2
          },
          val
        )) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp10 }, children: section.fields.filter((field) => {
      if (section.key !== "notifications") return true;
      const commonKeys = ["notifyBgFrom", "notifyBgTo", "notifyColor"];
      if (commonKeys.includes(field.key)) return true;
      if (notificationPreviewType === "reward") return field.key.startsWith("notifyReward");
      if (notificationPreviewType === "info") return field.key.startsWith("notifyInfo");
      return true;
    }).map((field) => {
      if (field.type === "color") return /* @__PURE__ */ jsx(SimpleColorField, { field, cssVars, onChange, disabled }, field.key);
      if (field.type === "range") return /* @__PURE__ */ jsx(SimpleRangeField, { field, cssVars, onChange, disabled }, field.key);
      if (field.type === "emoji") return /* @__PURE__ */ jsx(SimpleEmojiField, { field, cssVars, onChange, disabled }, field.key);
      if (field.type === "icon") return /* @__PURE__ */ jsx(SimpleIconField, { field, cssVars, onChange, disabled }, field.key);
      if (field.type === "select") return /* @__PURE__ */ jsx(SimpleSelectField, { field, cssVars, onChange, disabled }, field.key);
      return /* @__PURE__ */ jsx(SimpleTextField, { field, cssVars, onChange, disabled }, field.key);
    }) })
  ] });
}
function CustomizeTab({
  activePreset,
  onPresetApply,
  activeSimpleSection,
  onSimpleSectionChange,
  simpleSectionDirtyCount,
  activeSimpleSectionDef,
  cssVars,
  onSimpleChange,
  notificationPreviewType,
  onNotificationPreviewChange,
  isNetworkSubmitting,
  onResetAll,
  onClearAll
}) {
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "280px 1fr 1fr", gap: "base", children: [
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("div", { style: { position: "sticky", top: 16 }, children: /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp14 }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          fontSize: 10,
          fontWeight: 700,
          color: DS.textHint,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: DS.sp10
        }, children: "Quick Themes" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp6 }, children: PRESETS.map((preset) => /* @__PURE__ */ jsx(
          PresetCard,
          {
            preset,
            isActive: activePreset === preset.key,
            onApply: onPresetApply,
            disabled: isNetworkSubmitting
          },
          preset.key
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { borderTop: `1px solid ${DS.borderLight}`, margin: `${DS.sp14} 0` } }),
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp10 }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          fontSize: 10,
          fontWeight: 700,
          color: DS.textHint,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: DS.sp8
        }, children: "Customize" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: SIMPLE_SECTIONS.map((section) => /* @__PURE__ */ jsx(
          SidebarNavItem,
          {
            label: section.label,
            isActive: activeSimpleSection === section.key,
            badge: simpleSectionDirtyCount(section),
            onClick: () => onSimpleSectionChange(section.key),
            disabled: isNetworkSubmitting
          },
          section.key
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { borderTop: `1px solid ${DS.borderLight}`, marginTop: DS.sp14, paddingTop: DS.sp12 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp6 }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            disabled: isNetworkSubmitting,
            onClick: onResetAll,
            style: {
              background: DS.dangerBg,
              border: `1px solid #fecaca`,
              borderRadius: DS.r8,
              padding: "7px 12px",
              fontSize: 12,
              color: DS.dangerText,
              cursor: isNetworkSubmitting ? "default" : "pointer",
              fontWeight: 500,
              width: "100%"
            },
            children: "Reset all to defaults"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            disabled: isNetworkSubmitting,
            onClick: onClearAll,
            style: {
              background: "none",
              border: `1px solid ${DS.borderLight}`,
              borderRadius: DS.r8,
              padding: "7px 12px",
              fontSize: 12,
              color: DS.textMuted,
              cursor: isNetworkSubmitting ? "default" : "pointer",
              fontWeight: 500,
              width: "100%"
            },
            children: "Clear (use CSS file)"
          }
        )
      ] }) })
    ] }) }) }),
    /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx(
      SimpleSectionPanel,
      {
        section: activeSimpleSectionDef,
        cssVars,
        onChange: onSimpleChange,
        disabled: isNetworkSubmitting,
        notificationPreviewType,
        onNotificationPreviewChange
      }
    ) })
  ] });
}
function getConfigValue(widgetConfig, configKey, fallback) {
  var _a2, _b;
  if (configKey.startsWith("labels.")) {
    return ((_a2 = widgetConfig.labels) == null ? void 0 : _a2[configKey.slice(7)]) ?? fallback;
  }
  if (configKey.startsWith("prize.")) {
    return ((_b = widgetConfig.prize) == null ? void 0 : _b[configKey.slice(6)]) ?? fallback;
  }
  return widgetConfig[configKey] ?? fallback;
}
function getConfigDefault(configKey) {
  var _a2, _b;
  if (configKey.startsWith("labels.")) {
    return (_a2 = WIDGET_CONFIG_DEFAULTS.labels) == null ? void 0 : _a2[configKey.slice(7)];
  }
  if (configKey.startsWith("prize.")) {
    return (_b = WIDGET_CONFIG_DEFAULTS.prize) == null ? void 0 : _b[configKey.slice(6)];
  }
  return WIDGET_CONFIG_DEFAULTS[configKey];
}
function ConfigToggleField({ field, widgetConfig, onChange, disabled }) {
  const value = getConfigValue(widgetConfig, field.configKey, field.default);
  const isDirty = value !== getConfigDefault(field.configKey);
  function handleRevert() {
    onChange(field.configKey, getConfigDefault(field.configKey));
  }
  return /* @__PURE__ */ jsx(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx(
      "button",
      {
        disabled,
        onClick: () => onChange(field.configKey, !value),
        style: {
          flexShrink: 0,
          width: 44,
          height: 24,
          borderRadius: DS.r99,
          background: value ? "#7c3aed" : DS.borderMid,
          border: "none",
          cursor: disabled ? "default" : "pointer",
          position: "relative",
          transition: "background 0.2s",
          marginLeft: DS.sp12
        },
        children: /* @__PURE__ */ jsx("span", { style: {
          position: "absolute",
          top: 3,
          left: value ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)"
        } })
      }
    )
  ] }) });
}
function ConfigSelectField({ field, widgetConfig, onChange, disabled }) {
  const value = getConfigValue(widgetConfig, field.configKey, field.default);
  const isDirty = value !== getConfigDefault(field.configKey);
  function handleRevert() {
    onChange(field.configKey, getConfigDefault(field.configKey));
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: DS.sp6, flexWrap: "wrap" }, children: field.options.map((opt) => {
      const isActive = value === opt.value;
      return /* @__PURE__ */ jsx(
        "button",
        {
          disabled,
          onClick: () => onChange(field.configKey, opt.value),
          style: {
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: isActive ? 700 : 500,
            borderRadius: DS.r10,
            border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
            background: isActive ? "#f5f3ff" : DS.bgCard,
            color: isActive ? "#5b21b6" : DS.textSub,
            cursor: disabled ? "default" : "pointer",
            transition: "all 0.15s"
          },
          children: opt.label
        },
        opt.value
      );
    }) })
  ] });
}
function ConfigRangeField({ field, widgetConfig, onChange, disabled }) {
  const raw = getConfigValue(widgetConfig, field.configKey, field.default);
  const display = field.displayValue ? field.displayValue(raw) : Number(raw);
  const isDirty = raw !== getConfigDefault(field.configKey);
  function handleChange(v) {
    onChange(field.configKey, field.parseValue ? field.parseValue(v) : v);
  }
  function handleRevert() {
    onChange(field.configKey, getConfigDefault(field.configKey));
  }
  const safeNum = isNaN(display) ? field.min : display;
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp12 }, children: [
      /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        "input",
        {
          type: "range",
          min: field.min,
          max: field.max,
          step: 1,
          value: safeNum,
          disabled,
          onChange: (e) => handleChange(parseInt(e.target.value)),
          style: { width: "100%", accentColor: "#6d28d9", height: 4 }
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { style: {
        minWidth: 52,
        textAlign: "center",
        background: DS.accentBg,
        borderRadius: DS.r8,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 700,
        color: DS.accentText,
        border: `1px solid ${DS.accentBorder}`
      }, children: [
        safeNum,
        field.unit
      ] })
    ] })
  ] });
}
function ConfigLabelField({ field, widgetConfig, onChange, disabled }) {
  var _a2;
  const labelKey = field.configKey.startsWith("labels.") ? field.configKey.slice(7) : field.configKey;
  const value = ((_a2 = widgetConfig.labels) == null ? void 0 : _a2[labelKey]) ?? field.default;
  const isDirty = value !== field.default;
  function handleRevert() {
    onChange(field.configKey, field.default);
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx(
      "s-text-field",
      {
        value,
        onInput: (e) => onChange(field.configKey, e.target.value),
        disabled,
        "auto-complete": "off",
        placeholder: field.default
      }
    )
  ] });
}
function ConfigTextField({ field, widgetConfig, onChange, disabled }) {
  const value = getConfigValue(widgetConfig, field.configKey, field.default);
  const isDirty = value !== getConfigDefault(field.configKey);
  function handleRevert() {
    onChange(field.configKey, getConfigDefault(field.configKey));
  }
  return /* @__PURE__ */ jsxs(FieldWrapper, { isDirty, onRevert: handleRevert, disabled, children: [
    /* @__PURE__ */ jsx(FieldLabel, { label: field.label, hint: field.hint, isDirty }),
    /* @__PURE__ */ jsx(
      "s-text-field",
      {
        value: value ?? "",
        onInput: (e) => onChange(field.configKey, e.target.value),
        disabled,
        "auto-complete": "off",
        placeholder: field.default ?? ""
      }
    )
  ] });
}
function ConfigSectionPanel({ section, widgetConfig, onChange, disabled }) {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp20 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 700, color: DS.text, lineHeight: 1.2, marginBottom: DS.sp6 }, children: section.label }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: DS.textMuted }, children: section.description })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp10 }, children: section.fields.map((field) => {
      if (field.type === "toggle") return /* @__PURE__ */ jsx(ConfigToggleField, { field, widgetConfig, onChange, disabled }, field.key);
      if (field.type === "select") return /* @__PURE__ */ jsx(ConfigSelectField, { field, widgetConfig, onChange, disabled }, field.key);
      if (field.type === "range") return /* @__PURE__ */ jsx(ConfigRangeField, { field, widgetConfig, onChange, disabled }, field.key);
      if (field.type === "label") return /* @__PURE__ */ jsx(ConfigLabelField, { field, widgetConfig, onChange, disabled }, field.key);
      if (field.type === "text") return /* @__PURE__ */ jsx(ConfigTextField, { field, widgetConfig, onChange, disabled }, field.key);
      return null;
    }) })
  ] });
}
const CONFIG_SECTIONS = WIDGET_CONFIG_SECTIONS.filter((s) => s.key !== "labels");
function ConfigTab({
  activeConfigSection,
  onConfigSectionChange,
  configSectionDirtyCount,
  widgetConfig,
  onConfigChange,
  onResetConfig,
  isNetworkSubmitting
}) {
  const activeSection = CONFIG_SECTIONS.find((s) => s.key === activeConfigSection) ?? CONFIG_SECTIONS[0];
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "280px 1fr 1fr", gap: "base", children: [
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("div", { style: { position: "sticky", top: 16 }, children: /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: DS.sp8 }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          fontSize: 10,
          fontWeight: 700,
          color: DS.textHint,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: DS.sp8
        }, children: "Config" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: CONFIG_SECTIONS.map((section) => /* @__PURE__ */ jsx(
          SidebarNavItem,
          {
            label: section.label,
            isActive: activeConfigSection === section.key,
            badge: configSectionDirtyCount(section),
            onClick: () => onConfigSectionChange(section.key),
            disabled: isNetworkSubmitting
          },
          section.key
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { borderTop: `1px solid ${DS.borderLight}`, marginTop: DS.sp14, paddingTop: DS.sp12 }, children: /* @__PURE__ */ jsx(
        "button",
        {
          disabled: isNetworkSubmitting,
          onClick: () => onResetConfig({ ...WIDGET_CONFIG_DEFAULTS }),
          style: {
            background: DS.dangerBg,
            border: `1px solid #fecaca`,
            borderRadius: DS.r8,
            padding: "7px 12px",
            fontSize: 12,
            color: DS.dangerText,
            cursor: isNetworkSubmitting ? "default" : "pointer",
            fontWeight: 500,
            width: "100%"
          },
          children: "Reset config to defaults"
        }
      ) })
    ] }) }) }),
    /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx(
      ConfigSectionPanel,
      {
        section: activeSection,
        widgetConfig,
        onChange: onConfigChange,
        disabled: isNetworkSubmitting
      }
    ) })
  ] });
}
const LABELS_SECTION = WIDGET_CONFIG_SECTIONS.find((s) => s.key === "labels");
function LabelsTab({ widgetConfig, onConfigChange, isNetworkSubmitting }) {
  if (!LABELS_SECTION) return null;
  const midpoint = Math.ceil(LABELS_SECTION.fields.length / 2);
  LABELS_SECTION.fields.slice(0, midpoint);
  LABELS_SECTION.fields.slice(midpoint);
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp10 }, children: LABELS_SECTION.fields.map((field) => /* @__PURE__ */ jsx(ConfigLabelField, { field, widgetConfig, onChange: onConfigChange, disabled: isNetworkSubmitting }, field.key)) }) }) }) });
}
function humanize(varName) {
  return varName.replace(/^--nbl-/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
const ALL_VAR_NAMES = Object.keys(CSS_DEFAULTS).sort();
function AdvancedRow({ varName, cssVars, onChange, disabled }) {
  const rawValue = cssVars[varName] ?? CSS_DEFAULTS[varName] ?? "";
  const isDirty = cssVars[varName] !== CSS_DEFAULTS[varName];
  const looksLikeColor = isHex(rawValue) || typeof rawValue === "string" && rawValue.startsWith("var(--nbl-");
  const swatchColor = isHex(rawValue) ? rawValue : "#cccccc";
  function handleChange(val) {
    onChange({ [varName]: val });
  }
  function handleRevert() {
    onChange({ [varName]: CSS_DEFAULTS[varName] });
  }
  return /* @__PURE__ */ jsxs("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: DS.sp10,
    padding: `${DS.sp10} ${DS.sp12}`,
    background: isDirty ? DS.warnBg : DS.bgCard,
    border: `1px solid ${isDirty ? DS.warnBorder : DS.borderLight}`,
    borderRadius: DS.r8
  }, children: [
    looksLikeColor ? /* @__PURE__ */ jsx("div", { style: { position: "relative", flexShrink: 0 }, children: /* @__PURE__ */ jsx("div", { style: {
      width: 28,
      height: 28,
      borderRadius: DS.r6,
      border: `1.5px solid ${isDirty ? DS.warnBorder : DS.borderMid}`,
      background: swatchColor,
      overflow: "hidden",
      cursor: disabled ? "default" : "pointer"
    }, children: !disabled && /* @__PURE__ */ jsx(
      "input",
      {
        type: "color",
        value: isHex(rawValue) ? rawValue : "#cccccc",
        onChange: (e) => handleChange(e.target.value),
        style: { opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }
      }
    ) }) }) : /* @__PURE__ */ jsx("div", { style: { width: 28, flexShrink: 0 } }),
    /* @__PURE__ */ jsxs("div", { style: { flex: "0 0 220px", minWidth: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, fontWeight: 600, color: DS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
        humanize(varName),
        isDirty && /* @__PURE__ */ jsx("span", { style: {
          marginLeft: 6,
          background: "#fef3c7",
          color: "#92400e",
          fontSize: 9,
          fontWeight: 600,
          padding: "1px 6px",
          borderRadius: DS.r99,
          border: "1px solid #fde68a"
        }, children: "Modified" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: DS.textHint, fontFamily: "monospace" }, children: varName })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ jsx(
      "s-text-field",
      {
        value: rawValue,
        onInput: (e) => handleChange(e.target.value),
        disabled,
        "auto-complete": "off",
        style: { fontFamily: "monospace" }
      }
    ) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        disabled: disabled || !isDirty,
        onClick: handleRevert,
        title: "Revert to default",
        style: {
          flexShrink: 0,
          background: "none",
          border: `1px solid ${isDirty ? DS.warnBorder : "transparent"}`,
          borderRadius: DS.r6,
          padding: "4px 8px",
          fontSize: 11,
          color: isDirty ? DS.warnText : DS.textHint,
          cursor: disabled || !isDirty ? "default" : "pointer",
          opacity: isDirty ? 1 : 0.4
        },
        children: "↩"
      }
    )
  ] });
}
function AdvancedTab({ cssVars, onSimpleChange, isNetworkSubmitting }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_VAR_NAMES;
    return ALL_VAR_NAMES.filter((v) => v.toLowerCase().includes(q) || humanize(v).toLowerCase().includes(q));
  }, [query]);
  const dirtyCount = useMemo(
    () => ALL_VAR_NAMES.filter((v) => cssVars[v] !== CSS_DEFAULTS[v]).length,
    [cssVars]
  );
  return /* @__PURE__ */ jsx("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("div", { style: { marginBottom: DS.sp14 }, children: /* @__PURE__ */ jsx("s-banner", { tone: "warning", heading: "Advance mode", children: /* @__PURE__ */ jsx("p", { children: "Advanced mode edits raw CSS variables directly — no grouping or guardrails. If you're not sure what a variable does, check the Customize tab first." }) }) }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: DS.sp10, marginBottom: DS.sp12 }, children: [
      /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        "s-text-field",
        {
          placeholder: "Search variables (e.g. 'button', '--nbl-item-bg')",
          value: query,
          onInput: (e) => setQuery(e.target.value),
          "auto-complete": "off"
        }
      ) }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, color: DS.textMuted, flexShrink: 0 }, children: [
        filtered.length,
        " of ",
        ALL_VAR_NAMES.length,
        dirtyCount > 0 && ` · ${dirtyCount} modified`
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: DS.sp6, maxHeight: 640, overflowY: "auto" }, children: [
      filtered.length === 0 && /* @__PURE__ */ jsxs("div", { style: { padding: DS.sp16, textAlign: "center", fontSize: 13, color: DS.textHint }, children: [
        'No variables match "',
        query,
        '".'
      ] }),
      filtered.map((varName) => /* @__PURE__ */ jsx(
        AdvancedRow,
        {
          varName,
          cssVars,
          onChange: onSimpleChange,
          disabled: isNetworkSubmitting
        },
        varName
      ))
    ] })
  ] }) });
}
const loader$g = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  return loadCustomizeData(session.shop);
};
const action$n = async ({
  request
}) => {
  const {
    session,
    admin
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const ctx = {
    formData,
    session,
    admin
  };
  switch (intent) {
    case "update":
      return handleUpdate(ctx);
    case "resetAll":
      return handleResetAll(ctx);
    case "clearAll":
      return handleClearAll(ctx);
    default:
      return {
        ok: false,
        message: "Unknown intent."
      };
  }
};
const route$9 = UNSAFE_withComponentProps(function CustomizeNew() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = useCustomizePage(loaderData, actionData);
  const previewScene = page.pageTab === "customize" && page.activeSimpleSection === "notifications" ? page.notificationPreviewType === "reward" ? "notification-reward" : "notification-info" : page.pageTab === "customize" ? SECTION_TO_SCENE[page.activeSimpleSection] ?? "home" : "home";
  return /* @__PURE__ */ jsxs("s-page", {
    inlineSize: "large",
    children: [/* @__PURE__ */ jsx(PageHeader$2, {
      hasChanges: page.hasChanges,
      isFirstSave: page.isFirstSave,
      totalDirtyVarCount: page.totalDirtyVarCount,
      isNetworkSubmitting: page.isNetworkSubmitting,
      isUpdating: page.isUpdating,
      activeIntent: page.activeIntent,
      pageTab: page.pageTab,
      onTabChange: page.setPageTab,
      onDiscard: page.handleDiscard,
      onResetAll: page.handleResetAll,
      onSave: page.handleSave
    }), /* @__PURE__ */ jsx(LivePreviewPanel, {
      cssVars: page.deferredCssVars,
      widgetConfig: page.widgetConfig,
      hidden: page.pageTab === "config",
      previewScene
    }), page.pageTab === "customize" && /* @__PURE__ */ jsx(CustomizeTab, {
      activePreset: page.activePreset,
      onPresetApply: page.handlePresetApply,
      activeSimpleSection: page.activeSimpleSection,
      onSimpleSectionChange: page.setActiveSimpleSection,
      simpleSectionDirtyCount: page.simpleSectionDirtyCount,
      activeSimpleSectionDef: page.activeSimpleSectionDef,
      cssVars: page.cssVars,
      onSimpleChange: page.handleSimpleChange,
      notificationPreviewType: page.notificationPreviewType,
      onNotificationPreviewChange: page.setNotificationPreviewType,
      isNetworkSubmitting: page.isNetworkSubmitting,
      onResetAll: page.handleResetAll,
      onClearAll: page.handleClearAll
    }), page.pageTab === "config" && /* @__PURE__ */ jsx(ConfigTab, {
      activeConfigSection: page.activeConfigSection,
      onConfigSectionChange: page.setActiveConfigSection,
      configSectionDirtyCount: page.configSectionDirtyCount,
      widgetConfig: page.widgetConfig,
      onConfigChange: page.handleConfigChange,
      onResetConfig: page.setWidgetConfig,
      isNetworkSubmitting: page.isNetworkSubmitting
    }), page.pageTab === "labels" && /* @__PURE__ */ jsx(LabelsTab, {
      widgetConfig: page.widgetConfig,
      onConfigChange: page.handleConfigChange,
      isNetworkSubmitting: page.isNetworkSubmitting
    }), page.pageTab === "advanced" && /* @__PURE__ */ jsx(AdvancedTab, {
      cssVars: page.cssVars,
      onSimpleChange: page.handleSimpleChange,
      isNetworkSubmitting: page.isNetworkSubmitting
    }), /* @__PURE__ */ jsx(SaveBar, {
      visible: page.hasChanges,
      position: "bottom-center",
      message: page.totalDirtyVarCount > 0 ? `${page.totalDirtyVarCount} unsaved change${page.totalDirtyVarCount !== 1 ? "s" : ""}` : "Unsaved changes",
      primaryLabel: page.isUpdating ? "Saving…" : "Save changes",
      secondaryLabel: "Discard",
      onPrimary: page.handleSave,
      onSecondary: page.handleDiscard,
      loading: page.isUpdating,
      disabled: page.isNetworkSubmitting
    })]
  });
});
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$n,
  default: route$9,
  loader: loader$g
}, Symbol.toStringTag, { value: "Module" }));
const EVENT_ROUTES = {
  ORDER: "/app/points-rules/order",
  REFERRAL: "/app/points-rules/referral",
  REVIEW: "/app/points-rules/review"
};
const PER_PAGE$3 = 10;
const getPointsSummary = (r) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const c = r.conditions;
  const type = (_b = (_a2 = r.event) == null ? void 0 : _a2.type) == null ? void 0 : _b.toUpperCase();
  if (!c) return "—";
  if (type === "ORDER") {
    const ord = c.order;
    if (!ord) return "—";
    if (ord.type === "incremental") {
      return `${((_c = ord.rate) == null ? void 0 : _c.points) ?? 0} pt for every $${((_d = ord.rate) == null ? void 0 : _d.amount) ?? 0} spent`;
    }
    return `${ord.fixedPoints ?? 0} pts flat per order`;
  }
  if (type === "REFERRAL") {
    const ref = c.referral;
    if (!ref) return "—";
    const referrerPts = ((_e = ref.referrer) == null ? void 0 : _e.points) ?? 0;
    const friendPts = ((_f = ref.referred) == null ? void 0 : _f.points) ?? 0;
    const friendDiscount = ((_g = ref.referred) == null ? void 0 : _g.discountValue) ? ref.referred.discountType === "percentage" ? `${ref.referred.discountValue}% off` : `$${ref.referred.discountValue} off` : null;
    const friendParts = [
      friendPts ? `${friendPts} pts` : null,
      friendDiscount
    ].filter(Boolean);
    const parts = [
      `Referrer: ${referrerPts} pts`,
      friendParts.length ? `Friend: ${friendParts.join(" + ")}` : null
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }
  if (type === "REVIEW") {
    const rev = c.review;
    if (!rev) return "—";
    const parts = [
      ((_h = rev.text) == null ? void 0 : _h.isActive) ? `Text: ${rev.text.points}` : null,
      ((_i = rev.image) == null ? void 0 : _i.isActive) ? `Photo: ${rev.image.points}` : null,
      ((_j = rev.video) == null ? void 0 : _j.isActive) ? `Video: ${rev.video.points}` : null
    ].filter(Boolean);
    return parts.length ? `${parts.join(" · ")} pts` : "—";
  }
  return "—";
};
const TRIGGER_SHORT = {
  oneTime: "One-time orders",
  subscription: "Subscriptions only",
  both: "All orders"
};
const REVIEW_MODE_SHORT = {
  once: "Once per product",
  per_type: "Once per review type",
  unlimited: "Every submission"
};
const getAppliestoSummary = (r) => {
  var _a2, _b, _c, _d, _e;
  const type = (_b = (_a2 = r.event) == null ? void 0 : _a2.type) == null ? void 0 : _b.toUpperCase();
  const c = r.conditions;
  if (!c) return "—";
  if (type === "ORDER") {
    const ord = c.order;
    if (!ord) return "—";
    const groupCount = ((_c = ord.groups) == null ? void 0 : _c.length) ?? 0;
    const excludedCount = ((_d = ord.excludedProducts) == null ? void 0 : _d.length) ?? 0;
    const parts = [TRIGGER_SHORT[ord.trigger] ?? "All orders"];
    if (groupCount > 0) parts.push(`${groupCount} group${groupCount !== 1 ? "s" : ""}`);
    if (excludedCount > 0) parts.push(`${excludedCount} excluded`);
    if (groupCount === 0 && excludedCount === 0) parts.push("all products");
    return parts.join(", ");
  }
  if (type === "REFERRAL") {
    const ref = c.referral;
    if (!ref) return "—";
    const groupCount = ((_e = ref.groups) == null ? void 0 : _e.length) ?? 0;
    const parts = [TRIGGER_SHORT[ref.trigger] ?? "All orders"];
    if (groupCount > 0) parts.push(`${groupCount} product group${groupCount !== 1 ? "s" : ""}`);
    return parts.join(", ");
  }
  if (type === "REVIEW") {
    const rev = c.review;
    if (!rev) return "—";
    return REVIEW_MODE_SHORT[rev.rewardMode] ?? "—";
  }
  return "—";
};
function usePointsRulesIndexPage(loaderData, actionData) {
  var _a2;
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const rules = (loaderData == null ? void 0 : loaderData.rules) ?? [];
  const events = (loaderData == null ? void 0 : loaderData.events) ?? [];
  const isDeleting = navigation.state === "submitting" && ((_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType")) === "deleteRule";
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rules.length / PER_PAGE$3));
  const paginatedRules = rules.slice((currentPage - 1) * PER_PAGE$3, currentPage * PER_PAGE$3);
  const existingEventIds = useMemo(() => rules.map((r) => r.eventId), [rules]);
  useEffect(() => {
    setCurrentPage(1);
  }, [rules.length]);
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
    if (actionData.status === "success" && actionData.submitType === "deleteRule") {
      setDeleteTarget(null);
    }
  }, [actionData, shopify2]);
  const handleDelete2 = useCallback(() => {
    if (!deleteTarget) return;
    submit({ submitType: "deleteRule", ruleId: deleteTarget.id }, { method: "post" });
  }, [deleteTarget, submit]);
  const handleAddRuleNext = useCallback(() => {
    var _a3;
    if (!selectedEventId) return;
    const event = events.find((e) => e.id === parseInt(selectedEventId));
    if (!event) return;
    const route35 = EVENT_ROUTES[(_a3 = event.type) == null ? void 0 : _a3.toUpperCase()];
    if (!route35) return;
    navigate(route35);
  }, [selectedEventId, events, navigate]);
  const handleEditRule = useCallback((r) => {
    var _a3, _b;
    const route35 = EVENT_ROUTES[(_b = (_a3 = r.event) == null ? void 0 : _a3.type) == null ? void 0 : _b.toUpperCase()];
    if (!route35) return;
    navigate(`${route35}?ruleId=${r.id}`);
  }, [navigate]);
  const getEventName = useCallback(
    (eventId) => {
      var _a3;
      return ((_a3 = events.find((e) => e.id === parseInt(eventId))) == null ? void 0 : _a3.name) ?? "—";
    },
    [events]
  );
  return {
    rules,
    events,
    isDeleting,
    deleteTarget,
    setDeleteTarget,
    selectedEventId,
    setSelectedEventId,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedRules,
    existingEventIds,
    handleDelete: handleDelete2,
    handleAddRuleNext,
    handleEditRule,
    getEventName
  };
}
async function handleDeleteRule$1({ formData, session, admin }) {
  const submitType = "deleteRule";
  const ruleId = parseInt(formData.get("ruleId"));
  if (!ruleId)
    return { message: "Rule ID is required.", status: "error", submitType };
  try {
    const rule = await prisma.pointsRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.sessionId !== session.id)
      return { message: "Rule not found or access denied.", status: "error", submitType };
    await prisma.pointsRule.delete({ where: { id: ruleId } });
    const { default: syncAppConfig2 } = await Promise.resolve().then(() => syncAppConfig$1);
    await syncAppConfig2(admin, session);
    return { message: "Points rule deleted successfully.", status: "success", submitType };
  } catch (err) {
    console.error("Delete Rule Error:", err);
    return { message: err.message || "Failed to delete rule.", status: "error", submitType };
  }
}
function PageHeader$1() {
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
    /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "extra-small", children: [
      /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: "Points Rules" }),
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Manage how customers earn points for each event." })
    ] }),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        variant: "primary",
        commandFor: "event-selector-modal",
        command: "--show",
        children: "Add New Rule"
      }
    )
  ] }) });
}
function RulesTable$1({
  paginatedRules,
  isDeleting,
  currentPage,
  totalPages,
  setCurrentPage,
  getEventName,
  onEdit,
  onDeleteClick
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Rule Name" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Event" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Earning" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Scope" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Active" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: paginatedRules.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "6", style: { textAlign: "center", padding: "3rem" }, children: 'No rules yet. Click "Add New Rule" to get started.' }) }) : paginatedRules.map((r) => {
        var _a2;
        return /* @__PURE__ */ jsxs("s-table-row", { children: [
          /* @__PURE__ */ jsx("s-table-cell", { children: r.name || getEventName(r.eventId) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-badge", { children: ((_a2 = r.event) == null ? void 0 : _a2.type) || "—" }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-text", { children: getPointsSummary(r) }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: getAppliestoSummary(r) }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: r.isActive ? "✅ Yes" : "❌ No" }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", children: [
            /* @__PURE__ */ jsx(
              "s-button",
              {
                variant: "text",
                size: "small",
                icon: "edit",
                disabled: isDeleting,
                onClick: () => onEdit(r)
              }
            ),
            /* @__PURE__ */ jsx(
              "s-button",
              {
                variant: "text",
                size: "small",
                icon: "delete",
                destructive: true,
                disabled: isDeleting,
                onClick: () => onDeleteClick(r),
                commandFor: "delete-modal",
                command: "--show"
              }
            )
          ] }) })
        ] }, r.id);
      }) })
    ] }),
    totalPages > 1 && /* @__PURE__ */ jsxs(
      "s-stack",
      {
        direction: "inline",
        justifyContent: "center",
        gap: "small",
        style: { marginBlockStart: "1rem" },
        children: [
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "plain",
              disabled: currentPage === 1 || isDeleting,
              onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
              children: "← Prev"
            }
          ),
          /* @__PURE__ */ jsxs("s-text", { children: [
            "Page ",
            currentPage,
            " of ",
            totalPages
          ] }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "plain",
              disabled: currentPage === totalPages || isDeleting,
              onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
              children: "Next →"
            }
          )
        ]
      }
    )
  ] });
}
function EventSelectorModal({
  events,
  existingEventIds,
  selectedEventId,
  setSelectedEventId,
  onNext
}) {
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      id: "event-selector-modal",
      heading: "Select Event Type",
      size: "small",
      children: [
        /* @__PURE__ */ jsx("s-paragraph", { children: "Choose the event you want to create a points rule for." }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsxs(
          "s-select",
          {
            label: "Points Event",
            value: selectedEventId,
            onChange: (e) => setSelectedEventId(e.target.value),
            children: [
              /* @__PURE__ */ jsx("s-option", { value: "", children: "Select an event" }),
              events.map((ev) => {
                const taken = existingEventIds.includes(ev.id);
                return /* @__PURE__ */ jsxs(
                  "s-option",
                  {
                    value: ev.id,
                    disabled: taken,
                    children: [
                      ev.name,
                      " (",
                      ev.type,
                      ")",
                      taken ? " — Already Added" : ""
                    ]
                  },
                  ev.id
                );
              })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "secondary-actions",
            commandFor: "event-selector-modal",
            command: "--hide",
            onClick: () => setSelectedEventId(""),
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "primary-action",
            variant: "primary",
            disabled: !selectedEventId,
            commandFor: "event-selector-modal",
            command: "--hide",
            onClick: onNext,
            children: "Next"
          }
        )
      ]
    }
  );
}
function DeleteRuleModal$1({
  deleteTarget,
  setDeleteTarget,
  isDeleting,
  getEventName,
  onConfirm
}) {
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      id: "delete-modal",
      heading: "Delete Points Rule",
      size: "small",
      children: [
        deleteTarget && /* @__PURE__ */ jsxs("s-paragraph", { tone: "subdued", children: [
          "Are you sure you want to delete",
          " ",
          /* @__PURE__ */ jsx("strong", { children: deleteTarget.name || getEventName(deleteTarget.eventId) }),
          "? This action cannot be undone."
        ] }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "secondary-actions",
            commandFor: "delete-modal",
            command: "--hide",
            disabled: isDeleting,
            onClick: () => setDeleteTarget(null),
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "primary-action",
            variant: "primary",
            destructive: true,
            loading: isDeleting,
            disabled: isDeleting || !deleteTarget,
            onClick: onConfirm,
            commandFor: "delete-modal",
            command: "--hide",
            children: "Yes, Delete"
          }
        )
      ]
    }
  );
}
const loader$f = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const [rules, events] = await Promise.all([prisma.pointsRule.findMany({
    where: {
      sessionId: session.id
    },
    include: {
      event: true
    },
    orderBy: [{
      priority: "asc"
    }, {
      createdAt: "desc"
    }]
  }), prisma.event.findMany({
    where: {
      sessionId: session.id,
      isActive: true
    },
    orderBy: {
      name: "asc"
    }
  })]);
  return {
    rules,
    events
  };
};
const action$m = async ({
  request
}) => {
  const {
    session,
    admin
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  switch (submitType) {
    case "deleteRule":
      return handleDeleteRule$1({
        formData,
        session,
        admin
      });
    default:
      return {
        message: "Invalid action.",
        status: "error",
        submitType
      };
  }
};
const route$8 = UNSAFE_withComponentProps(function PointsRulesIndexPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = usePointsRulesIndexPage(loaderData, actionData);
  return /* @__PURE__ */ jsxs("s-page", {
    inlineSize: "base",
    children: [/* @__PURE__ */ jsx(PageHeader$1, {}), /* @__PURE__ */ jsx(RulesTable$1, {
      paginatedRules: page.paginatedRules,
      isDeleting: page.isDeleting,
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      setCurrentPage: page.setCurrentPage,
      getEventName: page.getEventName,
      onEdit: page.handleEditRule,
      onDeleteClick: page.setDeleteTarget
    }), /* @__PURE__ */ jsx(EventSelectorModal, {
      events: page.events,
      existingEventIds: page.existingEventIds,
      selectedEventId: page.selectedEventId,
      setSelectedEventId: page.setSelectedEventId,
      onNext: page.handleAddRuleNext
    }), /* @__PURE__ */ jsx(DeleteRuleModal$1, {
      deleteTarget: page.deleteTarget,
      setDeleteTarget: page.setDeleteTarget,
      isDeleting: page.isDeleting,
      getEventName: page.getEventName,
      onConfirm: page.handleDelete
    })]
  });
});
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$m,
  default: route$8,
  loader: loader$f
}, Symbol.toStringTag, { value: "Module" }));
const str = (v) => v ?? "";
const bool = (v) => v ?? false;
const num = (v) => v == null ? "" : String(v);
const arr = (v, fallback = []) => Array.isArray(v) && v.length > 0 ? v : fallback;
function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== typeof b) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof File || b instanceof File) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  return false;
}
function parsePath(path) {
  if (Array.isArray(path)) return path;
  if (path == null || path === "") return [];
  return String(path).split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
}
function getAt(obj, path) {
  const segments = parsePath(path);
  let current = obj;
  for (const segment of segments) {
    if (current == null) return void 0;
    current = current[segment];
  }
  return current;
}
function setAt(obj, path, value) {
  const segments = parsePath(path);
  if (segments.length === 0) return value;
  const root2 = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = root2;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const nextKey = segments[i + 1];
    const child = current[key];
    const cloned = child == null ? typeof nextKey === "number" ? [] : {} : Array.isArray(child) ? [...child] : { ...child };
    current[key] = cloned;
    current = cloned;
  }
  current[segments[segments.length - 1]] = value;
  return root2;
}
function deleteAt(obj, path) {
  const segments = parsePath(path);
  if (segments.length === 0) return obj;
  const root2 = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = root2;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const child = current[key];
    if (child == null) return root2;
    const cloned = Array.isArray(child) ? [...child] : { ...child };
    current[key] = cloned;
    current = cloned;
  }
  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(current)) current.splice(Number(lastSegment), 1);
  else delete current[lastSegment];
  return root2;
}
function updateArrayAt(obj, path, transform) {
  const segments = parsePath(path);
  if (segments.length === 0) {
    if (!Array.isArray(obj)) throw new Error("useFormState: updateArrayAt — root is not an array");
    const next = [...obj];
    transform(next);
    return next;
  }
  const currentArray = getAt(obj, segments);
  if (!Array.isArray(currentArray)) {
    throw new Error(`useFormState: updateArrayAt — value at "${segments.join(".")}" is not an array`);
  }
  const nextArray = [...currentArray];
  transform(nextArray);
  return setAt(obj, segments, nextArray);
}
function toPathKey(path) {
  return Array.isArray(path) ? path.join(".") : String(path);
}
function useFormState(serverData, buildFormShape2, options = {}) {
  const {
    validate: validate2,
    schema,
    validateOnChange = false,
    onSubmit,
    syncOnServerDataChange = true
  } = options;
  const buildFormShapeRef = useRef(buildFormShape2);
  const validateRef = useRef(validate2);
  const schemaRef = useRef(schema);
  const onSubmitRef = useRef(onSubmit);
  buildFormShapeRef.current = buildFormShape2;
  validateRef.current = validate2;
  schemaRef.current = schema;
  onSubmitRef.current = onSubmit;
  const [form2, setForm] = useState(() => buildFormShape2(serverData));
  const [savedSnapshot, setSavedSnapshot] = useState(() => buildFormShape2(serverData));
  const [pendingFiles, setPendingFiles] = useState({});
  const [removedMediaKeys, setRemovedMediaKeys] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttemptCount, setSubmitAttemptCount] = useState(0);
  const [hasRunValidation, setHasRunValidation] = useState(false);
  const latestFormRef = useRef(form2);
  latestFormRef.current = form2;
  const prevServerDataRef = useRef(serverData);
  useEffect(() => {
    if (!syncOnServerDataChange) return;
    if (serverData === prevServerDataRef.current) return;
    prevServerDataRef.current = serverData;
    const freshShape = buildFormShapeRef.current(serverData);
    setForm(freshShape);
    setSavedSnapshot(freshShape);
    setPendingFiles({});
    setRemovedMediaKeys({});
    setFieldErrors({});
    setTouchedFields({});
    setSubmitAttemptCount(0);
    setHasRunValidation(false);
  }, [serverData, syncOnServerDataChange]);
  const runValidationPure = useCallback((formValue) => {
    let collectedErrors = {};
    const activeSchema = schemaRef.current;
    const validateFn = validateRef.current;
    if (activeSchema == null ? void 0 : activeSchema.safeParse) {
      const result = activeSchema.safeParse(formValue);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path.join(".");
          if (!collectedErrors[key]) collectedErrors[key] = issue.message;
        }
      }
    }
    if (typeof validateFn === "function") {
      const manualErrors = validateFn(formValue) || {};
      collectedErrors = { ...collectedErrors, ...manualErrors };
    }
    return collectedErrors;
  }, []);
  useEffect(() => {
    if (!validateOnChange) return;
    const errors = runValidationPure(form2);
    setFieldErrors(errors);
    setHasRunValidation(true);
  }, [form2, validateOnChange, runValidationPure]);
  const validateNow = useCallback(() => {
    const errors = runValidationPure(latestFormRef.current);
    setFieldErrors(errors);
    setHasRunValidation(true);
    return Object.keys(errors).length === 0;
  }, [runValidationPure]);
  const applyFormUpdate = useCallback((updater) => {
    setForm((prev) => typeof updater === "function" ? updater(prev) : updater);
  }, []);
  const isDirty = useMemo(() => {
    if (Object.values(pendingFiles).some((fileList) => (fileList == null ? void 0 : fileList.length) > 0)) return true;
    if (Object.values(removedMediaKeys).some(Boolean)) return true;
    return !deepEqual(form2, savedSnapshot);
  }, [form2, savedSnapshot, pendingFiles, removedMediaKeys]);
  const isValid = useMemo(
    () => hasRunValidation && Object.keys(fieldErrors).length === 0,
    [hasRunValidation, fieldErrors]
  );
  const dirtyFields = useMemo(() => {
    const result = {};
    function walkDiff(currentValue, snapshotValue, prefix) {
      if (currentValue == null || typeof currentValue !== "object" || currentValue instanceof Date || currentValue instanceof File) {
        if (!deepEqual(currentValue, snapshotValue)) result[prefix] = true;
        return;
      }
      for (const key of Object.keys(currentValue)) {
        const childPath = prefix ? `${prefix}.${key}` : key;
        walkDiff(currentValue[key], snapshotValue == null ? void 0 : snapshotValue[key], childPath);
      }
    }
    walkDiff(form2, savedSnapshot, "");
    return result;
  }, [form2, savedSnapshot]);
  const set = useCallback((path, value) => {
    applyFormUpdate((prev) => setAt(prev, path, value));
  }, [applyFormUpdate]);
  const setMany = useCallback((pairs) => {
    applyFormUpdate((prev) => {
      let next = prev;
      for (const [path, value] of pairs) {
        next = setAt(next, path, value);
      }
      return next;
    });
  }, [applyFormUpdate]);
  const get = useCallback((path) => getAt(latestFormRef.current, path), []);
  const getSnapshotValue = useCallback((path) => {
    return path ? getAt(savedSnapshotRef.current, path) : savedSnapshotRef.current;
  }, []);
  const removeField = useCallback((path) => {
    applyFormUpdate((prev) => deleteAt(prev, path));
  }, [applyFormUpdate]);
  const merge = useCallback((patch, path) => {
    applyFormUpdate((prev) => {
      const segments = parsePath(path);
      if (segments.length === 0) return { ...prev, ...patch };
      const current = getAt(prev, segments) || {};
      return setAt(prev, segments, { ...current, ...patch });
    });
  }, [applyFormUpdate]);
  const setObjectKey = useCallback((parentPath, key, value) => {
    const segments = parsePath(parentPath);
    applyFormUpdate((prev) => setAt(prev, [...segments, key], value));
  }, [applyFormUpdate]);
  const deleteObjectKey = useCallback((parentPath, key) => {
    const segments = parsePath(parentPath);
    applyFormUpdate((prev) => deleteAt(prev, [...segments, key]));
  }, [applyFormUpdate]);
  const addItem = useCallback((listPath, item) => {
    const safeItem = item != null && typeof item === "object" ? deepClone(item) : item;
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => list2.push(safeItem)));
  }, [applyFormUpdate]);
  const insertItem = useCallback((listPath, index2, item) => {
    const safeItem = item != null && typeof item === "object" ? deepClone(item) : item;
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => list2.splice(index2, 0, safeItem)));
  }, [applyFormUpdate]);
  const removeItem = useCallback((listPath, index2) => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => list2.splice(index2, 1)));
  }, [applyFormUpdate]);
  const updateItem = useCallback((listPath, index2, fieldName, value) => {
    const segments = parsePath(listPath);
    applyFormUpdate((prev) => setAt(prev, [...segments, index2, fieldName], value));
  }, [applyFormUpdate]);
  const replaceItem = useCallback((listPath, index2, item) => {
    const segments = parsePath(listPath);
    applyFormUpdate((prev) => setAt(prev, [...segments, index2], item));
  }, [applyFormUpdate]);
  const moveItem = useCallback((listPath, fromIndex, toIndex) => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => {
      const [item] = list2.splice(fromIndex, 1);
      list2.splice(toIndex, 0, item);
    }));
  }, [applyFormUpdate]);
  const swapItems = useCallback((listPath, indexA, indexB) => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => {
      [list2[indexA], list2[indexB]] = [list2[indexB], list2[indexA]];
    }));
  }, [applyFormUpdate]);
  const duplicateItem = useCallback((listPath, index2) => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => {
      list2.splice(index2 + 1, 0, deepClone(list2[index2]));
    }));
  }, [applyFormUpdate]);
  const setList = useCallback((listPath, items) => {
    applyFormUpdate((prev) => setAt(prev, listPath, items));
  }, [applyFormUpdate]);
  const clearList = useCallback((listPath) => {
    applyFormUpdate((prev) => setAt(prev, listPath, []));
  }, [applyFormUpdate]);
  const sortList = useCallback((listPath, sortKey = null, direction = "asc") => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => {
      list2.sort((a, b) => {
        const av = sortKey != null ? a == null ? void 0 : a[sortKey] : a;
        const bv = sortKey != null ? b == null ? void 0 : b[sortKey] : b;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        let comparison = 0;
        if (typeof av === "number" && typeof bv === "number") {
          comparison = av - bv;
        } else if (typeof av === "boolean" && typeof bv === "boolean") {
          comparison = av === bv ? 0 : av ? 1 : -1;
        } else {
          const dateA = new Date(av);
          const dateB = new Date(bv);
          if (!isNaN(dateA) && !isNaN(dateB) && typeof av === "string" && typeof bv === "string") {
            comparison = dateA.getTime() - dateB.getTime();
          } else {
            comparison = String(av).localeCompare(String(bv), void 0, { sensitivity: "base" });
          }
        }
        return direction === "desc" ? -comparison : comparison;
      });
    }));
  }, [applyFormUpdate]);
  const reorderList = moveItem;
  const normalizeSortOrder = useCallback((listPath, orderFieldName, { startAt = 0 } = {}) => {
    applyFormUpdate((prev) => updateArrayAt(prev, listPath, (list2) => {
      list2.forEach((item, index2) => {
        if (item && typeof item === "object") {
          item[orderFieldName] = startAt + index2;
        }
      });
    }));
  }, [applyFormUpdate]);
  const fileSetterFor = useCallback((slotName) => (fileList) => {
    setPendingFiles((prev) => ({ ...prev, [slotName]: fileList }));
  }, []);
  const clearPendingFilesFor = useCallback((slotName) => {
    setPendingFiles((prev) => ({ ...prev, [slotName]: [] }));
  }, []);
  const removeMedia = useCallback((urlFieldPath) => {
    const key = toPathKey(urlFieldPath);
    applyFormUpdate((prev) => setAt(prev, urlFieldPath, ""));
    setRemovedMediaKeys((prev) => ({ ...prev, [key]: true }));
  }, [applyFormUpdate]);
  const undoRemoveMedia = useCallback((urlFieldPath) => {
    const key = toPathKey(urlFieldPath);
    const restoredUrl = getAt(savedSnapshotRef.current, urlFieldPath) ?? "";
    applyFormUpdate((prev) => setAt(prev, urlFieldPath, restoredUrl));
    setRemovedMediaKeys((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, [applyFormUpdate]);
  const touchField = useCallback((path) => {
    const key = toPathKey(path);
    setTouchedFields((prev) => prev[key] ? prev : { ...prev, [key]: true });
  }, []);
  const untouchField = useCallback((path) => {
    const key = toPathKey(path);
    setTouchedFields((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);
  const touchAllFields = useCallback(() => {
    const allTouched = {};
    function walkLeaves(node, prefix) {
      if (node == null || typeof node !== "object" || node instanceof Date || node instanceof File) {
        if (prefix) allTouched[prefix] = true;
        return;
      }
      if (Array.isArray(node)) {
        if (node.length === 0 && prefix) allTouched[prefix] = true;
        node.forEach((item, i) => walkLeaves(item, prefix ? `${prefix}.${i}` : String(i)));
        return;
      }
      const keys = Object.keys(node);
      if (keys.length === 0 && prefix) allTouched[prefix] = true;
      for (const k of keys) walkLeaves(node[k], prefix ? `${prefix}.${k}` : k);
    }
    walkLeaves(latestFormRef.current, "");
    setTouchedFields(allTouched);
  }, []);
  const isFieldTouched = useCallback((path) => !!touchedFields[toPathKey(path)], [touchedFields]);
  const setFieldError = useCallback((path, message) => {
    setFieldErrors((prev) => ({ ...prev, [toPathKey(path)]: message }));
  }, []);
  const clearFieldError = useCallback((path) => {
    const key = toPathKey(path);
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);
  const clearAllErrors = useCallback(() => setFieldErrors({}), []);
  const errorFor = useCallback((path) => {
    const key = toPathKey(path);
    if (!fieldErrors[key]) return null;
    if (submitAttemptCount > 0 || touchedFields[key]) return fieldErrors[key];
    return null;
  }, [fieldErrors, touchedFields, submitAttemptCount]);
  const isDirtyAt = useCallback((path) => {
    return !deepEqual(
      getAt(latestFormRef.current, path),
      getAt(savedSnapshotRef.current, path)
    );
  }, []);
  const submit = useCallback(async () => {
    setSubmitAttemptCount((c) => c + 1);
    const currentForm = latestFormRef.current;
    const errors = runValidationPure(currentForm);
    setFieldErrors(errors);
    setHasRunValidation(true);
    if (Object.keys(errors).length > 0) {
      touchAllFields();
      return false;
    }
    const submitHandler = onSubmitRef.current;
    if (!submitHandler) return true;
    try {
      setIsSubmitting(true);
      await submitHandler(currentForm, { pendingFiles, removedMediaKeys });
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingFiles, removedMediaKeys, runValidationPure, touchAllFields]);
  const reset = useCallback(() => {
    setForm(savedSnapshotRef.current);
    setPendingFiles({});
    setRemovedMediaKeys({});
    setFieldErrors({});
    setTouchedFields({});
    setSubmitAttemptCount(0);
    setHasRunValidation(false);
  }, []);
  const syncAfterSave = useCallback((freshServerData) => {
    const freshShape = buildFormShapeRef.current(freshServerData);
    setSavedSnapshot(freshShape);
    setForm(freshShape);
    setPendingFiles({});
    setRemovedMediaKeys({});
    setFieldErrors({});
    setTouchedFields({});
    setSubmitAttemptCount(0);
    setHasRunValidation(false);
  }, []);
  const savedSnapshotRef = useRef(savedSnapshot);
  savedSnapshotRef.current = savedSnapshot;
  return {
    // ── State ──────────────────────────────────────────────────────────
    form: form2,
    // Live form values. Reflects every edit.
    savedSnapshot,
    // Last-saved baseline. Matches server data after save/sync.
    isDirty,
    // true when form differs from savedSnapshot (or files/media pending).
    dirtyFields,
    // { "dot.path": true } for each leaf that changed from snapshot.
    fieldErrors,
    // { "dot.path": "error message" } for all invalid fields.
    isValid,
    // true after validation has run AND there are no errors.
    touchedFields,
    // { "dot.path": true } for fields the user has interacted with.
    isSubmitting,
    // true while the onSubmit handler is awaiting.
    submitAttemptCount,
    // Number of submit() calls. Drives "show errors after first attempt".
    hasRunValidation,
    // true after the first validation run (validateNow, submit, or validateOnChange).
    // ── General value ops ──────────────────────────────────────────────
    set,
    // set("a.b.c", value)         → update any value anywhere.
    setMany,
    // setMany([["a", 1], ["b.c", 2]]) → batch update, one render.
    get,
    // get("a.b.c")                → read from live form.
    getSnapshotValue,
    // getSnapshotValue("a.b.c") → read from saved snapshot.
    removeField,
    // removeField("a.b.c")        → delete a key OR array index.
    merge,
    // merge({...}, "path")        → shallow-merge a patch at a path.
    // ── Object helpers ─────────────────────────────────────────────────
    setObjectKey,
    // setObjectKey("links", "tiktok", url)  → add/update a dynamic key.
    deleteObjectKey,
    // deleteObjectKey("links", "twitter")   → remove a dynamic key.
    // ── List ops ───────────────────────────────────────────────────────
    addItem,
    // addItem("list", item)                 → append (deep-clones item).
    insertItem,
    // insertItem("list", index, item)       → insert at index.
    removeItem,
    // removeItem("list", index)             → remove by index.
    updateItem,
    // updateItem("list", index, field, v)   → update one field of one item.
    replaceItem,
    // replaceItem("list", index, item)      → replace a whole item.
    moveItem,
    // moveItem("list", from, to)            → reposition.
    swapItems,
    // swapItems("list", i, j)               → swap two items.
    duplicateItem,
    // duplicateItem("list", index)          → deep-clone in place.
    setList,
    // setList("list", newArray)             → replace the entire list.
    clearList,
    // clearList("list")                     → empty the list ([]).
    // ── Sorting & reordering ───────────────────────────────────────────
    sortList,
    // sortList("list", "field", "asc")        → sort by field.
    reorderList,
    // reorderList("list", from, to)           → drag-drop alias of moveItem.
    normalizeSortOrder,
    // normalizeSortOrder("list", "sortOrder") → re-stamp order field.
    // ── Files & media ──────────────────────────────────────────────────
    pendingFiles,
    // { slotName: File[] }  Files staged for upload.
    fileSetterFor,
    // fileSetterFor("avatar") → setter for ImagePickerField.
    clearPendingFilesFor,
    // clearPendingFilesFor("avatar") → discard staged files.
    removedMediaKeys,
    // { urlField: true }  Preview URLs cleared by the user.
    removeMedia,
    // removeMedia("avatarUrl") → clear URL + flag for DB null.
    undoRemoveMedia,
    // undoRemoveMedia("avatarUrl") → restore from snapshot.
    // ── Dirty helpers ──────────────────────────────────────────────────
    isDirtyAt,
    // isDirtyAt("section.field") → per-field/subtree dirty check.
    // ── Touched & errors ───────────────────────────────────────────────
    touchField,
    // touchField("name")        → mark touched (call on blur).
    untouchField,
    // untouchField("name")      → unmark touched.
    touchAllFields,
    // touchAllFields()          → mark all leaves touched.
    isFieldTouched,
    // isFieldTouched("name")    → has user interacted with field?
    setFieldError,
    // setFieldError("email", "Taken") → set error from server.
    clearFieldError,
    // clearFieldError("email")  → clear one field's error.
    clearAllErrors,
    // clearAllErrors()          → wipe all errors.
    errorFor,
    // errorFor("name") → error string if touched/submitted, else null.
    validateNow,
    // validateNow()    → run validation now; returns isValid boolean.
    // ── Lifecycle ──────────────────────────────────────────────────────
    submit,
    // submit()              → validate → onSubmit. Returns true on success.
    reset,
    // reset()               → discard all edits back to savedSnapshot.
    syncAfterSave
    // syncAfterSave(data)   → update snapshot after a successful save.
  };
}
function useRuleForm(rule, buildFormShape2, validate2, payloadKey, mode) {
  const submitToAction = useSubmit();
  return useFormState(rule, buildFormShape2, {
    validate: validate2,
    onSubmit: async (form2) => {
      const payload = JSON.stringify({
        name: form2.name,
        description: form2.description,
        isActive: form2.isActive,
        [payloadKey]: form2[payloadKey]
      });
      if (mode === "edit") {
        submitToAction(
          { submitType: "updateRule", ruleId: rule.id, payload },
          { method: "post" }
        );
      } else {
        submitToAction(
          { submitType: "createRule", payload },
          { method: "post" }
        );
      }
    }
  });
}
const SUBMIT_TYPES = ["createRule", "updateRule"];
function useSubmitBusy() {
  var _a2;
  const navigation = useNavigation();
  return navigation.state === "submitting" && SUBMIT_TYPES.includes((_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType"));
}
function useToastRedirect(actionData, redirectTo = "/app/points-rules") {
  const shopify2 = useAppBridge();
  const navigate = useNavigate();
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, {
      isError: actionData.status === "error"
    });
    if (actionData.status === "success") {
      navigate(redirectTo);
    }
  }, [actionData, shopify2, navigate, redirectTo]);
}
function PageHeader({ title, mode, isActive, busy }) {
  const navigate = useNavigate();
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          onClick: () => navigate("/app/points-rules"),
          disabled: busy,
          style: { padding: 0, minHeight: "unset" },
          children: "Points Rules"
        }
      ),
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "›" }),
      /* @__PURE__ */ jsxs("h2", { style: { marginBlock: "0" }, children: [
        mode === "edit" ? "Edit" : "Create",
        " — ",
        title
      ] })
    ] }),
    /* @__PURE__ */ jsx("s-badge", { tone: isActive ? "success" : "critical", children: isActive ? "Active" : "Inactive" })
  ] }) });
}
function ProductList({
  products = [],
  onPick,
  onRemove,
  busy,
  buttonLabel = "Select Products"
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
      /* @__PURE__ */ jsx("s-button", { variant: "secondary", disabled: busy, onClick: onPick, children: buttonLabel }),
      products.length > 0 && /* @__PURE__ */ jsxs("s-text", { tone: "subdued", children: [
        products.length,
        " product",
        products.length !== 1 ? "s" : "",
        " selected"
      ] })
    ] }),
    products.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsx("s-ordered-list", { children: products.map((p) => /* @__PURE__ */ jsx("s-list-item", { children: /* @__PURE__ */ jsxs(
        "s-grid",
        {
          gridTemplateColumns: "1fr auto",
          gap: "small",
          alignItems: "center",
          children: [
            /* @__PURE__ */ jsx("s-text", { children: p.title }),
            /* @__PURE__ */ jsx(
              "s-button",
              {
                icon: "delete",
                variant: "text",
                disabled: busy,
                onClick: () => onRemove(p.id)
              }
            )
          ]
        }
      ) }, p.id)) })
    ] })
  ] });
}
function DescriptionField({ value, onChange, busy }) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("s-heading", { children: "Description (Optional)" }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsx(
      "s-text-area",
      {
        label: "Description",
        labelAccessibilityVisibility: "exclusive",
        placeholder: "Describe this rule...",
        value,
        disabled: busy,
        onInput: (e) => onChange(e.target.value)
      }
    )
  ] });
}
function buildConditions$2(order) {
  var _a2, _b;
  return {
    order: {
      // "oneTime" | "subscription" | "both"
      trigger: order.trigger,
      // "fixed" | "incremental" — same type at all levels, only value overrides
      type: order.type,
      // P1 — global fallback
      fixedPoints: Number(order.fixedPoints ?? 0),
      rate: {
        amount: Number(((_a2 = order.rate) == null ? void 0 : _a2.amount) ?? 0),
        points: Number(((_b = order.rate) == null ? void 0 : _b.points) ?? 0)
      },
      // Products that should never earn points (any priority)
      excludedProducts: (order.excludedProducts ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        image: p.image ?? null,
        handle: p.handle
      })),
      // P2 — global interval override
      intervals: (order.intervals ?? []).map((iv) => {
        var _a3, _b2;
        return {
          interval: iv.interval,
          fixedPoints: Number(iv.fixedPoints ?? 0),
          rate: {
            amount: Number(((_a3 = iv.rate) == null ? void 0 : _a3.amount) ?? 0),
            points: Number(((_b2 = iv.rate) == null ? void 0 : _b2.points) ?? 0)
          }
        };
      }),
      // P3 + P4 — group overrides
      groups: (order.groups ?? []).map((g) => {
        var _a3, _b2;
        return {
          id: g.id,
          name: g.name,
          products: (g.products ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            image: p.image ?? null,
            handle: p.handle
          })),
          fixedPoints: Number(g.fixedPoints ?? 0),
          rate: {
            amount: Number(((_a3 = g.rate) == null ? void 0 : _a3.amount) ?? 0),
            points: Number(((_b2 = g.rate) == null ? void 0 : _b2.points) ?? 0)
          },
          // P4 — group interval override
          intervals: (g.intervals ?? []).map((iv) => {
            var _a4, _b3;
            return {
              interval: iv.interval,
              fixedPoints: Number(iv.fixedPoints ?? 0),
              rate: {
                amount: Number(((_a4 = iv.rate) == null ? void 0 : _a4.amount) ?? 0),
                points: Number(((_b3 = iv.rate) == null ? void 0 : _b3.points) ?? 0)
              }
            };
          })
        };
      })
    }
  };
}
function buildFormShape$4(data) {
  var _a2, _b, _c;
  const order = ((_a2 = data == null ? void 0 : data.conditions) == null ? void 0 : _a2.order) ?? {};
  return {
    name: str(data == null ? void 0 : data.name),
    description: str(data == null ? void 0 : data.description),
    isActive: bool((data == null ? void 0 : data.isActive) ?? true),
    order: {
      trigger: str((order == null ? void 0 : order.trigger) ?? "subscription"),
      type: str((order == null ? void 0 : order.type) ?? "incremental"),
      fixedPoints: num((order == null ? void 0 : order.fixedPoints) ?? 100),
      rate: {
        amount: num(((_b = order == null ? void 0 : order.rate) == null ? void 0 : _b.amount) ?? 10),
        points: num(((_c = order == null ? void 0 : order.rate) == null ? void 0 : _c.points) ?? 1)
      },
      excludedProducts: arr(order == null ? void 0 : order.excludedProducts),
      intervals: arr(order == null ? void 0 : order.intervals),
      groups: arr(order == null ? void 0 : order.groups)
    }
  };
}
function validate$4(form2) {
  const errors = {};
  const order = form2.order;
  if (order.type === "fixed") {
    if (!order.fixedPoints || Number(order.fixedPoints) <= 0) {
      errors["order.fixedPoints"] = "Fixed points must be greater than 0.";
    }
  }
  if (order.type === "incremental") {
    if (!order.rate.points || Number(order.rate.points) <= 0) {
      errors["order.rate.points"] = "Points per rate must be greater than 0.";
    }
    if (!order.rate.amount || Number(order.rate.amount) <= 0) {
      errors["order.rate.amount"] = "Amount per rate must be greater than 0.";
    }
  }
  return errors;
}
const INTERVAL_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "every_two_weeks", label: "Every Two Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "every_two_months", label: "Every Two Months" },
  { value: "every_three_months", label: "Every Three Months" },
  { value: "every_six_months", label: "Every Six Months" },
  { value: "yearly", label: "Yearly" }
];
const getIntervalLabel = (intervalValue) => {
  var _a2;
  return ((_a2 = INTERVAL_OPTIONS.find((o) => o.value === intervalValue)) == null ? void 0 : _a2.label) ?? intervalValue;
};
const TRIGGER_DESCRIPTIONS = {
  oneTime: "One-time purchases only",
  subscription: "Subscription orders only",
  both: "All orders (one-time + subscription)"
};
function useOrderHandlers(formState) {
  const shopify2 = useAppBridge();
  const addInterval = useCallback(() => {
    const usedValues = new Set(
      (formState.form.order.intervals ?? []).map((interval) => interval.interval)
    );
    const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
    if (!nextAvailable) {
      shopify2.toast.show("All intervals are already added.", { isError: true });
      return;
    }
    formState.addItem("order.intervals", {
      interval: nextAvailable.value,
      fixedPoints: 120,
      rate: { amount: 10, points: 2 }
    });
  }, [formState, shopify2]);
  const removeInterval = useCallback((intervalIndex) => {
    formState.removeItem("order.intervals", intervalIndex);
  }, [formState]);
  const updateIntervalValue = useCallback((intervalIndex, newIntervalValue) => {
    var _a2;
    const selectedLabel = ((_a2 = INTERVAL_OPTIONS.find((option) => option.value === newIntervalValue)) == null ? void 0 : _a2.label) ?? newIntervalValue;
    const isDuplicate = (formState.form.order.intervals ?? []).some(
      (interval, index2) => index2 !== intervalIndex && interval.interval === newIntervalValue
    );
    if (isDuplicate) {
      shopify2.toast.show(`"${selectedLabel}" interval is already added.`, { isError: true });
      return;
    }
    const updated = [...formState.form.order.intervals];
    updated[intervalIndex] = { ...updated[intervalIndex], interval: newIntervalValue };
    formState.set("order.intervals", updated);
  }, [formState, shopify2]);
  const updateIntervalRate = useCallback((intervalIndex, rateField, value) => {
    const updated = [...formState.form.order.intervals];
    updated[intervalIndex] = {
      ...updated[intervalIndex],
      rate: { ...updated[intervalIndex].rate, [rateField]: value }
    };
    formState.set("order.intervals", updated);
  }, [formState]);
  const updateIntervalField = useCallback((intervalIndex, field, value) => {
    formState.updateItem("order.intervals", intervalIndex, field, value);
  }, [formState]);
  const addGroup = useCallback(() => {
    var _a2;
    formState.addItem("order.groups", {
      id: crypto.randomUUID(),
      name: `Group ${(((_a2 = formState.form.order.groups) == null ? void 0 : _a2.length) ?? 0) + 1}`,
      products: [],
      fixedPoints: 150,
      rate: { amount: 10, points: 2 },
      intervals: []
    });
  }, [formState]);
  const removeGroup = useCallback((groupIndex) => {
    formState.removeItem("order.groups", groupIndex);
  }, [formState]);
  const updateGroupField = useCallback((groupIndex, field, value) => {
    formState.updateItem("order.groups", groupIndex, field, value);
  }, [formState]);
  const updateGroupRate = useCallback((groupIndex, rateField, value) => {
    const updated = [...formState.form.order.groups];
    updated[groupIndex] = {
      ...updated[groupIndex],
      rate: { ...updated[groupIndex].rate, [rateField]: value }
    };
    formState.set("order.groups", updated);
  }, [formState]);
  const addGroupInterval = useCallback((groupIndex) => {
    const groups = [...formState.form.order.groups];
    const usedValues = new Set(
      (groups[groupIndex].intervals ?? []).map((interval) => interval.interval)
    );
    const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
    if (!nextAvailable) {
      shopify2.toast.show("All intervals are already added to this group.", { isError: true });
      return;
    }
    groups[groupIndex] = {
      ...groups[groupIndex],
      intervals: [
        ...groups[groupIndex].intervals ?? [],
        { interval: nextAvailable.value, fixedPoints: 130, rate: { amount: 10, points: 3 } }
      ]
    };
    formState.set("order.groups", groups);
  }, [formState, shopify2]);
  const removeGroupInterval = useCallback((groupIndex, intervalIndex) => {
    const groups = [...formState.form.order.groups];
    groups[groupIndex] = {
      ...groups[groupIndex],
      intervals: groups[groupIndex].intervals.filter((_, index2) => index2 !== intervalIndex)
    };
    formState.set("order.groups", groups);
  }, [formState]);
  const updateGroupIntervalValue = useCallback((groupIndex, intervalIndex, newIntervalValue) => {
    var _a2;
    const selectedLabel = ((_a2 = INTERVAL_OPTIONS.find((option) => option.value === newIntervalValue)) == null ? void 0 : _a2.label) ?? newIntervalValue;
    const isDuplicate = (formState.form.order.groups[groupIndex].intervals ?? []).some(
      (interval, index2) => index2 !== intervalIndex && interval.interval === newIntervalValue
    );
    if (isDuplicate) {
      shopify2.toast.show(`"${selectedLabel}" interval is already added to this group.`, { isError: true });
      return;
    }
    const groups = [...formState.form.order.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = { ...intervals[intervalIndex], interval: newIntervalValue };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("order.groups", groups);
  }, [formState, shopify2]);
  const updateGroupIntervalField = useCallback((groupIndex, intervalIndex, field, value) => {
    const groups = [...formState.form.order.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = { ...intervals[intervalIndex], [field]: value };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("order.groups", groups);
  }, [formState]);
  const updateGroupIntervalRate = useCallback((groupIndex, intervalIndex, rateField, value) => {
    const groups = [...formState.form.order.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = {
      ...intervals[intervalIndex],
      rate: { ...intervals[intervalIndex].rate, [rateField]: value }
    };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("order.groups", groups);
  }, [formState]);
  const getBlockedProductIdsForExcluded = useCallback(() => {
    return new Set(
      (formState.form.order.groups ?? []).flatMap(
        (group) => (group.products ?? []).map((product) => product.id)
      )
    );
  }, [formState]);
  const getBlockedProductIdsForGroup = useCallback((groupIndex) => {
    const excludedIds = (formState.form.order.excludedProducts ?? []).map((product) => product.id);
    const otherGroupIds = (formState.form.order.groups ?? []).filter((_, index2) => index2 !== groupIndex).flatMap((group) => (group.products ?? []).map((product) => product.id));
    return /* @__PURE__ */ new Set([...excludedIds, ...otherGroupIds]);
  }, [formState]);
  const openExcludedProductPicker = useCallback(async () => {
    var _a2;
    const selectionIds = (formState.form.order.excludedProducts ?? []).map((product) => ({ id: product.id }));
    const result = await shopify2.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds,
      filter: { variants: false }
    });
    if (!((_a2 = result == null ? void 0 : result.selection) == null ? void 0 : _a2.length)) return;
    const blockedIds = getBlockedProductIdsForExcluded();
    const allowedProducts = [];
    const blockedTitles = [];
    result.selection.forEach((selected) => {
      var _a3, _b;
      if (blockedIds.has(selected.id)) {
        blockedTitles.push(selected.title);
      } else {
        allowedProducts.push({
          id: selected.id,
          title: selected.title,
          image: ((_b = (_a3 = selected.images) == null ? void 0 : _a3[0]) == null ? void 0 : _b.originalSrc) ?? null,
          handle: selected.handle
        });
      }
    });
    if (blockedTitles.length > 0) {
      shopify2.toast.show(
        `${blockedTitles.length} product${blockedTitles.length > 1 ? "s" : ""} skipped — already in a group: ${blockedTitles.join(", ")}`,
        { isError: true }
      );
    }
    if (allowedProducts.length > 0) formState.set("order.excludedProducts", allowedProducts);
  }, [formState, shopify2, getBlockedProductIdsForExcluded]);
  const removeExcludedProduct = useCallback((productId) => {
    formState.set(
      "order.excludedProducts",
      formState.form.order.excludedProducts.filter((product) => product.id !== productId)
    );
  }, [formState]);
  const openGroupProductPicker = useCallback(async (groupIndex) => {
    var _a2;
    const group = formState.form.order.groups[groupIndex];
    const selectionIds = (group.products ?? []).map((product) => ({ id: product.id }));
    const result = await shopify2.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds,
      filter: { variants: false }
    });
    if (!((_a2 = result == null ? void 0 : result.selection) == null ? void 0 : _a2.length)) return;
    const blockedIds = getBlockedProductIdsForGroup(groupIndex);
    const allowedProducts = [];
    const blockedTitles = [];
    result.selection.forEach((selected) => {
      var _a3, _b;
      if (blockedIds.has(selected.id)) {
        blockedTitles.push(selected.title);
      } else {
        allowedProducts.push({
          id: selected.id,
          title: selected.title,
          image: ((_b = (_a3 = selected.images) == null ? void 0 : _a3[0]) == null ? void 0 : _b.originalSrc) ?? null,
          handle: selected.handle
        });
      }
    });
    if (blockedTitles.length > 0) {
      shopify2.toast.show(
        `${blockedTitles.length} product${blockedTitles.length > 1 ? "s" : ""} skipped — already excluded or in another group: ${blockedTitles.join(", ")}`,
        { isError: true }
      );
    }
    if (allowedProducts.length > 0) updateGroupField(groupIndex, "products", allowedProducts);
  }, [formState, shopify2, updateGroupField, getBlockedProductIdsForGroup]);
  const removeGroupProduct = useCallback((groupIndex, productId) => {
    const group = formState.form.order.groups[groupIndex];
    updateGroupField(
      groupIndex,
      "products",
      group.products.filter((product) => product.id !== productId)
    );
  }, [formState, updateGroupField]);
  return {
    /** Global interval overrides (Priority 2) */
    intervals: {
      add: addInterval,
      remove: removeInterval,
      updateValue: updateIntervalValue,
      updateRate: updateIntervalRate,
      updateField: updateIntervalField
    },
    /** Product group handlers (Priority 3 + 4) */
    groups: {
      add: addGroup,
      remove: removeGroup,
      updateField: updateGroupField,
      updateRate: updateGroupRate,
      /** Products within a group */
      products: {
        openPicker: openGroupProductPicker,
        remove: removeGroupProduct
      },
      /** Interval overrides within a group (Priority 4) */
      intervals: {
        add: addGroupInterval,
        remove: removeGroupInterval,
        updateValue: updateGroupIntervalValue,
        updateField: updateGroupIntervalField,
        updateRate: updateGroupIntervalRate
      }
    },
    /** Excluded products (never earn points regardless of group/interval) */
    excludedProducts: {
      openPicker: openExcludedProductPicker,
      remove: removeExcludedProduct
    }
  };
}
function EarningFields({
  val,
  orderType,
  onChangeFixed,
  onChangeRatePoints,
  onChangeRateAmount,
  busy
}) {
  var _a2, _b;
  if (orderType === "incremental") {
    return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto 1fr", gap: "large", alignItems: "center", children: [
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Points",
          labelAccessibilityVisibility: "exclusive",
          suffix: "points",
          step: 1,
          min: 1,
          value: ((_a2 = val == null ? void 0 : val.rate) == null ? void 0 : _a2.points) ?? "",
          disabled: busy,
          onInput: (e) => onChangeRatePoints(e.target.value ? Number(e.target.value) : 0)
        }
      ),
      /* @__PURE__ */ jsx("s-text", { children: "for every" }),
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Amount",
          labelAccessibilityVisibility: "exclusive",
          prefix: "$",
          suffix: "spent",
          step: 1,
          min: 1,
          value: ((_b = val == null ? void 0 : val.rate) == null ? void 0 : _b.amount) ?? "",
          disabled: busy,
          onInput: (e) => onChangeRateAmount(e.target.value ? Number(e.target.value) : 0)
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsx(
    "s-number-field",
    {
      label: "Points",
      labelAccessibilityVisibility: "exclusive",
      suffix: "points",
      value: (val == null ? void 0 : val.fixedPoints) ?? "",
      disabled: busy,
      onInput: (e) => onChangeFixed(e.target.value ? Number(e.target.value) : 0)
    }
  );
}
function IntervalCard$1({ iv, idx, orderType, busy, usedIntervals, onRemove, onInterval, onField, onRateField }) {
  var _a2;
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsxs("strong", { children: [
            "Interval — ",
            ((_a2 = INTERVAL_OPTIONS.find((o) => o.value === iv.interval)) == null ? void 0 : _a2.label) ?? "Not selected"
          ] }) }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => onRemove(idx)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-select",
          {
            label: "Interval",
            labelAccessibilityVisibility: "exclusive",
            value: iv.interval,
            disabled: busy,
            onChange: (e) => onInterval(idx, e.target.value),
            children: INTERVAL_OPTIONS.map(({ value, label: label2 }) => {
              const usedByOther = usedIntervals.has(value) && value !== iv.interval;
              return /* @__PURE__ */ jsxs("s-option", { value, disabled: usedByOther || void 0, children: [
                label2,
                usedByOther ? " (added)" : ""
              ] }, value);
            })
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          EarningFields,
          {
            val: iv,
            orderType,
            onChangeFixed: (v) => onField(idx, "fixedPoints", v),
            onChangeRatePoints: (v) => onRateField(idx, "points", v),
            onChangeRateAmount: (v) => onRateField(idx, "amount", v),
            busy
          }
        )
      ]
    }
  ) });
}
function GroupCard$1({ group, groupIndex, orderType, isSubscription, busy, handlers }) {
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx(
            "s-text-field",
            {
              label: "Group Name",
              labelAccessibilityVisibility: "exclusive",
              value: group.name,
              disabled: busy,
              onInput: (e) => handlers.updateField(groupIndex, "name", e.target.value)
            }
          ),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => handlers.remove(groupIndex)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx(
          ProductList,
          {
            products: group.products ?? [],
            onPick: () => handlers.products.openPicker(groupIndex),
            onRemove: (productId) => handlers.products.remove(groupIndex, productId),
            busy
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: "Group Points" }) }),
          /* @__PURE__ */ jsx("s-badge", { tone: "info", children: "Default override" })
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          EarningFields,
          {
            val: group,
            orderType,
            onChangeFixed: (value) => handlers.updateField(groupIndex, "fixedPoints", value),
            onChangeRatePoints: (value) => handlers.updateRate(groupIndex, "points", value),
            onChangeRateAmount: (value) => handlers.updateRate(groupIndex, "amount", value),
            busy
          }
        ),
        isSubscription && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsx("s-divider", {}),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", alignItems: "center", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: "Interval Overrides" }) }),
              /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "extra-small" }),
              /* @__PURE__ */ jsx("s-text", { tone: "subdued", style: { fontSize: "0.75rem" }, children: "Applied when subscription interval matches — overrides group points above." })
            ] }),
            /* @__PURE__ */ jsx(
              "s-button",
              {
                variant: "secondary",
                disabled: busy,
                onClick: () => handlers.intervals.add(groupIndex),
                children: "+ Add Interval"
              }
            )
          ] }),
          (group.intervals ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
            group.intervals.map((interval, intervalIndex) => /* @__PURE__ */ jsx(
              GroupIntervalCard$1,
              {
                interval,
                intervalIndex,
                groupIndex,
                orderType,
                busy,
                usedIntervals: new Set(
                  group.intervals.filter((_, index2) => index2 !== intervalIndex).map((item) => item.interval)
                ),
                handlers: handlers.intervals
              },
              intervalIndex
            ))
          ] })
        ] })
      ]
    }
  ) });
}
function GroupIntervalCard$1({
  interval,
  intervalIndex,
  groupIndex,
  orderType,
  busy,
  usedIntervals,
  handlers
}) {
  var _a2;
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      borderStyle: "dashed",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsxs("strong", { children: [
            "Interval — ",
            ((_a2 = INTERVAL_OPTIONS.find((option) => option.value === interval.interval)) == null ? void 0 : _a2.label) ?? "Not selected"
          ] }) }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => handlers.remove(groupIndex, intervalIndex)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-select",
          {
            label: "Interval",
            labelAccessibilityVisibility: "exclusive",
            value: interval.interval,
            disabled: busy,
            onChange: (e) => handlers.updateValue(groupIndex, intervalIndex, e.target.value),
            children: INTERVAL_OPTIONS.map(({ value, label: label2 }) => {
              const isUsedByOther = usedIntervals.has(value) && value !== interval.interval;
              return /* @__PURE__ */ jsxs("s-option", { value, disabled: isUsedByOther || void 0, children: [
                label2,
                isUsedByOther ? " (added)" : ""
              ] }, value);
            })
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          EarningFields,
          {
            val: interval,
            orderType,
            onChangeFixed: (value) => handlers.updateField(groupIndex, intervalIndex, "fixedPoints", value),
            onChangeRatePoints: (value) => handlers.updateRate(groupIndex, intervalIndex, "points", value),
            onChangeRateAmount: (value) => handlers.updateRate(groupIndex, intervalIndex, "amount", value),
            busy
          }
        )
      ]
    }
  ) });
}
function ActiveToggle({ checked, onChange, busy }) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("s-heading", { children: "Active Status" }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsx(
      "s-switch",
      {
        labelAccessibilityVisibility: "exclusion",
        label: checked ? "Active" : "Inactive",
        checked,
        disabled: busy,
        onChange: (e) => onChange(e.target.checked)
      }
    )
  ] });
}
function SummaryPanel$2({ event, order, isActive, onActiveChange, busy }) {
  const defaultRateLabel = order.type === "incremental" ? `${order.rate.points || 0} pt for every $${order.rate.amount || 0} spent` : `${order.fixedPoints || 0} pts flat per order`;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsx("s-heading", { children: "Summary" }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Event:" }),
        " ",
        (event == null ? void 0 : event.name) ?? "Direct Purchase"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Applies to:" }),
        " ",
        TRIGGER_DESCRIPTIONS[order.trigger] ?? order.trigger
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Default rate:" }),
        " ",
        defaultRateLabel
      ] }),
      (order.groups ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsxs("s-text", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Product groups:" }),
          " ",
          order.groups.length,
          " group",
          order.groups.length !== 1 ? "s" : "",
          " with custom rates",
          " — ",
          order.groups.map((g) => g.name).filter(Boolean).join(", ")
        ] })
      ] }),
      (order.intervals ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsxs("s-text", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Interval overrides:" }),
          " ",
          order.intervals.length,
          " subscription interval",
          order.intervals.length !== 1 ? "s" : "",
          " with custom rates"
        ] })
      ] }),
      (order.excludedProducts ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsxs("s-text", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Excluded:" }),
          " ",
          order.excludedProducts.length,
          " product",
          order.excludedProducts.length !== 1 ? "s" : "",
          " earn no points",
          " — ",
          order.excludedProducts.map((p) => p.title).filter(Boolean).join(", ")
        ] })
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Status:" }),
        " ",
        isActive ? "Active ✅" : "Inactive ❌"
      ] })
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(ActiveToggle, { checked: isActive, onChange: onActiveChange, busy })
  ] });
}
const loader$e = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  const event = await prisma.event.findFirst({
    where: {
      sessionId: session.id,
      type: "ORDER",
      isActive: true
    }
  });
  if (!event) return redirect("/app/points-rules");
  if (ruleId) {
    const rule = await prisma.pointsRule.findUnique({
      where: {
        id: parseInt(ruleId)
      },
      include: {
        event: true
      }
    });
    if (!rule || rule.sessionId !== session.id) return redirect("/app/points-rules");
    return {
      rule,
      event,
      mode: "edit"
    };
  }
  return {
    rule: null,
    event,
    mode: "create"
  };
};
const action$l = async ({
  request
}) => {
  const {
    session,
    admin
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const payload = JSON.parse(formData.get("payload") || "{}");
  if (submitType === "createRule") {
    try {
      const event = await prisma.event.findFirst({
        where: {
          sessionId: session.id,
          type: "ORDER",
          isActive: true
        }
      });
      if (!event) return {
        message: "ORDER event not found.",
        status: "error",
        submitType
      };
      const existing = await prisma.pointsRule.findFirst({
        where: {
          eventId: event.id,
          sessionId: session.id
        }
      });
      if (existing) return {
        message: "A rule for this event already exists.",
        status: "error",
        submitType
      };
      const created = await prisma.pointsRule.create({
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions$2(payload.order),
          session: {
            connect: {
              id: session.id
            }
          },
          event: {
            connect: {
              id: event.id
            }
          }
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule created successfully.",
        rule: created,
        status: "success",
        submitType
      };
    } catch (error) {
      console.error("Create ORDER Rule Error:", error);
      return {
        message: "Failed to create rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  if (submitType === "updateRule") {
    const ruleId = parseInt(formData.get("ruleId"));
    if (!ruleId) return {
      message: "Rule ID is required.",
      status: "error",
      submitType
    };
    try {
      const existing = await prisma.pointsRule.findUnique({
        where: {
          id: ruleId
        }
      });
      if (!existing || existing.sessionId !== session.id) return {
        message: "Rule not found or access denied.",
        status: "error",
        submitType
      };
      const rule = await prisma.pointsRule.update({
        where: {
          id: ruleId
        },
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions$2(payload.order)
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule updated successfully.",
        rule,
        status: "success",
        submitType
      };
    } catch (error) {
      console.error("Update ORDER Rule Error:", error);
      return {
        message: "Failed to update rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  return {
    message: "Invalid action.",
    status: "error",
    submitType
  };
};
const route$7 = UNSAFE_withComponentProps(function OrderRulePage() {
  var _a2, _b;
  const {
    rule,
    event,
    mode
  } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const isBusy = useSubmitBusy();
  const formState = useRuleForm(rule, buildFormShape$4, validate$4, "order", mode);
  const orderHandlers = useOrderHandlers(formState);
  useToastRedirect(actionData);
  const order = formState.form.order;
  const isSubscription = order.trigger === "subscription" || order.trigger === "both";
  const isGlobalValid = order.type === "fixed" ? Number(order.fixedPoints) > 0 : Number((_a2 = order.rate) == null ? void 0 : _a2.points) > 0 && Number((_b = order.rate) == null ? void 0 : _b.amount) > 0;
  const usedGlobalIntervalValues = new Set((order.intervals ?? []).map((interval) => interval.interval));
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsxs("s-page", {
      inlineSize: "base",
      children: [/* @__PURE__ */ jsx(PageHeader, {
        title: "Order Rule",
        mode,
        isActive: formState.form.isActive,
        busy: isBusy
      }), /* @__PURE__ */ jsxs("s-grid", {
        gridTemplateColumns: "2fr 1fr",
        gap: "base",
        children: [/* @__PURE__ */ jsxs("s-box", {
          children: [/* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Order Trigger"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Choose which type of orders will earn points."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "small"
            }), /* @__PURE__ */ jsxs("s-choice-list", {
              name: "orderTrigger",
              value: [order.trigger],
              onInput: (e) => formState.set("order.trigger", e.currentTarget.values[0]),
              children: [/* @__PURE__ */ jsx("s-choice", {
                value: "oneTime",
                selected: order.trigger === "oneTime",
                children: "One-time purchase only"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "subscription",
                selected: order.trigger === "subscription",
                children: "Subscription orders only"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "both",
                selected: order.trigger === "both",
                children: "Both — all order types"
              })]
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Earning Method"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Reward based on spend, or a flat amount per order."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "small"
            }), /* @__PURE__ */ jsxs("s-choice-list", {
              name: "orderMethod",
              value: [order.type],
              onInput: (e) => {
                const selectedType = e.currentTarget.values[0];
                formState.setMany([["order.type", selectedType], ["order.rate", selectedType === "incremental" ? {
                  amount: 10,
                  points: 1
                } : order.rate], ["order.fixedPoints", selectedType === "fixed" ? 100 : order.fixedPoints]]);
              },
              children: [/* @__PURE__ */ jsx("s-choice", {
                value: "incremental",
                selected: order.type === "incremental",
                children: "Incremental — points based on spend (Recommended)"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "fixed",
                selected: order.type === "fixed",
                children: "Fixed — same points for every order"
              })]
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Global Earning Points"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Default rate — overridden by groups or intervals below."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "small"
            }), /* @__PURE__ */ jsx(EarningFields, {
              val: order,
              orderType: order.type,
              onChangeFixed: (value) => formState.set("order.fixedPoints", value),
              onChangeRatePoints: (value) => formState.set("order.rate.points", value),
              onChangeRateAmount: (value) => formState.set("order.rate.amount", value),
              busy: isBusy
            }), formState.errorFor("order.fixedPoints") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("order.fixedPoints")
            }), formState.errorFor("order.rate.points") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("order.rate.points")
            }), formState.errorFor("order.rate.amount") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("order.rate.amount")
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Excluded Products (Optional)"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Products here never earn points — regardless of group or interval."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "base"
            }), /* @__PURE__ */ jsx(ProductList, {
              products: order.excludedProducts ?? [],
              onPick: orderHandlers.excludedProducts.openPicker,
              onRemove: orderHandlers.excludedProducts.remove,
              busy: isBusy,
              buttonLabel: "Select Excluded Products"
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), isGlobalValid && isSubscription && /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsxs("s-grid", {
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("s-heading", {
                  children: "Subscription Interval Overrides"
                }), /* @__PURE__ */ jsx("s-text", {
                  tone: "subdued",
                  children: "Custom rates per billing frequency — applies to products not in any group."
                })]
              }), /* @__PURE__ */ jsx("s-button", {
                variant: "primary",
                disabled: isBusy,
                onClick: orderHandlers.intervals.add,
                children: "+ Add Interval"
              })]
            }), (order.intervals ?? []).map((interval, intervalIndex) => /* @__PURE__ */ jsx(IntervalCard$1, {
              iv: interval,
              idx: intervalIndex,
              orderType: order.type,
              busy: isBusy,
              usedIntervals: usedGlobalIntervalValues,
              onRemove: orderHandlers.intervals.remove,
              onInterval: orderHandlers.intervals.updateValue,
              onField: orderHandlers.intervals.updateField,
              onRateField: orderHandlers.intervals.updateRate
            }, intervalIndex))]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), isGlobalValid && /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsxs("s-grid", {
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("s-heading", {
                  children: "Product Groups"
                }), /* @__PURE__ */ jsx("s-text", {
                  tone: "subdued",
                  children: "Custom rates for specific products — overrides global and interval rates."
                })]
              }), /* @__PURE__ */ jsx("s-button", {
                variant: "primary",
                disabled: isBusy,
                onClick: orderHandlers.groups.add,
                children: "+ Add Group"
              })]
            }), (order.groups ?? []).map((group, groupIndex) => /* @__PURE__ */ jsx(GroupCard$1, {
              group,
              groupIndex,
              orderType: order.type,
              isSubscription,
              busy: isBusy,
              handlers: orderHandlers.groups
            }, group.id))]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsx(DescriptionField, {
            value: formState.form.description,
            onChange: (value) => formState.set("description", value),
            busy: isBusy
          })]
        }), /* @__PURE__ */ jsx("s-box", {
          children: /* @__PURE__ */ jsx(SummaryPanel$2, {
            event,
            order,
            isActive: formState.form.isActive,
            onActiveChange: (value) => formState.set("isActive", value),
            busy: isBusy
          })
        })]
      })]
    }), /* @__PURE__ */ jsx(SaveBar, {
      visible: mode === "create" || formState.isDirty,
      position: "bottom-center",
      message: mode === "edit" ? "You have unsaved changes" : "Ready to save your new rule",
      primaryLabel: mode === "edit" ? "Update Rule" : "Save Rule",
      secondaryLabel: mode === "edit" ? "Discard Changes" : "Cancel",
      onPrimary: formState.submit,
      onSecondary: () => mode === "edit" ? formState.reset() : navigate("/app/points-rules"),
      loading: isBusy,
      disabled: isBusy
    })]
  });
});
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$l,
  default: route$7,
  loader: loader$e
}, Symbol.toStringTag, { value: "Module" }));
function buildConditions$1(referral) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  return {
    referral: {
      // "oneTime" | "subscription" | "both"
      trigger: referral.trigger,
      // P1 — global fallback
      referrer: {
        points: Number(((_a2 = referral.referrer) == null ? void 0 : _a2.points) ?? 0),
        allowRenewalReward: Boolean(((_b = referral.referrer) == null ? void 0 : _b.allowRenewalReward) ?? false),
        renewalPoints: Number(((_c = referral.referrer) == null ? void 0 : _c.renewalPoints) ?? 0)
      },
      referred: {
        // Always global — never overridden at group level
        // "fixed" | "percentage"
        discountType: ((_d = referral.referred) == null ? void 0 : _d.discountType) ?? "fixed",
        discountValue: Number(((_e = referral.referred) == null ? void 0 : _e.discountValue) ?? 0),
        points: Number(((_f = referral.referred) == null ? void 0 : _f.points) ?? 0),
        allowRenewalReward: Boolean(((_g = referral.referred) == null ? void 0 : _g.allowRenewalReward) ?? false),
        renewalPoints: Number(((_h = referral.referred) == null ? void 0 : _h.renewalPoints) ?? 0)
      },
      // P2 — global interval override
      intervals: (referral.intervals ?? []).map((iv) => {
        var _a3, _b2, _c2, _d2, _e2, _f2;
        return {
          interval: iv.interval,
          referrer: {
            points: Number(((_a3 = iv.referrer) == null ? void 0 : _a3.points) ?? 0),
            allowRenewalReward: Boolean(((_b2 = iv.referrer) == null ? void 0 : _b2.allowRenewalReward) ?? false),
            renewalPoints: Number(((_c2 = iv.referrer) == null ? void 0 : _c2.renewalPoints) ?? 0)
          },
          referred: {
            points: Number(((_d2 = iv.referred) == null ? void 0 : _d2.points) ?? 0),
            allowRenewalReward: Boolean(((_e2 = iv.referred) == null ? void 0 : _e2.allowRenewalReward) ?? false),
            renewalPoints: Number(((_f2 = iv.referred) == null ? void 0 : _f2.renewalPoints) ?? 0)
          }
        };
      }),
      // P3 + P4 — group overrides
      groups: (referral.groups ?? []).map((g) => {
        var _a3, _b2, _c2, _d2, _e2, _f2;
        return {
          id: g.id,
          name: g.name,
          products: (g.products ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            image: p.image ?? null,
            handle: p.handle
          })),
          referrer: {
            points: Number(((_a3 = g.referrer) == null ? void 0 : _a3.points) ?? 0),
            allowRenewalReward: Boolean(((_b2 = g.referrer) == null ? void 0 : _b2.allowRenewalReward) ?? false),
            renewalPoints: Number(((_c2 = g.referrer) == null ? void 0 : _c2.renewalPoints) ?? 0)
          },
          referred: {
            points: Number(((_d2 = g.referred) == null ? void 0 : _d2.points) ?? 0),
            allowRenewalReward: Boolean(((_e2 = g.referred) == null ? void 0 : _e2.allowRenewalReward) ?? false),
            renewalPoints: Number(((_f2 = g.referred) == null ? void 0 : _f2.renewalPoints) ?? 0)
          },
          // P4 — group interval override
          intervals: (g.intervals ?? []).map((iv) => {
            var _a4, _b3, _c3, _d3, _e3, _f3;
            return {
              interval: iv.interval,
              referrer: {
                points: Number(((_a4 = iv.referrer) == null ? void 0 : _a4.points) ?? 0),
                allowRenewalReward: Boolean(((_b3 = iv.referrer) == null ? void 0 : _b3.allowRenewalReward) ?? false),
                renewalPoints: Number(((_c3 = iv.referrer) == null ? void 0 : _c3.renewalPoints) ?? 0)
              },
              referred: {
                points: Number(((_d3 = iv.referred) == null ? void 0 : _d3.points) ?? 0),
                allowRenewalReward: Boolean(((_e3 = iv.referred) == null ? void 0 : _e3.allowRenewalReward) ?? false),
                renewalPoints: Number(((_f3 = iv.referred) == null ? void 0 : _f3.renewalPoints) ?? 0)
              }
            };
          })
        };
      })
    }
  };
}
function buildFormShape$3(data) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  const ref = ((_a2 = data == null ? void 0 : data.conditions) == null ? void 0 : _a2.referral) ?? {};
  return {
    name: str(data == null ? void 0 : data.name),
    description: str(data == null ? void 0 : data.description),
    isActive: bool((data == null ? void 0 : data.isActive) ?? true),
    referral: {
      trigger: str((ref == null ? void 0 : ref.trigger) ?? "subscription"),
      // P1 — global fallback defaults
      referrer: {
        points: num(((_b = ref == null ? void 0 : ref.referrer) == null ? void 0 : _b.points) ?? 100),
        allowRenewalReward: bool(((_c = ref == null ? void 0 : ref.referrer) == null ? void 0 : _c.allowRenewalReward) ?? false),
        renewalPoints: num(((_d = ref == null ? void 0 : ref.referrer) == null ? void 0 : _d.renewalPoints) ?? 80)
      },
      referred: {
        discountType: str(((_e = ref == null ? void 0 : ref.referred) == null ? void 0 : _e.discountType) ?? "fixed"),
        discountValue: num(((_f = ref == null ? void 0 : ref.referred) == null ? void 0 : _f.discountValue) ?? 10),
        points: num(((_g = ref == null ? void 0 : ref.referred) == null ? void 0 : _g.points) ?? 50),
        allowRenewalReward: bool(((_h = ref == null ? void 0 : ref.referred) == null ? void 0 : _h.allowRenewalReward) ?? false),
        renewalPoints: num(((_i = ref == null ? void 0 : ref.referred) == null ? void 0 : _i.renewalPoints) ?? 40)
      },
      intervals: arr(ref == null ? void 0 : ref.intervals),
      // P2
      groups: arr(ref == null ? void 0 : ref.groups)
      // P3 + P4
    }
  };
}
function validate$3(form2) {
  const errors = {};
  const ref = form2.referral.referrer;
  const referred = form2.referral.referred;
  if (!ref.points || Number(ref.points) <= 0) {
    errors["referral.referrer.points"] = "Referrer points must be greater than 0.";
  }
  if (!referred.discountValue || Number(referred.discountValue) <= 0) {
    errors["referral.referred.discountValue"] = "Referred discount value must be greater than 0.";
  }
  if (!referred.points || Number(referred.points) <= 0) {
    errors["referral.referred.points"] = "Referred points must be greater than 0.";
  }
  return errors;
}
function useReferralHandlers(formState) {
  const shopify2 = useAppBridge();
  const changeTrigger = useCallback((newTrigger) => {
    if (newTrigger !== "oneTime") {
      formState.set("referral.trigger", newTrigger);
      return;
    }
    formState.set("referral", {
      ...formState.form.referral,
      trigger: newTrigger,
      intervals: [],
      groups: (formState.form.referral.groups ?? []).map((group) => ({
        ...group,
        intervals: []
      }))
    });
  }, [formState]);
  const addInterval = useCallback(() => {
    const usedValues = new Set(
      (formState.form.referral.intervals ?? []).map((interval) => interval.interval)
    );
    const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
    if (!nextAvailable) {
      shopify2.toast.show("All intervals are already added.", { isError: true });
      return;
    }
    formState.addItem("referral.intervals", {
      interval: nextAvailable.value,
      referrer: { points: 130, allowRenewalReward: false, renewalPoints: 100 },
      referred: { points: 65, allowRenewalReward: false, renewalPoints: 50 }
    });
  }, [formState, shopify2]);
  const removeInterval = useCallback((intervalIndex) => {
    formState.removeItem("referral.intervals", intervalIndex);
  }, [formState]);
  const updateIntervalValue = useCallback((intervalIndex, newIntervalValue) => {
    const isDuplicate = (formState.form.referral.intervals ?? []).some(
      (interval, index2) => index2 !== intervalIndex && interval.interval === newIntervalValue
    );
    if (isDuplicate) {
      shopify2.toast.show(`"${newIntervalValue}" interval is already added.`, { isError: true });
      return;
    }
    const updated = [...formState.form.referral.intervals];
    updated[intervalIndex] = { ...updated[intervalIndex], interval: newIntervalValue };
    formState.set("referral.intervals", updated);
  }, [formState, shopify2]);
  const updateIntervalReferrer = useCallback((intervalIndex, field, value) => {
    const updated = [...formState.form.referral.intervals];
    updated[intervalIndex] = {
      ...updated[intervalIndex],
      referrer: { ...updated[intervalIndex].referrer, [field]: value }
    };
    formState.set("referral.intervals", updated);
  }, [formState]);
  const updateIntervalReferred = useCallback((intervalIndex, field, value) => {
    const updated = [...formState.form.referral.intervals];
    updated[intervalIndex] = {
      ...updated[intervalIndex],
      referred: { ...updated[intervalIndex].referred, [field]: value }
    };
    formState.set("referral.intervals", updated);
  }, [formState]);
  const addGroup = useCallback(() => {
    var _a2;
    formState.addItem("referral.groups", {
      id: crypto.randomUUID(),
      name: `Group ${(((_a2 = formState.form.referral.groups) == null ? void 0 : _a2.length) ?? 0) + 1}`,
      products: [],
      referrer: { points: 150, allowRenewalReward: false, renewalPoints: 120 },
      referred: { points: 75, allowRenewalReward: false, renewalPoints: 60 },
      intervals: []
    });
  }, [formState]);
  const removeGroup = useCallback((groupIndex) => {
    formState.removeItem("referral.groups", groupIndex);
  }, [formState]);
  const updateGroupField = useCallback((groupIndex, field, value) => {
    formState.updateItem("referral.groups", groupIndex, field, value);
  }, [formState]);
  const updateGroupReferrer = useCallback((groupIndex, field, value) => {
    const updated = [...formState.form.referral.groups];
    updated[groupIndex] = {
      ...updated[groupIndex],
      referrer: { ...updated[groupIndex].referrer, [field]: value }
    };
    formState.set("referral.groups", updated);
  }, [formState]);
  const updateGroupReferred = useCallback((groupIndex, field, value) => {
    const updated = [...formState.form.referral.groups];
    updated[groupIndex] = {
      ...updated[groupIndex],
      referred: { ...updated[groupIndex].referred, [field]: value }
    };
    formState.set("referral.groups", updated);
  }, [formState]);
  const addGroupInterval = useCallback((groupIndex) => {
    const groups = [...formState.form.referral.groups];
    const usedValues = new Set(
      (groups[groupIndex].intervals ?? []).map((interval) => interval.interval)
    );
    const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
    if (!nextAvailable) {
      shopify2.toast.show("All intervals are already added to this group.", { isError: true });
      return;
    }
    groups[groupIndex] = {
      ...groups[groupIndex],
      intervals: [
        ...groups[groupIndex].intervals ?? [],
        {
          interval: nextAvailable.value,
          referrer: { points: 120, allowRenewalReward: false, renewalPoints: 90 },
          referred: { points: 60, allowRenewalReward: false, renewalPoints: 45 }
        }
      ]
    };
    formState.set("referral.groups", groups);
  }, [formState, shopify2]);
  const removeGroupInterval = useCallback((groupIndex, intervalIndex) => {
    const groups = [...formState.form.referral.groups];
    groups[groupIndex] = {
      ...groups[groupIndex],
      intervals: groups[groupIndex].intervals.filter((_, index2) => index2 !== intervalIndex)
    };
    formState.set("referral.groups", groups);
  }, [formState]);
  const updateGroupIntervalValue = useCallback((groupIndex, intervalIndex, newIntervalValue) => {
    const isDuplicate = (formState.form.referral.groups[groupIndex].intervals ?? []).some(
      (interval, index2) => index2 !== intervalIndex && interval.interval === newIntervalValue
    );
    if (isDuplicate) {
      shopify2.toast.show(`"${newIntervalValue}" interval is already added to this group.`, { isError: true });
      return;
    }
    const groups = [...formState.form.referral.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = { ...intervals[intervalIndex], interval: newIntervalValue };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("referral.groups", groups);
  }, [formState, shopify2]);
  const updateGroupIntervalReferrer = useCallback((groupIndex, intervalIndex, field, value) => {
    const groups = [...formState.form.referral.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = {
      ...intervals[intervalIndex],
      referrer: { ...intervals[intervalIndex].referrer, [field]: value }
    };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("referral.groups", groups);
  }, [formState]);
  const updateGroupIntervalReferred = useCallback((groupIndex, intervalIndex, field, value) => {
    const groups = [...formState.form.referral.groups];
    const intervals = [...groups[groupIndex].intervals];
    intervals[intervalIndex] = {
      ...intervals[intervalIndex],
      referred: { ...intervals[intervalIndex].referred, [field]: value }
    };
    groups[groupIndex] = { ...groups[groupIndex], intervals };
    formState.set("referral.groups", groups);
  }, [formState]);
  const getBlockedProductIdsForGroup = useCallback((groupIndex) => {
    return new Set(
      (formState.form.referral.groups ?? []).filter((_, index2) => index2 !== groupIndex).flatMap((group) => (group.products ?? []).map((product) => product.id))
    );
  }, [formState]);
  const openGroupProductPicker = useCallback(async (groupIndex) => {
    var _a2;
    const group = formState.form.referral.groups[groupIndex];
    const selectionIds = (group.products ?? []).map((product) => ({ id: product.id }));
    const result = await shopify2.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds,
      filter: { variants: false }
    });
    if (!((_a2 = result == null ? void 0 : result.selection) == null ? void 0 : _a2.length)) return;
    const blockedIds = getBlockedProductIdsForGroup(groupIndex);
    const allowedProducts = [];
    const blockedTitles = [];
    result.selection.forEach((selected) => {
      var _a3, _b;
      if (blockedIds.has(selected.id)) {
        blockedTitles.push(selected.title);
      } else {
        allowedProducts.push({
          id: selected.id,
          title: selected.title,
          image: ((_b = (_a3 = selected.images) == null ? void 0 : _a3[0]) == null ? void 0 : _b.originalSrc) ?? null,
          handle: selected.handle
        });
      }
    });
    if (blockedTitles.length > 0) {
      shopify2.toast.show(
        `${blockedTitles.length} product${blockedTitles.length > 1 ? "s" : ""} skipped — already in another group: ${blockedTitles.join(", ")}`,
        { isError: true }
      );
    }
    if (allowedProducts.length > 0) {
      updateGroupField(groupIndex, "products", allowedProducts);
    }
  }, [formState, shopify2, updateGroupField, getBlockedProductIdsForGroup]);
  const removeGroupProduct = useCallback((groupIndex, productId) => {
    const group = formState.form.referral.groups[groupIndex];
    updateGroupField(
      groupIndex,
      "products",
      group.products.filter((product) => product.id !== productId)
    );
  }, [formState, updateGroupField]);
  return {
    /** Trigger type handler */
    trigger: {
      change: changeTrigger
    },
    /** Global interval overrides (Priority 2) */
    intervals: {
      add: addInterval,
      remove: removeInterval,
      updateValue: updateIntervalValue,
      updateReferrer: updateIntervalReferrer,
      updateReferred: updateIntervalReferred
    },
    /** Product group handlers (Priority 3 + 4) */
    groups: {
      add: addGroup,
      remove: removeGroup,
      updateField: updateGroupField,
      updateReferrer: updateGroupReferrer,
      updateReferred: updateGroupReferred,
      /** Products within a group */
      products: {
        openPicker: openGroupProductPicker,
        remove: removeGroupProduct
      },
      /** Interval overrides within a group (Priority 4) */
      intervals: {
        add: addGroupInterval,
        remove: removeGroupInterval,
        updateValue: updateGroupIntervalValue,
        updateReferrer: updateGroupIntervalReferrer,
        updateReferred: updateGroupIntervalReferred
      }
    }
  };
}
function PointsFields({
  referrerVal,
  referredVal,
  onReferrer,
  onReferred,
  showRenewal = true,
  showRenewalToggle = false,
  tooltipPrefix = "points",
  busy
}) {
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
    /* @__PURE__ */ jsx(
      Side,
      {
        label: "Referrer",
        val: referrerVal,
        onChange: onReferrer,
        showRenewal,
        showRenewalToggle,
        tooltipId: `${tooltipPrefix}-referrer-tooltip`,
        tooltipText: "Turn this on to also reward the referrer each time the new customer renews their subscription — not just the first order.",
        busy
      }
    ),
    /* @__PURE__ */ jsx(
      Side,
      {
        label: "Referred",
        val: referredVal,
        onChange: onReferred,
        showRenewal,
        showRenewalToggle,
        tooltipId: `${tooltipPrefix}-referred-tooltip`,
        tooltipText: "Turn this on to also reward the new customer each time they renew their own subscription — not just their first order.",
        busy
      }
    )
  ] });
}
function Side({ label: label2, val, onChange, showRenewal, showRenewalToggle, tooltipId, tooltipText, busy }) {
  const showRenewalPoints = showRenewal && (showRenewalToggle ? val == null ? void 0 : val.allowRenewalReward : true);
  return /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: label2 }) }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-number-field",
          {
            label: "Points",
            labelAccessibilityVisibility: "exclusive",
            suffix: "points",
            step: 1,
            min: 0,
            value: (val == null ? void 0 : val.points) ?? "",
            disabled: busy,
            onInput: (e) => onChange("points", e.target.value ? Number(e.target.value) : 0)
          }
        ),
        showRenewal && showRenewalToggle && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
            /* @__PURE__ */ jsx(
              "s-switch",
              {
                labelAccessibilityVisibility: "visible",
                label: (val == null ? void 0 : val.allowRenewalReward) ? "Renewal bonus: On" : "Renewal bonus: Off",
                checked: (val == null ? void 0 : val.allowRenewalReward) ?? false,
                disabled: busy,
                onChange: (e) => onChange("allowRenewalReward", e.target.checked)
              }
            ),
            /* @__PURE__ */ jsx("s-tooltip", { id: tooltipId, children: tooltipText }),
            /* @__PURE__ */ jsx("s-icon", { type: "info", tone: "info", interestFor: tooltipId })
          ] })
        ] }),
        showRenewalPoints && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
          /* @__PURE__ */ jsx(
            "s-number-field",
            {
              label: "Renewal Points",
              labelAccessibilityVisibility: "exclusive",
              suffix: "points",
              step: 1,
              min: 0,
              value: (val == null ? void 0 : val.renewalPoints) ?? "",
              disabled: busy,
              details: "Points earned each time the subscription renews.",
              onInput: (e) => onChange("renewalPoints", e.target.value ? Number(e.target.value) : 0)
            }
          )
        ] })
      ]
    }
  );
}
function IntervalCard({
  iv,
  idx,
  isSubscription,
  busy,
  onRemove,
  onInterval,
  onReferrer,
  onReferred,
  usedIntervals
}) {
  var _a2;
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsxs("strong", { children: [
            "Interval — ",
            ((_a2 = INTERVAL_OPTIONS.find((o) => o.value === iv.interval)) == null ? void 0 : _a2.label) ?? "Not selected"
          ] }) }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => onRemove(idx)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-select",
          {
            label: "Interval",
            labelAccessibilityVisibility: "exclusive",
            value: iv.interval,
            disabled: busy,
            onChange: (e) => onInterval(idx, e.target.value),
            children: INTERVAL_OPTIONS.map(({ value, label: label2 }) => {
              const usedByOther = usedIntervals.has(value) && value !== iv.interval;
              return /* @__PURE__ */ jsxs("s-option", { value, disabled: usedByOther || void 0, children: [
                label2,
                usedByOther ? " (added)" : ""
              ] }, value);
            })
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          PointsFields,
          {
            referrerVal: iv.referrer,
            referredVal: iv.referred,
            onReferrer: (field, value) => onReferrer(idx, field, value),
            onReferred: (field, value) => onReferred(idx, field, value),
            showRenewal: isSubscription,
            showRenewalToggle: isSubscription,
            tooltipPrefix: `interval-${idx}`,
            busy
          }
        )
      ]
    }
  ) });
}
function GroupCard({ group, groupIndex, isSubscription, busy, handlers }) {
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx(
            "s-text-field",
            {
              label: "Group Name",
              labelAccessibilityVisibility: "exclusive",
              value: group.name,
              disabled: busy,
              onInput: (e) => handlers.updateField(groupIndex, "name", e.target.value)
            }
          ),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => handlers.remove(groupIndex)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx(
          ProductList,
          {
            products: group.products ?? [],
            onPick: () => handlers.products.openPicker(groupIndex),
            onRemove: (productId) => handlers.products.remove(groupIndex, productId),
            busy
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: "Group Points" }) }),
          /* @__PURE__ */ jsx("s-badge", { tone: "info", children: "Default override" })
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          PointsFields,
          {
            referrerVal: group.referrer,
            referredVal: group.referred,
            onReferrer: (field, value) => handlers.updateReferrer(groupIndex, field, value),
            onReferred: (field, value) => handlers.updateReferred(groupIndex, field, value),
            showRenewal: isSubscription,
            showRenewalToggle: isSubscription,
            tooltipPrefix: `group-${groupIndex}`,
            busy
          }
        ),
        isSubscription && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsx("s-divider", {}),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", alignItems: "center", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: "Interval Overrides" }) }),
              /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "extra-small" }),
              /* @__PURE__ */ jsx("s-text", { tone: "subdued", style: { fontSize: "0.75rem" }, children: "Applied when subscription interval matches — overrides group points above." })
            ] }),
            /* @__PURE__ */ jsx(
              "s-button",
              {
                variant: "secondary",
                disabled: busy,
                onClick: () => handlers.intervals.add(groupIndex),
                children: "+ Add Interval"
              }
            )
          ] }),
          (group.intervals ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
            group.intervals.map((interval, intervalIndex) => /* @__PURE__ */ jsx(
              GroupIntervalCard,
              {
                interval,
                intervalIndex,
                groupIndex,
                isSubscription,
                busy,
                usedIntervals: new Set(
                  group.intervals.filter((_, index2) => index2 !== intervalIndex).map((item) => item.interval)
                ),
                handlers: handlers.intervals,
                onReferrer: handlers.intervals.updateReferrer,
                onReferred: handlers.intervals.updateReferred
              },
              intervalIndex
            ))
          ] })
        ] })
      ]
    }
  ) });
}
function GroupIntervalCard({
  interval,
  intervalIndex,
  groupIndex,
  isSubscription,
  busy,
  usedIntervals,
  handlers,
  onReferrer,
  onReferred
}) {
  var _a2;
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      borderStyle: "dashed",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsxs("strong", { children: [
            "Interval — ",
            ((_a2 = INTERVAL_OPTIONS.find((option) => option.value === interval.interval)) == null ? void 0 : _a2.label) ?? "Not selected"
          ] }) }),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              icon: "delete",
              tone: "critical",
              variant: "tertiary",
              disabled: busy,
              onClick: () => handlers.remove(groupIndex, intervalIndex)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-select",
          {
            label: "Interval",
            labelAccessibilityVisibility: "exclusive",
            value: interval.interval,
            disabled: busy,
            onChange: (e) => handlers.updateValue(groupIndex, intervalIndex, e.target.value),
            children: INTERVAL_OPTIONS.map(({ value, label: label2 }) => {
              const isUsedByOther = usedIntervals.has(value) && value !== interval.interval;
              return /* @__PURE__ */ jsxs("s-option", { value, disabled: isUsedByOther || void 0, children: [
                label2,
                isUsedByOther ? " (added)" : ""
              ] }, value);
            })
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          PointsFields,
          {
            referrerVal: interval.referrer,
            referredVal: interval.referred,
            onReferrer: (field, value) => onReferrer(groupIndex, intervalIndex, field, value),
            onReferred: (field, value) => onReferred(groupIndex, intervalIndex, field, value),
            showRenewal: isSubscription,
            showRenewalToggle: isSubscription,
            tooltipPrefix: `group-${groupIndex}-interval-${intervalIndex}`,
            busy
          }
        )
      ]
    }
  ) });
}
function SummaryPanel$1({ event, referral, isSubscription, isActive, onActiveChange, busy }) {
  const ref = referral.referrer;
  const referred = referral.referred;
  const friendDiscountLabel = referred.discountType === "percentage" ? `${referred.discountValue || 0}% off` : `$${referred.discountValue || 0} off`;
  const renewalText = (cfg) => isSubscription && (cfg == null ? void 0 : cfg.allowRenewalReward) ? ` + ${cfg.renewalPoints || 0} pts on every renewal` : "";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsx("s-heading", { children: "Summary" }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Event:" }),
        " ",
        (event == null ? void 0 : event.name) ?? "Referral"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Applies to:" }),
        " ",
        TRIGGER_DESCRIPTIONS[referral.trigger] ?? referral.trigger
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
        /* @__PURE__ */ jsxs("s-text", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Friend's discount:" }),
          " ",
          friendDiscountLabel,
          " on their first order"
        ] }),
        /* @__PURE__ */ jsx("s-badge", { tone: "info", children: "Always applies" })
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
      /* @__PURE__ */ jsx("s-divider", {}),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
      /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
        /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: "Default Rewards" }) }),
        /* @__PURE__ */ jsx("s-badge", { tone: "info", children: "Global" })
      ] }),
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Applies to every product, unless a product-group or subscription-renewal override matches." }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        "Referrer: ",
        ref.points || 0,
        " pts on first order",
        renewalText(ref)
      ] }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        "Friend: ",
        referred.points || 0,
        " pts on first order",
        renewalText(referred)
      ] }),
      isSubscription && (referral.intervals ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
          /* @__PURE__ */ jsx("s-heading", { children: "Subscription Renewal" }),
          /* @__PURE__ */ jsx("s-badge", { tone: "warning", children: "Global · Subscription only" })
        ] }),
        /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Replaces default rewards for products not in any group, based on renewal interval." }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        referral.intervals.map((iv, i) => {
          var _a2, _b;
          return /* @__PURE__ */ jsx("s-box", { children: /* @__PURE__ */ jsxs("s-text", { children: [
            getIntervalLabel(iv.interval),
            " — Referrer: ",
            ((_a2 = iv.referrer) == null ? void 0 : _a2.points) || 0,
            " pts, Friend: ",
            ((_b = iv.referred) == null ? void 0 : _b.points) || 0,
            " pts"
          ] }) }, i);
        })
      ] }),
      (referral.groups ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-divider", {}),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx("s-heading", { children: "Product Groups:" }),
        /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Replaces everything above for products placed in a group." }),
        referral.groups.map((group, gi) => {
          var _a2, _b;
          return /* @__PURE__ */ jsxs("s-box", { paddingBlockStart: "small", children: [
            /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
              /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: group.name || `Group ${gi + 1}` }) }),
              /* @__PURE__ */ jsx("s-badge", { tone: "success", children: "Group" })
            ] }),
            /* @__PURE__ */ jsxs("s-text", { tone: "subdued", children: [
              (group.products ?? []).length,
              " product",
              (group.products ?? []).length !== 1 ? "s" : ""
            ] }),
            /* @__PURE__ */ jsxs("s-text", { children: [
              "Referrer: ",
              ((_a2 = group.referrer) == null ? void 0 : _a2.points) || 0,
              " pts on first order",
              renewalText(group.referrer)
            ] }),
            /* @__PURE__ */ jsxs("s-text", { children: [
              "Friend: ",
              ((_b = group.referred) == null ? void 0 : _b.points) || 0,
              " pts on first order",
              renewalText(group.referred)
            ] }),
            isSubscription && (group.intervals ?? []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
              /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "small", alignItems: "center", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Renewal overrides for this group" }),
                /* @__PURE__ */ jsx("s-badge", { tone: "warning", children: "Group · Subscription only" })
              ] }),
              group.intervals.map((iv, ii) => {
                var _a3, _b2;
                return /* @__PURE__ */ jsx("s-box", { children: /* @__PURE__ */ jsxs("s-text", { children: [
                  getIntervalLabel(iv.interval),
                  " — Referrer: ",
                  ((_a3 = iv.referrer) == null ? void 0 : _a3.points) || 0,
                  " pts, Friend: ",
                  ((_b2 = iv.referred) == null ? void 0 : _b2.points) || 0,
                  " pts"
                ] }) }, ii);
              })
            ] })
          ] }, group.id ?? gi);
        })
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
      /* @__PURE__ */ jsx("s-divider", {}),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Status:" }),
        " ",
        isActive ? "Active ✅" : "Inactive ❌"
      ] })
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(ActiveToggle, { checked: isActive, onChange: onActiveChange, busy })
  ] });
}
const loader$d = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  const event = await prisma.event.findFirst({
    where: {
      sessionId: session.id,
      type: "REFERRAL",
      isActive: true
    }
  });
  if (!event) return redirect("/app/points-rules");
  if (ruleId) {
    const rule = await prisma.pointsRule.findUnique({
      where: {
        id: parseInt(ruleId)
      },
      include: {
        event: true
      }
    });
    if (!rule || rule.sessionId !== session.id) return redirect("/app/points-rules");
    return {
      rule,
      event,
      mode: "edit"
    };
  }
  return {
    rule: null,
    event,
    mode: "create"
  };
};
const action$k = async ({
  request
}) => {
  const {
    session,
    admin
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const payload = JSON.parse(formData.get("payload") || "{}");
  if (submitType === "createRule") {
    try {
      const event = await prisma.event.findFirst({
        where: {
          sessionId: session.id,
          type: "REFERRAL",
          isActive: true
        }
      });
      if (!event) return {
        message: "REFERRAL event not found.",
        status: "error",
        submitType
      };
      const existing = await prisma.pointsRule.findFirst({
        where: {
          eventId: event.id,
          sessionId: session.id
        }
      });
      if (existing) return {
        message: "A rule for this event already exists.",
        status: "error",
        submitType
      };
      const created = await prisma.pointsRule.create({
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions$1(payload.referral),
          session: {
            connect: {
              id: session.id
            }
          },
          event: {
            connect: {
              id: event.id
            }
          }
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule created successfully.",
        rule: created,
        status: "success",
        submitType
      };
    } catch (error) {
      console.error("Create REFERRAL Rule Error:", error);
      return {
        message: "Failed to create rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  if (submitType === "updateRule") {
    const ruleId = parseInt(formData.get("ruleId"));
    if (!ruleId) return {
      message: "Rule ID is required.",
      status: "error",
      submitType
    };
    try {
      const existing = await prisma.pointsRule.findUnique({
        where: {
          id: ruleId
        }
      });
      if (!existing || existing.sessionId !== session.id) return {
        message: "Rule not found or access denied.",
        status: "error",
        submitType
      };
      const rule = await prisma.pointsRule.update({
        where: {
          id: ruleId
        },
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions$1(payload.referral)
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule updated successfully.",
        rule,
        status: "success",
        submitType
      };
    } catch (error) {
      console.error("Update REFERRAL Rule Error:", error);
      return {
        message: "Failed to update rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  return {
    message: "Invalid action.",
    status: "error",
    submitType
  };
};
const route$6 = UNSAFE_withComponentProps(function ReferralRulePage() {
  const {
    rule,
    event,
    mode
  } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const isBusy = useSubmitBusy();
  const formState = useRuleForm(rule, buildFormShape$3, validate$3, "referral", mode);
  const referralHandlers = useReferralHandlers(formState);
  useToastRedirect(actionData);
  const referral = formState.form.referral;
  const isSubscription = referral.trigger === "subscription" || referral.trigger === "both";
  const isGlobalValid = Number(referral.referrer.points) > 0 && Number(referral.referred.points) > 0 && Number(referral.referred.discountValue) > 0;
  const usedGlobalIntervalValues = new Set((referral.intervals ?? []).map((interval) => interval.interval));
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsxs("s-page", {
      inlineSize: "base",
      children: [/* @__PURE__ */ jsx(PageHeader, {
        title: "Referral Rule",
        mode,
        isActive: formState.form.isActive,
        busy: isBusy
      }), /* @__PURE__ */ jsxs("s-grid", {
        gridTemplateColumns: "2fr 1fr",
        gap: "base",
        children: [/* @__PURE__ */ jsxs("s-box", {
          children: [/* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "When should rewards be given?"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Choose which types of orders trigger the referral reward."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "small"
            }), /* @__PURE__ */ jsxs("s-choice-list", {
              name: "referralTrigger",
              value: [referral.trigger],
              onInput: (e) => referralHandlers.trigger.change(e.currentTarget.values[0]),
              children: [/* @__PURE__ */ jsx("s-choice", {
                value: "oneTime",
                selected: referral.trigger === "oneTime",
                children: "One-time purchase only"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "subscription",
                selected: referral.trigger === "subscription",
                children: "Subscription orders only"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "both",
                selected: referral.trigger === "both",
                children: "Both — all order types"
              })]
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "New Customer Discount"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "The referred customer gets this discount on their first order. Never overridden."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "base"
            }), /* @__PURE__ */ jsxs("s-choice-list", {
              name: "discountType",
              value: [referral.referred.discountType],
              onInput: (e) => formState.set("referral.referred.discountType", e.currentTarget.values[0]),
              children: [/* @__PURE__ */ jsx("s-choice", {
                value: "fixed",
                selected: referral.referred.discountType === "fixed",
                children: "Fixed amount"
              }), /* @__PURE__ */ jsx("s-choice", {
                value: "percentage",
                selected: referral.referred.discountType === "percentage",
                children: "Percentage off"
              })]
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "base"
            }), /* @__PURE__ */ jsx("s-number-field", {
              label: "Discount Value",
              prefix: referral.referred.discountType === "fixed" ? "$" : "",
              suffix: referral.referred.discountType === "percentage" ? "%" : "",
              step: 1,
              min: 0,
              value: referral.referred.discountValue ?? "",
              disabled: isBusy,
              onInput: (e) => formState.set("referral.referred.discountValue", e.target.value ? Number(e.target.value) : 0)
            }), formState.errorFor("referral.referred.discountValue") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("referral.referred.discountValue")
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Points to Award"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Default amounts — overridden by groups or intervals below."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "base"
            }), /* @__PURE__ */ jsx(PointsFields, {
              referrerVal: referral.referrer,
              referredVal: referral.referred,
              onReferrer: (field, value) => formState.set(`referral.referrer.${field}`, value),
              onReferred: (field, value) => formState.set(`referral.referred.${field}`, value),
              showRenewal: isSubscription,
              showRenewalToggle: isSubscription,
              tooltipPrefix: "global",
              busy: isBusy
            }), formState.errorFor("referral.referrer.points") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("referral.referrer.points")
            }), formState.errorFor("referral.referred.points") && /* @__PURE__ */ jsx("s-text", {
              tone: "critical",
              children: formState.errorFor("referral.referred.points")
            })]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), isGlobalValid && isSubscription && /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsxs("s-grid", {
              gridTemplateColumns: "1fr auto",
              gap: "base",
              alignItems: "start",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("s-heading", {
                  children: "Reward by Subscription Frequency"
                }), /* @__PURE__ */ jsx("s-box", {
                  paddingBlockEnd: "small"
                }), /* @__PURE__ */ jsx("s-text", {
                  tone: "subdued",
                  children: "Custom points per billing frequency — applies to products not in any group."
                })]
              }), /* @__PURE__ */ jsx("s-button", {
                variant: "primary",
                disabled: isBusy,
                onClick: referralHandlers.intervals.add,
                children: "+ Add Interval"
              })]
            }), (referral.intervals ?? []).map((interval, intervalIndex) => /* @__PURE__ */ jsx(IntervalCard, {
              iv: interval,
              idx: intervalIndex,
              isSubscription,
              busy: isBusy,
              usedIntervals: usedGlobalIntervalValues,
              onRemove: referralHandlers.intervals.remove,
              onInterval: referralHandlers.intervals.updateValue,
              onReferrer: referralHandlers.intervals.updateReferrer,
              onReferred: referralHandlers.intervals.updateReferred
            }, intervalIndex))]
          }), isGlobalValid && /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), isGlobalValid && /* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsxs("s-grid", {
              gridTemplateColumns: "1fr auto",
              gap: "base",
              alignItems: "start",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("s-heading", {
                  children: "Product Groups"
                }), /* @__PURE__ */ jsx("s-box", {
                  paddingBlockEnd: "small"
                }), /* @__PURE__ */ jsx("s-text", {
                  tone: "subdued",
                  children: "Custom points for specific products — overrides defaults above."
                })]
              }), /* @__PURE__ */ jsx("s-button", {
                variant: "primary",
                disabled: isBusy,
                onClick: referralHandlers.groups.add,
                children: "+ Add Group"
              })]
            }), (referral.groups ?? []).map((group, groupIndex) => /* @__PURE__ */ jsx(GroupCard, {
              group,
              groupIndex,
              isSubscription,
              busy: isBusy,
              handlers: referralHandlers.groups
            }, group.id))]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsx(DescriptionField, {
            value: formState.form.description,
            onChange: (value) => formState.set("description", value),
            busy: isBusy
          })]
        }), /* @__PURE__ */ jsx("s-box", {
          children: /* @__PURE__ */ jsx(SummaryPanel$1, {
            event,
            referral,
            isSubscription,
            isActive: formState.form.isActive,
            onActiveChange: (value) => formState.set("isActive", value),
            busy: isBusy
          })
        })]
      }), formState.isDirty && /* @__PURE__ */ jsxs(Fragment, {
        children: [/* @__PURE__ */ jsx("s-box", {
          paddingBlock: "large"
        }), /* @__PURE__ */ jsx("s-box", {
          paddingBlock: "large"
        })]
      })]
    }), /* @__PURE__ */ jsx(SaveBar, {
      visible: mode === "create" || formState.isDirty,
      position: "bottom-center",
      message: mode === "edit" ? "You have unsaved changes" : "Ready to save your new rule",
      primaryLabel: mode === "edit" ? "Update Rule" : "Save Rule",
      secondaryLabel: mode === "edit" ? "Discard Changes" : "Cancel",
      onPrimary: formState.submit,
      onSecondary: () => mode === "edit" ? formState.reset() : navigate("/app/points-rules"),
      loading: isBusy,
      disabled: isBusy
    })]
  });
});
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$k,
  default: route$6,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
const REVIEW_TYPES = [
  { key: "text", label: "Text Review", description: "Written review without any media." },
  { key: "image", label: "Photo Review", description: "Review with at least one image attached." },
  { key: "video", label: "Video Review", description: "Review with a video attached." }
];
const REWARD_MODES = [
  {
    value: "once",
    label: "Once per product",
    description: "Customer earns points once per product, regardless of review type."
  },
  {
    value: "per_type",
    label: "Once per review type",
    description: "Customer earns points separately for text, photo, and video — once each."
  },
  {
    value: "unlimited",
    label: "Every submission",
    description: "Every review submission earns points, no limits."
  }
];
function buildConditions(review) {
  var _a2, _b, _c, _d, _e, _f;
  return {
    review: {
      text: {
        isActive: Boolean(((_a2 = review.text) == null ? void 0 : _a2.isActive) ?? true),
        points: Number(((_b = review.text) == null ? void 0 : _b.points) ?? 0)
      },
      image: {
        isActive: Boolean(((_c = review.image) == null ? void 0 : _c.isActive) ?? true),
        points: Number(((_d = review.image) == null ? void 0 : _d.points) ?? 0)
      },
      video: {
        isActive: Boolean(((_e = review.video) == null ? void 0 : _e.isActive) ?? true),
        points: Number(((_f = review.video) == null ? void 0 : _f.points) ?? 0)
      },
      // "once" | "per_type" | "unlimited"
      rewardMode: review.rewardMode ?? "per_type"
    }
  };
}
function buildFormShape$2(data) {
  var _a2, _b, _c, _d, _e, _f, _g;
  const review = ((_a2 = data == null ? void 0 : data.conditions) == null ? void 0 : _a2.review) ?? {};
  return {
    name: str(data == null ? void 0 : data.name),
    description: str(data == null ? void 0 : data.description),
    isActive: bool((data == null ? void 0 : data.isActive) ?? true),
    review: {
      text: { isActive: bool(((_b = review == null ? void 0 : review.text) == null ? void 0 : _b.isActive) ?? true), points: num(((_c = review == null ? void 0 : review.text) == null ? void 0 : _c.points) ?? 10) },
      image: { isActive: bool(((_d = review == null ? void 0 : review.image) == null ? void 0 : _d.isActive) ?? true), points: num(((_e = review == null ? void 0 : review.image) == null ? void 0 : _e.points) ?? 20) },
      video: { isActive: bool(((_f = review == null ? void 0 : review.video) == null ? void 0 : _f.isActive) ?? true), points: num(((_g = review == null ? void 0 : review.video) == null ? void 0 : _g.points) ?? 30) },
      rewardMode: str((review == null ? void 0 : review.rewardMode) ?? "per_type")
    }
  };
}
function validate$2(form2) {
  const errors = {};
  const review = form2.review;
  const anyActive = review.text.isActive || review.image.isActive || review.video.isActive;
  if (!anyActive) {
    errors["review.types"] = "At least one review type must be enabled.";
  }
  if (review.text.isActive && (!review.text.points || Number(review.text.points) <= 0)) {
    errors["review.text.points"] = "Text review points must be greater than 0.";
  }
  if (review.image.isActive && (!review.image.points || Number(review.image.points) <= 0)) {
    errors["review.image.points"] = "Photo review points must be greater than 0.";
  }
  if (review.video.isActive && (!review.video.points || Number(review.video.points) <= 0)) {
    errors["review.video.points"] = "Video review points must be greater than 0.";
  }
  return errors;
}
function ReviewTypeCard({ typeKey, label: label2, description, val, error, busy, onToggle, onPoints }) {
  return /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs(
    "s-box",
    {
      padding: "base",
      background: "base",
      borderWidth: "base",
      borderColor: "base",
      borderRadius: "base",
      borderStyle: "dashed",
      style: { marginBlockEnd: "var(--s-space-base)" },
      children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", alignItems: "center", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("s-text", { children: /* @__PURE__ */ jsx("strong", { children: label2 }) }),
            /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
            /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: description })
          ] }),
          /* @__PURE__ */ jsx(
            "s-switch",
            {
              labelAccessibilityVisibility: "exclusion",
              label: val.isActive ? "Enabled" : "Disabled",
              checked: val.isActive,
              disabled: busy,
              onChange: (e) => onToggle(e.target.checked)
            }
          )
        ] }),
        val.isActive && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsx(
            "s-number-field",
            {
              label: "Points",
              labelAccessibilityVisibility: "exclusive",
              suffix: "points",
              step: 1,
              min: 1,
              value: val.points ?? "",
              disabled: busy,
              onInput: (e) => onPoints(e.target.value ? Number(e.target.value) : 0)
            }
          ),
          error && /* @__PURE__ */ jsx("s-text", { tone: "critical", children: error })
        ] })
      ]
    }
  ) });
}
function RewardModeSelector({ value, busy, onChange }) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("s-heading", { children: "Reward Mode" }),
    /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Controls how many times a customer can earn review points per product." }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsx(
      "s-choice-list",
      {
        name: "rewardMode",
        value: [value],
        onInput: (e) => onChange(e.currentTarget.values[0]),
        children: REWARD_MODES.map(({ value: v, label: label2, description }) => /* @__PURE__ */ jsxs("s-choice", { value: v, selected: value === v, disabled: busy, children: [
          label2,
          /* @__PURE__ */ jsx("span", { slot: "description", children: description })
        ] }, v))
      }
    )
  ] });
}
function SummaryPanel({ event, review, isActive, onActiveChange, busy }) {
  var _a2;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsx("s-heading", { children: "Summary" }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Event:" }),
        " ",
        (event == null ? void 0 : event.name) ?? "Review"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      REVIEW_TYPES.map(({ key, label: label2 }) => /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small", children: /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsxs("strong", { children: [
          label2,
          ":"
        ] }),
        " ",
        review[key].isActive ? `${review[key].points || 0} pts` : /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Disabled" })
      ] }) }, key)),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Reward Mode:" }),
        " ",
        ((_a2 = REWARD_MODES.find((m) => m.value === review.rewardMode)) == null ? void 0 : _a2.label) ?? review.rewardMode
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Status:" }),
        " ",
        isActive ? "Active ✅" : "Inactive ❌"
      ] })
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(ActiveToggle, { checked: isActive, onChange: onActiveChange, busy })
  ] });
}
const loader$c = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  const event = await prisma.event.findFirst({
    where: {
      sessionId: session.id,
      type: "REVIEW",
      isActive: true
    }
  });
  if (!event) return redirect("/app/points-rules");
  if (ruleId) {
    const rule = await prisma.pointsRule.findUnique({
      where: {
        id: parseInt(ruleId)
      },
      include: {
        event: true
      }
    });
    if (!rule || rule.sessionId !== session.id) return redirect("/app/points-rules");
    return {
      rule,
      event,
      mode: "edit"
    };
  }
  return {
    rule: null,
    event,
    mode: "create"
  };
};
const action$j = async ({
  request
}) => {
  const {
    session,
    admin
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const payload = JSON.parse(formData.get("payload") || "{}");
  if (submitType === "createRule") {
    try {
      const event = await prisma.event.findFirst({
        where: {
          sessionId: session.id,
          type: "REVIEW",
          isActive: true
        }
      });
      if (!event) return {
        message: "REVIEW event not found.",
        status: "error",
        submitType
      };
      const existing = await prisma.pointsRule.findFirst({
        where: {
          eventId: event.id,
          sessionId: session.id
        }
      });
      if (existing) return {
        message: "A rule for this event already exists.",
        status: "error",
        submitType
      };
      const created = await prisma.pointsRule.create({
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions(payload.review),
          session: {
            connect: {
              id: session.id
            }
          },
          event: {
            connect: {
              id: event.id
            }
          }
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule created successfully.",
        rule: created,
        status: "success",
        submitType
      };
    } catch (err) {
      console.error("Create REVIEW Rule Error:", err);
      return {
        message: "Failed to create rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  if (submitType === "updateRule") {
    const ruleId = parseInt(formData.get("ruleId"));
    if (!ruleId) return {
      message: "Rule ID is required.",
      status: "error",
      submitType
    };
    try {
      const existing = await prisma.pointsRule.findUnique({
        where: {
          id: ruleId
        }
      });
      if (!existing || existing.sessionId !== session.id) return {
        message: "Rule not found or access denied.",
        status: "error",
        submitType
      };
      const rule = await prisma.pointsRule.update({
        where: {
          id: ruleId
        },
        data: {
          name: payload.name || null,
          description: payload.description || null,
          isActive: payload.isActive ?? true,
          conditions: buildConditions(payload.review)
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Points rule updated successfully.",
        rule,
        status: "success",
        submitType
      };
    } catch (err) {
      console.error("Update REVIEW Rule Error:", err);
      return {
        message: "Failed to update rule. Please try again.",
        status: "error",
        submitType
      };
    }
  }
  return {
    message: "Invalid action.",
    status: "error",
    submitType
  };
};
const route$5 = UNSAFE_withComponentProps(function ReviewRulePage() {
  const {
    rule,
    event,
    mode
  } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const busy = useSubmitBusy();
  const fs = useRuleForm(rule, buildFormShape$2, validate$2, "review", mode);
  useToastRedirect(actionData);
  const review = fs.form.review;
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsxs("s-page", {
      inlineSize: "base",
      children: [/* @__PURE__ */ jsx(PageHeader, {
        title: "Review Rule",
        mode,
        isActive: fs.form.isActive,
        busy
      }), /* @__PURE__ */ jsxs("s-grid", {
        gridTemplateColumns: "2fr 1fr",
        gap: "base",
        children: [/* @__PURE__ */ jsxs("s-box", {
          children: [/* @__PURE__ */ jsxs("s-section", {
            children: [/* @__PURE__ */ jsx("s-heading", {
              children: "Review Types & Points"
            }), /* @__PURE__ */ jsx("s-text", {
              tone: "subdued",
              children: "Enable or disable each type and set how many points it earns."
            }), /* @__PURE__ */ jsx("s-box", {
              paddingBlockEnd: "base"
            }), fs.errorFor("review.types") && /* @__PURE__ */ jsxs(Fragment, {
              children: [/* @__PURE__ */ jsx("s-text", {
                tone: "critical",
                children: fs.errorFor("review.types")
              }), /* @__PURE__ */ jsx("s-box", {
                paddingBlockEnd: "small"
              })]
            }), REVIEW_TYPES.map(({
              key,
              label: label2,
              description
            }) => /* @__PURE__ */ jsx(ReviewTypeCard, {
              typeKey: key,
              label: label2,
              description,
              val: review[key],
              error: fs.errorFor(`review.${key}.points`),
              busy,
              onToggle: (v) => fs.set(`review.${key}.isActive`, v),
              onPoints: (v) => fs.set(`review.${key}.points`, v)
            }, key))]
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsx(RewardModeSelector, {
            value: review.rewardMode,
            busy,
            onChange: (v) => fs.set("review.rewardMode", v)
          }), /* @__PURE__ */ jsx("s-box", {
            paddingBlockEnd: "base"
          }), /* @__PURE__ */ jsx(DescriptionField, {
            value: fs.form.description,
            onChange: (v) => fs.set("description", v),
            busy
          })]
        }), /* @__PURE__ */ jsx("s-box", {
          children: /* @__PURE__ */ jsx(SummaryPanel, {
            event,
            review,
            isActive: fs.form.isActive,
            onActiveChange: (v) => fs.set("isActive", v),
            busy
          })
        })]
      })]
    }), /* @__PURE__ */ jsx(SaveBar, {
      visible: mode === "create" || fs.isDirty,
      position: "bottom-center",
      message: mode === "edit" ? "You have unsaved changes" : "Ready to save your new rule",
      primaryLabel: mode === "edit" ? "Update Rule" : "Save Rule",
      secondaryLabel: mode === "edit" ? "Discard Changes" : "Cancel",
      onPrimary: fs.submit,
      onSecondary: () => mode === "edit" ? fs.reset() : navigate("/app/points-rules"),
      loading: busy,
      disabled: busy
    })]
  });
});
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$j,
  default: route$5,
  loader: loader$c
}, Symbol.toStringTag, { value: "Module" }));
const EMPTY_RULE = {
  id: null,
  title: "Voucher {{currency_value}}",
  description: null,
  discountType: "fixed",
  // "fixed" | "percentage"
  rewardValue: 5,
  rewardType: "orderDiscount",
  // "orderDiscount" | "productDiscount" | "freeProduct" | "freeShipping"
  pointsCost: 100,
  isActive: true,
  startDate: null,
  endDate: null
};
function buildFormShape$1(data) {
  return {
    id: (data == null ? void 0 : data.id) ?? null,
    title: str((data == null ? void 0 : data.title) ?? EMPTY_RULE.title),
    description: str(data == null ? void 0 : data.description),
    discountType: str((data == null ? void 0 : data.discountType) ?? EMPTY_RULE.discountType),
    rewardValue: num((data == null ? void 0 : data.rewardValue) ?? EMPTY_RULE.rewardValue),
    rewardType: str((data == null ? void 0 : data.rewardType) ?? EMPTY_RULE.rewardType),
    pointsCost: num((data == null ? void 0 : data.pointsCost) ?? EMPTY_RULE.pointsCost),
    isActive: bool((data == null ? void 0 : data.isActive) ?? true),
    startDate: (data == null ? void 0 : data.startDate) ?? null,
    endDate: (data == null ? void 0 : data.endDate) ?? null
  };
}
function validate$1(form2) {
  var _a2;
  const errors = {};
  if (!form2.rewardType)
    errors.rewardType = "Please select a reward type.";
  if (!((_a2 = form2.title) == null ? void 0 : _a2.trim()))
    errors.title = "Display title is required.";
  if (!form2.pointsCost || Number(form2.pointsCost) <= 0)
    errors.pointsCost = "Points cost must be greater than 0.";
  if (form2.rewardType === "orderDiscount" && !(Number(form2.rewardValue) > 0))
    errors.rewardValue = "Discount value must be greater than 0.";
  return errors;
}
const previewTitle = (title, discountType, rewardValue) => {
  if (!title) return "";
  const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
  return title.replace(/\{\{currency_value\}\}/gi, formatted);
};
const formatDiscount = (discountType, rewardValue) => discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
const PER_PAGE$2 = 10;
function useRewardRulesPage(loaderData, actionData) {
  var _a2;
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const [view, setView] = useState("list");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pendingSubmitType = ((_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType")) ?? null;
  const isSubmitting = navigation.state === "submitting";
  const isSaving = isSubmitting && pendingSubmitType === "addRule";
  const isUpdating = isSubmitting && pendingSubmitType === "updateRule";
  const isDeleting = isSubmitting && pendingSubmitType === "deleteRule";
  const isAnyBusy = isSubmitting;
  const busy = isSaving || isUpdating;
  const fs = useFormState(EMPTY_RULE, buildFormShape$1, { validate: validate$1 });
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
    if (actionData.status === "success") {
      if (actionData.submitType === "addRule" || actionData.submitType === "updateRule") {
        setView("list");
        fs.reset();
      }
      if (actionData.submitType === "deleteRule") {
        setDeleteTarget(null);
      }
    }
  }, [actionData, shopify2]);
  const rules = (loaderData == null ? void 0 : loaderData.rewardRules) ?? [];
  useEffect(() => {
    setCurrentPage(1);
  }, [rules.length]);
  const totalPages = Math.max(1, Math.ceil(rules.length / PER_PAGE$2));
  const paginatedRules = rules.slice((currentPage - 1) * PER_PAGE$2, currentPage * PER_PAGE$2);
  const titlePreview = previewTitle(fs.form.title, fs.form.discountType, fs.form.rewardValue);
  const goToCreate = useCallback(() => {
    fs.syncAfterSave(EMPTY_RULE);
    setView("create");
  }, [fs]);
  const goToEdit = useCallback((r) => {
    fs.syncAfterSave(r);
    setView("edit");
  }, [fs]);
  const goToList = useCallback(() => {
    setView("list");
    fs.reset();
  }, [fs]);
  const handleSave = useCallback(async () => {
    const valid = await fs.submit();
    if (!valid) return;
    submit({ submitType: "addRule", rule: JSON.stringify(fs.form) }, { method: "post" });
  }, [fs, submit]);
  const handleUpdate2 = useCallback(async () => {
    const valid = await fs.submit();
    if (!valid) return;
    submit({ submitType: "updateRule", rule: JSON.stringify(fs.form) }, { method: "post" });
  }, [fs, submit]);
  const handleDelete2 = useCallback(() => {
    if (!deleteTarget) return;
    submit({ submitType: "deleteRule", ruleId: deleteTarget.id }, { method: "post" });
  }, [deleteTarget, submit]);
  return {
    fs,
    view,
    rules,
    paginatedRules,
    currentPage,
    totalPages,
    setCurrentPage,
    isSaving,
    isUpdating,
    isDeleting,
    isAnyBusy,
    busy,
    titlePreview,
    deleteTarget,
    setDeleteTarget,
    goToCreate,
    goToEdit,
    goToList,
    handleSave,
    handleUpdate: handleUpdate2,
    handleDelete: handleDelete2
  };
}
const resolveTitlePlaceholder = (title, discountType, rewardValue) => {
  if (!title) return title;
  const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
  return title.replace(/\{\{currency_value\}\}/gi, formatted);
};
async function handleAddRule({ formData, session, admin }) {
  var _a2;
  const submitType = "addRule";
  const newRule = JSON.parse(formData.get("rule") || "{}");
  if (!newRule.rewardType)
    return { message: "Please select a reward type.", status: "error", submitType };
  if (!((_a2 = newRule.title) == null ? void 0 : _a2.trim()))
    return { message: "Display title is required.", status: "error", submitType };
  if (!newRule.pointsCost || Number(newRule.pointsCost) <= 0)
    return { message: "Points cost must be greater than 0.", status: "error", submitType };
  try {
    const resolvedTitle = resolveTitlePlaceholder(newRule.title, newRule.discountType, newRule.rewardValue);
    const created = await prisma.rewardRule.create({
      data: {
        title: resolvedTitle,
        description: newRule.description || null,
        discountType: newRule.discountType,
        rewardValue: Number(newRule.rewardValue) || 0,
        rewardType: newRule.rewardType,
        pointsCost: Number(newRule.pointsCost),
        isActive: newRule.isActive ?? true,
        startDate: newRule.startDate ? new Date(newRule.startDate) : null,
        endDate: newRule.endDate ? new Date(newRule.endDate) : null,
        session: { connect: { id: session.id } }
      }
    });
    await syncAppConfig(admin);
    return { message: "Reward rule created successfully.", rule: created, status: "success", submitType };
  } catch (err) {
    console.error("Create RewardRule Error:", err);
    return { message: "Failed to create reward rule. Please try again.", status: "error", submitType };
  }
}
async function handleUpdateRule({ formData, session, admin }) {
  var _a2;
  const submitType = "updateRule";
  const updatedRule = JSON.parse(formData.get("rule") || "{}");
  if (!updatedRule.id)
    return { message: "Rule ID is required.", status: "error", submitType };
  if (!updatedRule.rewardType)
    return { message: "Please select a reward type.", status: "error", submitType };
  if (!((_a2 = updatedRule.title) == null ? void 0 : _a2.trim()))
    return { message: "Display title is required.", status: "error", submitType };
  if (!updatedRule.pointsCost || Number(updatedRule.pointsCost) <= 0)
    return { message: "Points cost must be greater than 0.", status: "error", submitType };
  try {
    const existing = await prisma.rewardRule.findUnique({ where: { id: parseInt(updatedRule.id) } });
    if (!existing || existing.sessionId !== session.id)
      return { message: "Rule not found or access denied.", status: "error", submitType };
    const resolvedTitle = resolveTitlePlaceholder(updatedRule.title, updatedRule.discountType, updatedRule.rewardValue);
    const rule = await prisma.rewardRule.update({
      where: { id: parseInt(updatedRule.id) },
      data: {
        title: resolvedTitle,
        description: updatedRule.description || null,
        discountType: updatedRule.discountType,
        rewardValue: Number(updatedRule.rewardValue) || 0,
        rewardType: updatedRule.rewardType,
        pointsCost: Number(updatedRule.pointsCost),
        isActive: updatedRule.isActive ?? true,
        startDate: updatedRule.startDate ? new Date(updatedRule.startDate) : null,
        endDate: updatedRule.endDate ? new Date(updatedRule.endDate) : null
      }
    });
    await syncAppConfig(admin);
    return { message: "Reward rule updated successfully.", rule, status: "success", submitType };
  } catch (err) {
    console.error("Update RewardRule Error:", err);
    return { message: "Failed to update reward rule. Please try again.", status: "error", submitType };
  }
}
async function handleDeleteRule({ formData, session, admin }) {
  const submitType = "deleteRule";
  const ruleId = parseInt(formData.get("ruleId"));
  if (!ruleId)
    return { message: "Rule ID is required.", status: "error", submitType };
  try {
    const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.sessionId !== session.id)
      return { message: "Rule not found or access denied.", status: "error", submitType };
    await prisma.rewardRule.delete({ where: { id: ruleId } });
    await syncAppConfig(admin);
    return { message: "Reward rule deleted successfully.", status: "success", submitType };
  } catch (err) {
    console.error("Delete RewardRule Error:", err);
    return { message: err.message || "Failed to delete rule. Please try again.", status: "error", submitType };
  }
}
function PageHeading$2({
  view,
  fs,
  isAnyBusy,
  isSaving,
  isUpdating,
  onCreate,
  onCancel,
  onSave,
  onUpdate
}) {
  var _a2;
  if (view === "list") {
    return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
      /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: "Reward Rules" }),
      /* @__PURE__ */ jsx("s-button", { variant: "primary", onClick: onCreate, disabled: isAnyBusy, children: "Create New Rule" })
    ] });
  }
  const isEdit = view === "edit";
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          onClick: onCancel,
          disabled: isAnyBusy,
          style: { padding: 0, minHeight: "unset" },
          children: "Rules"
        }
      ),
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "›" }),
      /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: isEdit ? "Edit Rule" : "Create New Rule" })
    ] }),
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
      /* @__PURE__ */ jsx("s-button", { onClick: onCancel, disabled: isAnyBusy, children: "Cancel" }),
      isEdit ? /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "primary",
          onClick: onUpdate,
          loading: isUpdating,
          disabled: isUpdating || !fs.isDirty,
          children: "Update Rule"
        }
      ) : /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "primary",
          onClick: onSave,
          loading: isSaving,
          disabled: isSaving || !fs.form.rewardType || !((_a2 = fs.form.title) == null ? void 0 : _a2.trim()),
          children: "Save Rule"
        }
      )
    ] })
  ] });
}
function RulesTable({
  paginatedRules,
  isAnyBusy,
  currentPage,
  totalPages,
  setCurrentPage,
  onEdit,
  onDelete
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Title" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points Cost" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Discount Type" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Value" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Active" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: paginatedRules.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "6", style: { textAlign: "center", padding: "3rem" }, children: 'No reward rules yet. Click "Create New Rule" to get started.' }) }) : paginatedRules.map((r) => /* @__PURE__ */ jsxs("s-table-row", { children: [
        /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-heading", { children: previewTitle(r.title, r.discountType, r.rewardValue) }) }),
        /* @__PURE__ */ jsxs("s-table-cell", { children: [
          r.pointsCost,
          " pts"
        ] }),
        /* @__PURE__ */ jsx("s-table-cell", { children: r.discountType }),
        /* @__PURE__ */ jsx("s-table-cell", { children: formatDiscount(r.discountType, r.rewardValue) }),
        /* @__PURE__ */ jsx("s-table-cell", { children: r.isActive ? "✅ Yes" : "❌ No" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { gap: "small", direction: "inline", children: [
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "edit",
              disabled: isAnyBusy,
              onClick: () => onEdit(r)
            }
          ),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "delete",
              destructive: true,
              disabled: isAnyBusy,
              onClick: () => onDelete(r),
              commandFor: "delete-reward-modal",
              command: "--show"
            }
          )
        ] }) })
      ] }, r.id)) })
    ] }),
    totalPages > 1 && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", justifyContent: "center", gap: "small", style: { marginBlockStart: "1rem" }, children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === 1 || isAnyBusy,
          onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
          children: "← Prev"
        }
      ),
      /* @__PURE__ */ jsxs("s-text", { children: [
        "Page ",
        currentPage,
        " of ",
        totalPages
      ] }),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === totalPages || isAnyBusy,
          onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
          children: "Next →"
        }
      )
    ] })
  ] });
}
function RewardRuleForm({ fs, busy, titlePreview }) {
  var _a2;
  const { form: form2 } = fs;
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "2fr 1fr", gap: "base", children: [
    /* @__PURE__ */ jsxs("s-box", { children: [
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx(
        "s-select",
        {
          label: "Reward Type",
          placeholder: "Select reward type",
          value: form2.rewardType,
          disabled: busy,
          error: fs.errorFor("rewardType") ?? void 0,
          onInput: (e) => fs.set("rewardType", e.target.value),
          onBlur: () => fs.touchField("rewardType"),
          children: /* @__PURE__ */ jsx("s-option", { value: "orderDiscount", children: "Order Discount — discount the total order amount" })
        }
      ) }) }),
      form2.rewardType === "orderDiscount" && /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs("s-section", { children: [
        /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "2fr 1fr", gap: "base", children: [
          /* @__PURE__ */ jsxs(
            "s-select",
            {
              label: `Discount Type (${form2.discountType})`,
              value: form2.discountType,
              disabled: busy,
              onInput: (e) => fs.set("discountType", e.target.value),
              children: [
                /* @__PURE__ */ jsx("s-option", { value: "fixed", children: "Fixed Amount" }),
                /* @__PURE__ */ jsx("s-option", { value: "percentage", children: "Percentage" })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "s-number-field",
            {
              label: "Value",
              prefix: form2.discountType === "fixed" ? "$" : "",
              suffix: form2.discountType === "percentage" ? "%" : "",
              step: 1,
              min: 0,
              value: form2.rewardValue ?? "",
              disabled: busy,
              error: fs.errorFor("rewardValue") ?? void 0,
              onInput: (e) => fs.set("rewardValue", Number(e.target.value)),
              onBlur: () => fs.touchField("rewardValue")
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
        /* @__PURE__ */ jsx(
          "s-number-field",
          {
            label: "Points Cost",
            suffix: "points",
            step: 1,
            min: 1,
            value: form2.pointsCost ?? "",
            disabled: busy,
            error: fs.errorFor("pointsCost") ?? void 0,
            onInput: (e) => fs.set("pointsCost", e.target.value),
            onBlur: () => fs.touchField("pointsCost")
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs("s-section", { children: [
        /* @__PURE__ */ jsx(
          "s-text-field",
          {
            label: "Display Title",
            placeholder: "e.g. Voucher {{currency_value}}",
            value: form2.title ?? "",
            disabled: busy,
            details: "Use {{currency_value}} to auto-insert the formatted discount amount.",
            error: fs.errorFor("title") ?? void 0,
            onInput: (e) => fs.set("title", e.target.value),
            onBlur: () => fs.touchField("title")
          }
        ),
        ((_a2 = form2.title) == null ? void 0 : _a2.includes("{{currency_value}}")) && /* @__PURE__ */ jsx("s-box", { paddingBlockStart: "small", children: /* @__PURE__ */ jsxs("s-text", { tone: "subdued", children: [
          "Preview: ",
          titlePreview
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx(
        "s-text-area",
        {
          label: "Description",
          placeholder: "Describe this reward rule...",
          value: form2.description ?? "",
          rows: 3,
          disabled: busy,
          onInput: (e) => fs.set("description", e.target.value)
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs("s-box", { children: [
      /* @__PURE__ */ jsxs("s-section", { children: [
        /* @__PURE__ */ jsx("s-heading", { children: "Summary" }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        form2.rewardType ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("s-text", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Type:" }),
            " ",
            form2.rewardType
          ] }),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
          /* @__PURE__ */ jsxs("s-text", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Discount:" }),
            " ",
            formatDiscount(form2.discountType, form2.rewardValue)
          ] }),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
          /* @__PURE__ */ jsxs("s-text", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Cost:" }),
            " ",
            form2.pointsCost,
            " points"
          ] }),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
          /* @__PURE__ */ jsxs("s-text", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Status:" }),
            " ",
            form2.isActive ? "Active ✅" : "Inactive ❌"
          ] })
        ] }) : /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "Select a reward type to see a summary." })
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
      /* @__PURE__ */ jsxs("s-section", { children: [
        /* @__PURE__ */ jsx("s-heading", { children: "Active Status" }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
        /* @__PURE__ */ jsx(
          "s-switch",
          {
            labelAccessibilityVisibility: "exclusion",
            label: form2.isActive ? "Active" : "Inactive",
            checked: form2.isActive,
            disabled: busy,
            onChange: (e) => fs.set("isActive", e.target.checked)
          }
        )
      ] })
    ] })
  ] });
}
function DeleteRuleModal({ deleteTarget, isDeleting, onConfirm }) {
  return /* @__PURE__ */ jsxs("s-modal", { id: "delete-reward-modal", heading: "Delete Reward Rule", size: "small", children: [
    /* @__PURE__ */ jsxs("s-paragraph", { color: "subdued", children: [
      "Are you sure you want to delete",
      " ",
      /* @__PURE__ */ jsx("strong", { children: previewTitle(deleteTarget == null ? void 0 : deleteTarget.title, deleteTarget == null ? void 0 : deleteTarget.discountType, deleteTarget == null ? void 0 : deleteTarget.rewardValue) }),
      "? This action cannot be undone."
    ] }),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "secondary-actions",
        commandFor: "delete-reward-modal",
        command: "--hide",
        disabled: isDeleting,
        children: "Cancel"
      }
    ),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "primary-action",
        variant: "primary",
        destructive: true,
        onClick: onConfirm,
        commandFor: "delete-reward-modal",
        command: "--hide",
        loading: isDeleting,
        disabled: isDeleting,
        children: "Yes, Delete"
      }
    )
  ] });
}
const loader$b = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const rewardRules = await prisma.rewardRule.findMany({
    where: {
      sessionId: session.id
    },
    orderBy: [{
      priority: "asc"
    }, {
      createdAt: "desc"
    }]
  });
  return {
    rewardRules
  };
};
const action$i = async ({
  request
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const ctx = {
    formData,
    session,
    admin
  };
  switch (submitType) {
    case "addRule":
      return handleAddRule(ctx);
    case "updateRule":
      return handleUpdateRule(ctx);
    case "deleteRule":
      return handleDeleteRule(ctx);
    default:
      return {
        message: "Invalid action.",
        status: "error",
        submitType
      };
  }
};
const route$4 = UNSAFE_withComponentProps(function RewardRulesPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = useRewardRulesPage(loaderData, actionData);
  return /* @__PURE__ */ jsxs("s-page", {
    inlineSize: "base",
    children: [/* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsx(PageHeading$2, {
        view: page.view,
        fs: page.fs,
        isAnyBusy: page.isAnyBusy,
        isSaving: page.isSaving,
        isUpdating: page.isUpdating,
        onCreate: page.goToCreate,
        onCancel: page.goToList,
        onSave: page.handleSave,
        onUpdate: page.handleUpdate
      })
    }), page.view === "list" && /* @__PURE__ */ jsx(RulesTable, {
      paginatedRules: page.paginatedRules,
      isAnyBusy: page.isAnyBusy,
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      setCurrentPage: page.setCurrentPage,
      onEdit: page.goToEdit,
      onDelete: page.setDeleteTarget
    }), (page.view === "create" || page.view === "edit") && /* @__PURE__ */ jsx(RewardRuleForm, {
      fs: page.fs,
      busy: page.busy,
      titlePreview: page.titlePreview
    }), /* @__PURE__ */ jsx(DeleteRuleModal, {
      deleteTarget: page.deleteTarget,
      isDeleting: page.isDeleting,
      onConfirm: page.handleDelete
    })]
  });
});
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$i,
  default: route$4,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const DEFAULT_MAX_SIZE = 20 * 1024 * 1024;
const RESOURCE_TYPE_RULES = [
  ["model/gltf-binary", "MODEL_3D"],
  ["model/gltf+json", "MODEL_3D"],
  ["model/", "MODEL_3D"],
  ["video/", "VIDEO"],
  ["image/", "IMAGE"]
];
const CONTENT_TYPE_RULES = [
  ["model/", "FILE"],
  // 3D models → GenericFile in fileCreate
  ["video/", "VIDEO"],
  ["image/", "IMAGE"]
];
const SHOPIFY_UPLOAD_ERROR_CODES = Object.freeze({
  /** formData.get() returned a string or null instead of a File */
  INVALID_INPUT: "INVALID_INPUT",
  /** File size === 0 */
  EMPTY_FILE: "EMPTY_FILE",
  /** File exceeds maxSize */
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  /** Total batch exceeds maxTotalSize */
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  /** Number of files exceeds maxFiles */
  TOO_MANY_FILES: "TOO_MANY_FILES",
  /** MIME type not in allowedTypes whitelist */
  INVALID_TYPE: "INVALID_TYPE",
  /** File extension not in allowedExtensions whitelist */
  INVALID_EXTENSION: "INVALID_EXTENSION",
  /** atomic:true — batch rejected because at least one file failed validation */
  ATOMIC_BATCH_REJECTED: "ATOMIC_BATCH_REJECTED",
  /** stagedUploadsCreate GraphQL mutation returned userErrors or empty targets */
  SHOPIFY_STAGE_ERROR: "SHOPIFY_STAGE_ERROR",
  /** fetch() to S3 pre-signed URL failed (network error or non-2xx status) */
  S3_UPLOAD_ERROR: "S3_UPLOAD_ERROR",
  /** fileCreate GraphQL mutation returned userErrors */
  SHOPIFY_REGISTER_ERROR: "SHOPIFY_REGISTER_ERROR",
  /** shopifyPollFileStatus: file never reached READY within max attempts */
  POLL_TIMEOUT: "POLL_TIMEOUT",
  /** shopifyPollFileStatus: Shopify reported fileStatus === FAILED */
  POLL_FAILED: "POLL_FAILED"
});
const STAGED_UPLOADS_CREATE_MUTATION = `#graphql
    # API: 2026-04 | Scope: write_files
    # https://shopify.dev/docs/api/admin-graphql/latest/mutations/stageduploadscreate
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
            stagedTargets {
                url
                resourceUrl
                parameters {
                    name
                    value
                }
            }
            userErrors {
                field
                message
            }
        }
    }
`;
const FILE_CREATE_MUTATION = `#graphql
    # API: 2026-04 | Scope: write_files
    # https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
    # ⚠️  Files are processed ASYNC. Poll fileStatus until READY before use.
    mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
            files {
                id
                fileStatus
                createdAt
                alt
                ... on MediaImage {
                    id
                    fileStatus
                    image {
                        url
                        width
                        height
                        altText
                    }
                }
                ... on Video {
                    id
                    fileStatus
                    sources {
                        url
                        mimeType
                        format
                        height
                        width
                    }
                }
                ... on GenericFile {
                    id
                    fileStatus
                    url
                    mimeType
                    originalFileSize
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }
`;
const FILE_STATUS_QUERY = `#graphql
    # API: 2026-04 | Scope: read_files (or write_files)
    query fileStatus($id: ID!) {
        node(id: $id) {
            ... on MediaImage {
                id
                fileStatus
                image { url }
            }
            ... on Video {
                id
                fileStatus
                sources { url }
            }
            ... on GenericFile {
                id
                fileStatus
                url
            }
        }
    }
`;
function resolveResourceType(mimeType) {
  for (const [prefix, type] of RESOURCE_TYPE_RULES) {
    if (mimeType === prefix || mimeType.startsWith(prefix)) return type;
  }
  return "FILE";
}
function resolveContentType(mimeType) {
  for (const [prefix, type] of CONTENT_TYPE_RULES) {
    if (mimeType === prefix || mimeType.startsWith(prefix)) return type;
  }
  return "FILE";
}
function validateFile(file, options) {
  var _a2;
  const errors = [];
  if (file.size === 0) {
    errors.push({ file: file.name, message: "File is empty (0 bytes).", code: SHOPIFY_UPLOAD_ERROR_CODES.EMPTY_FILE });
    return errors;
  }
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  if (file.size > maxSize) {
    errors.push({
      file: file.name,
      message: `"${file.name}" is ${formatBytes(file.size)} — exceeds the ${formatBytes(maxSize)} limit.`,
      code: SHOPIFY_UPLOAD_ERROR_CODES.FILE_TOO_LARGE
    });
  }
  const allowedTypes = options.allowedTypes ?? [];
  if (allowedTypes.length > 0) {
    const allowed = allowedTypes.some(
      (rule) => rule.endsWith("/") ? file.type.startsWith(rule) : file.type === rule
    );
    if (!allowed) {
      errors.push({
        file: file.name,
        message: `File type "${file.type}" is not allowed. Accepted: ${allowedTypes.join(", ")}.`,
        code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_TYPE
      });
    }
  }
  const allowedExtensions = options.allowedExtensions ?? [];
  if (allowedExtensions.length > 0) {
    const ext = ((_a2 = file.name.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) ?? "";
    if (!allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
      errors.push({
        file: file.name,
        message: `Extension ".${ext}" is not allowed. Accepted: ${allowedExtensions.map((e) => `.${e}`).join(", ")}.`,
        code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_EXTENSION
      });
    }
  }
  return errors;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
async function getStagedTargets(admin, files) {
  var _a2, _b, _c, _d;
  const input2 = files.map((file) => ({
    filename: file.name,
    mimeType: file.type,
    resource: resolveResourceType(file.type),
    fileSize: String(file.size),
    httpMethod: "POST"
    // GCS signed-POST — applies to ALL resource types
  }));
  const response = await admin.graphql(STAGED_UPLOADS_CREATE_MUTATION, { variables: { input: input2 } });
  const json = await response.json();
  return {
    targets: ((_b = (_a2 = json.data) == null ? void 0 : _a2.stagedUploadsCreate) == null ? void 0 : _b.stagedTargets) ?? [],
    userErrors: ((_d = (_c = json.data) == null ? void 0 : _c.stagedUploadsCreate) == null ? void 0 : _d.userErrors) ?? []
  };
}
async function uploadToS3(file, target) {
  try {
    const fd = new FormData();
    for (const { name, value } of target.parameters) {
      fd.append(name, value);
    }
    fd.append("file", file);
    const res = await fetch(target.url, { method: "POST", body: fd });
    if (!res.ok) {
      const text2 = await res.text().catch(() => "");
      return { ok: false, error: `S3 upload failed (HTTP ${res.status}): ${text2.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Network error during S3 upload: ${err.message}` };
  }
}
async function registerFilesInShopify(admin, targets, files, options = {}) {
  var _a2, _b, _c, _d;
  const fileInputs = targets.map((target, i) => {
    var _a3, _b2;
    return {
      originalSource: target.resourceUrl,
      contentType: resolveContentType(((_a3 = files[i]) == null ? void 0 : _a3.type) ?? ""),
      alt: options.altText ?? ((_b2 = files[i]) == null ? void 0 : _b2.name) ?? ""
    };
  });
  const response = await admin.graphql(FILE_CREATE_MUTATION, { variables: { files: fileInputs } });
  const json = await response.json();
  const rawFiles = ((_b = (_a2 = json.data) == null ? void 0 : _a2.fileCreate) == null ? void 0 : _b.files) ?? [];
  const userErrors = ((_d = (_c = json.data) == null ? void 0 : _c.fileCreate) == null ? void 0 : _d.userErrors) ?? [];
  const registeredFiles = rawFiles.map((f, i) => {
    var _a3, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    const url = ((_a3 = f.image) == null ? void 0 : _a3.url) ?? // MediaImage
    ((_c2 = (_b2 = f.sources) == null ? void 0 : _b2[0]) == null ? void 0 : _c2.url) ?? // Video (first source)
    f.url ?? // GenericFile
    null;
    return {
      id: f.id,
      fileStatus: f.fileStatus ?? "PROCESSING",
      // UPLOADED|PROCESSING|READY|FAILED
      url,
      alt: f.alt ?? ((_d2 = f.image) == null ? void 0 : _d2.altText) ?? "",
      name: ((_e = files[i]) == null ? void 0 : _e.name) ?? "",
      type: ((_f = files[i]) == null ? void 0 : _f.type) ?? f.mimeType ?? "",
      size: ((_g = files[i]) == null ? void 0 : _g.size) ?? f.originalFileSize ?? 0,
      width: ((_h = f.image) == null ? void 0 : _h.width) ?? ((_j = (_i = f.sources) == null ? void 0 : _i[0]) == null ? void 0 : _j.width) ?? null,
      height: ((_k = f.image) == null ? void 0 : _k.height) ?? ((_m = (_l = f.sources) == null ? void 0 : _l[0]) == null ? void 0 : _m.height) ?? null,
      createdAt: f.createdAt ?? null
    };
  });
  return { registeredFiles, userErrors };
}
async function runPipeline(admin, file, options) {
  var _a2, _b;
  const { targets, userErrors: stageErrors } = await getStagedTargets(admin, [file]);
  if (stageErrors.length > 0 || targets.length === 0) {
    return { error: { file: file.name, message: ((_a2 = stageErrors[0]) == null ? void 0 : _a2.message) ?? "Failed to get staged upload URL from Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_STAGE_ERROR } };
  }
  const s3 = await uploadToS3(file, targets[0]);
  if (!s3.ok) {
    return { error: { file: file.name, message: s3.error, code: SHOPIFY_UPLOAD_ERROR_CODES.S3_UPLOAD_ERROR } };
  }
  const { registeredFiles, userErrors: regErrors } = await registerFilesInShopify(admin, targets, [file], options);
  if (regErrors.length > 0 || registeredFiles.length === 0) {
    return { error: { file: file.name, message: ((_b = regErrors[0]) == null ? void 0 : _b.message) ?? "Failed to register file in Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_REGISTER_ERROR } };
  }
  let saved = registeredFiles[0];
  const waitForReady = options.waitForReady !== false;
  if (waitForReady && saved.fileStatus !== "READY") {
    const poll = await shopifyPollFileStatus(admin, saved.id, {
      maxAttempts: options.pollMaxAttempts ?? 20,
      intervalMs: options.pollIntervalMs ?? 800,
      initialDelayMs: options.pollInitialDelayMs ?? 500
    });
    if (poll.ok) {
      saved = { ...saved, url: poll.url, fileStatus: poll.fileStatus };
    }
  }
  return { saved };
}
async function shopifyUploadFile(admin, file, options = {}) {
  const fail = (err) => ({
    ok: false,
    file: void 0,
    error: err,
    files: [],
    errors: [err],
    meta: { totalUploaded: 0, totalFailed: 1, totalBytes: 0 }
  });
  if (!(file instanceof File)) {
    return fail({
      file: typeof file === "string" ? file : "(none)",
      message: "No valid file provided. Make sure the form field contains a File.",
      code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_INPUT
    });
  }
  const validationErrors = validateFile(file, options);
  if (validationErrors.length > 0) {
    return fail(validationErrors[0]);
  }
  const result = await runPipeline(admin, file, options);
  if (result.error) return fail(result.error);
  return {
    ok: true,
    file: result.saved,
    error: void 0,
    files: [result.saved],
    errors: [],
    meta: { totalUploaded: 1, totalFailed: 0, totalBytes: file.size }
  };
}
async function shopifyPollFileStatus(admin, fileId, options = {}) {
  var _a2, _b, _c, _d;
  const maxAttempts = options.maxAttempts ?? 20;
  const intervalMs = options.intervalMs ?? 800;
  const initialDelayMs = options.initialDelayMs ?? 500;
  if (initialDelayMs > 0) {
    await new Promise((r) => setTimeout(r, initialDelayMs));
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await admin.graphql(FILE_STATUS_QUERY, { variables: { id: fileId } });
    const json = await response.json();
    const node = (_a2 = json.data) == null ? void 0 : _a2.node;
    if (!node) {
      return {
        ok: false,
        fileStatus: "UNKNOWN",
        url: null,
        attempts: attempt,
        error: { message: `File not found: ${fileId}`, code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_FAILED }
      };
    }
    const status = node.fileStatus;
    const url = ((_b = node.image) == null ? void 0 : _b.url) ?? ((_d = (_c = node.sources) == null ? void 0 : _c[0]) == null ? void 0 : _d.url) ?? node.url ?? null;
    if (status === "READY") {
      return { ok: true, fileStatus: status, url, attempts: attempt };
    }
    if (status === "FAILED") {
      return {
        ok: false,
        fileStatus: status,
        url: null,
        attempts: attempt,
        error: { message: "Shopify reported file processing FAILED.", code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_FAILED }
      };
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  const totalMs = initialDelayMs + maxAttempts * intervalMs;
  return {
    ok: false,
    fileStatus: "PROCESSING",
    url: null,
    attempts: maxAttempts,
    error: {
      message: `File did not reach READY status after ${maxAttempts} attempts (~${(totalMs / 1e3).toFixed(1)}s total).`,
      code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_TIMEOUT
    }
  };
}
async function uploadImageIfPresent(admin, file) {
  var _a2;
  if (!file || typeof file === "string" || file.size === 0) return null;
  const result = await shopifyUploadFile(admin, file, {
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSize: 5 * 1024 * 1024,
    waitForReady: true
  });
  if (!result.ok) throw new Error(((_a2 = result.error) == null ? void 0 : _a2.message) || "Image upload failed.");
  return result.file.url;
}
const EMPTY_PRIZE_DATA = {
  id: null,
  title: null,
  description: null,
  imageUrl: null,
  pointsCost: null,
  productValue: null,
  isActive: true
};
function buildFormShape(data) {
  return {
    id: (data == null ? void 0 : data.id) ?? null,
    title: str(data == null ? void 0 : data.title),
    description: str(data == null ? void 0 : data.description),
    imageUrl: (data == null ? void 0 : data.imageUrl) ?? null,
    pointsCost: num(data == null ? void 0 : data.pointsCost),
    productValue: num(data == null ? void 0 : data.productValue),
    isActive: bool((data == null ? void 0 : data.isActive) ?? true)
  };
}
function validate(form2) {
  var _a2;
  const errors = {};
  if (!((_a2 = form2.title) == null ? void 0 : _a2.trim()))
    errors.title = "Title is required.";
  if (!form2.pointsCost || Number(form2.pointsCost) <= 0)
    errors.pointsCost = "Points cost must be greater than 0.";
  return errors;
}
const PER_PAGE$1 = 10;
function usePhysicalPrizesPage(loaderData, actionData) {
  var _a2, _b;
  const submitRR = useSubmit();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const formRef = useRef(null);
  const [view, setView] = useState("list");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [multiplier, setMultiplier] = useState(15);
  const [pointsPerDollar, setPointsPerDollar] = useState(10);
  const pendingSubmitType = ((_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType")) ?? null;
  const isSubmitting = navigation.state === "submitting";
  const isSaving = isSubmitting && pendingSubmitType === "addPrize";
  const isUpdating = isSubmitting && pendingSubmitType === "updatePrize";
  const isDeleting = isSubmitting && pendingSubmitType === "deletePrize";
  const isAnyBusy = isSubmitting;
  const busy = isSaving || isUpdating;
  const fs = useFormState(EMPTY_PRIZE_DATA, buildFormShape, { validate });
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
    if (actionData.status === "success") {
      if (actionData.submitType === "addPrize" || actionData.submitType === "updatePrize") {
        setView("list");
        fs.reset();
      }
      if (actionData.submitType === "deletePrize") {
        setDeleteTarget(null);
      }
    }
  }, [actionData, shopify2]);
  useEffect(() => {
    setCurrentPage(1);
  }, [(_b = loaderData == null ? void 0 : loaderData.prizes) == null ? void 0 : _b.length]);
  const prizes = (loaderData == null ? void 0 : loaderData.prizes) ?? [];
  const totalPages = Math.max(1, Math.ceil(prizes.length / PER_PAGE$1));
  const paginatedPrizes = prizes.slice((currentPage - 1) * PER_PAGE$1, currentPage * PER_PAGE$1);
  const suggestedPoints = useMemo(() => {
    const val = Number(fs.form.productValue);
    if (!val || val <= 0) return null;
    return Math.round(val * multiplier * pointsPerDollar);
  }, [fs.form.productValue, multiplier, pointsPerDollar]);
  const goToCreate = useCallback(() => {
    fs.syncAfterSave(EMPTY_PRIZE_DATA);
    setView("create");
  }, [fs]);
  const goToEdit = useCallback((p) => {
    fs.syncAfterSave(p);
    setView("edit");
  }, [fs]);
  const goToList = useCallback(() => {
    setView("list");
    fs.reset();
  }, [fs]);
  const buildMultipartFD = useCallback((submitType) => {
    const fd = new FormData(formRef.current);
    fd.set("submitType", submitType);
    fd.set("prize", JSON.stringify(fs.form));
    return fd;
  }, [fs.form]);
  const handleSave = useCallback(async () => {
    const valid = await fs.submit();
    if (!valid) return;
    submitRR(buildMultipartFD("addPrize"), { method: "post", encType: "multipart/form-data" });
  }, [fs, buildMultipartFD, submitRR]);
  const handleUpdate2 = useCallback(async () => {
    const valid = await fs.submit();
    if (!valid) return;
    submitRR(buildMultipartFD("updatePrize"), { method: "post", encType: "multipart/form-data" });
  }, [fs, buildMultipartFD, submitRR]);
  const handleDelete2 = useCallback(() => {
    if (!deleteTarget) return;
    submitRR({ submitType: "deletePrize", prizeId: deleteTarget.id }, { method: "post" });
  }, [deleteTarget, submitRR]);
  const handleDiscard = useCallback(() => {
    fs.reset();
  }, [fs]);
  return {
    formRef,
    fs,
    view,
    deleteTarget,
    setDeleteTarget,
    currentPage,
    setCurrentPage,
    multiplier,
    setMultiplier,
    pointsPerDollar,
    setPointsPerDollar,
    isSaving,
    isUpdating,
    isDeleting,
    isAnyBusy,
    busy,
    paginatedPrizes,
    totalPages,
    suggestedPoints,
    goToCreate,
    goToEdit,
    goToList,
    handleSave,
    handleUpdate: handleUpdate2,
    handleDelete: handleDelete2,
    handleDiscard
  };
}
function PageHeading$1({ view, isAnyBusy, onCreate, onBackToList }) {
  if (view === "list") {
    return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
      /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: "Physical Prizes" }),
      /* @__PURE__ */ jsx("s-button", { variant: "primary", onClick: onCreate, disabled: isAnyBusy, children: "Add New Prize" })
    ] });
  }
  const isEdit = view === "edit";
  return /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
    /* @__PURE__ */ jsx(
      "s-button",
      {
        variant: "plain",
        onClick: onBackToList,
        disabled: isAnyBusy,
        style: { padding: 0, minHeight: "unset" },
        children: "Prizes"
      }
    ),
    /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "›" }),
    /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: isEdit ? "Edit Prize" : "Add New Prize" })
  ] });
}
function PrizeTable({
  prizes,
  currentPage,
  totalPages,
  isAnyBusy,
  onEdit,
  onRequestDelete,
  onPageChange
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Image" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Title" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Product Value" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points Cost" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Active" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: prizes.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "6", style: { textAlign: "center", padding: "3rem" }, children: 'No prizes yet. Click "Add New Prize" to get started.' }) }) : prizes.map((p) => /* @__PURE__ */ jsxs("s-table-row", { children: [
        /* @__PURE__ */ jsx("s-table-cell", { children: p.imageUrl ? /* @__PURE__ */ jsx(
          "img",
          {
            src: p.imageUrl,
            alt: p.title,
            style: { width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" }
          }
        ) : /* @__PURE__ */ jsx("div", { style: {
          width: "48px",
          height: "48px",
          borderRadius: "6px",
          background: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px"
        }, children: "🎁" }) }),
        /* @__PURE__ */ jsxs("s-table-cell", { children: [
          /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: p.title }),
          p.description && /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: p.description.length > 60 ? p.description.slice(0, 60) + "…" : p.description })
        ] }),
        /* @__PURE__ */ jsx("s-table-cell", { children: p.productValue ? `$${Number(p.productValue).toLocaleString()}` : "—" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("strong", { children: [
          Number(p.pointsCost).toLocaleString(),
          " pts"
        ] }) }),
        /* @__PURE__ */ jsx("s-table-cell", { children: p.isActive ? "✅ Yes" : "❌ No" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { gap: "small", direction: "inline", children: [
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "edit",
              disabled: isAnyBusy,
              onClick: () => onEdit(p)
            }
          ),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "delete",
              destructive: true,
              disabled: isAnyBusy,
              onClick: () => onRequestDelete(p),
              commandFor: "delete-prize-modal",
              command: "--show"
            }
          )
        ] }) })
      ] }, p.id)) })
    ] }),
    totalPages > 1 && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", justifyContent: "center", gap: "small", style: { marginBlockStart: "1rem" }, children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === 1 || isAnyBusy,
          onClick: () => onPageChange(Math.max(1, currentPage - 1)),
          children: "← Prev"
        }
      ),
      /* @__PURE__ */ jsxs("s-text", { children: [
        "Page ",
        currentPage,
        " of ",
        totalPages
      ] }),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === totalPages || isAnyBusy,
          onClick: () => onPageChange(Math.min(totalPages, currentPage + 1)),
          children: "Next →"
        }
      )
    ] })
  ] });
}
function ImageUploadField({ fs, imageFile, imagePreviewUrl, busy }) {
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "200", children: [
    /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Prize Image (Optional)" }),
    /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Upload an image to show customers what they can win. JPG, PNG, WebP or GIF. Max 5 MB." }),
    fs.form.imageUrl && !imageFile && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: fs.form.imageUrl,
          alt: "Current prize image",
          style: {
            width: "72px",
            height: "72px",
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid #e0e0e0"
          }
        }
      ),
      /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "100", children: [
        /* @__PURE__ */ jsx("s-text", { variant: "bodySm", tone: "subdued", children: "Current image" }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "plain",
            destructive: true,
            size: "small",
            disabled: busy,
            onClick: () => {
              fs.set("imageUrl", null);
              fs.removeMedia("imageUrl");
            },
            children: "Remove"
          }
        )
      ] })
    ] }),
    imageFile && imagePreviewUrl && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: imagePreviewUrl,
          alt: "Selected image preview",
          style: {
            width: "72px",
            height: "72px",
            objectFit: "cover",
            borderRadius: "8px",
            border: "2px solid var(--nbl-primary, #0284c7)"
          }
        }
      ),
      /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "100", children: [
        /* @__PURE__ */ jsxs("s-text", { variant: "bodySm", tone: "subdued", children: [
          imageFile.name,
          " — ",
          (imageFile.size / 1024).toFixed(0),
          " KB"
        ] }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "plain",
            destructive: true,
            size: "small",
            disabled: busy,
            onClick: () => fs.clearPendingFilesFor("image"),
            children: "Remove"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "s-drop-zone",
      {
        name: "image",
        label: "Prize image",
        accessibilityLabel: "Upload prize image",
        accept: "image/jpeg,image/png,image/webp,image/gif",
        multiple: false,
        disabled: busy,
        onChange: (e) => {
          var _a2, _b;
          const file = ((_b = (_a2 = e.currentTarget) == null ? void 0 : _a2.files) == null ? void 0 : _b[0]) ?? null;
          if (file) fs.fileSetterFor("image")([file]);
        }
      }
    )
  ] }) });
}
function PricingFields({ fs, busy, suggestedPoints }) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Pricing" }),
    /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Set the product value and use the multiplier calculator below to work out the right points cost." }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Product Value ($)",
          prefix: "$",
          step: 1,
          min: 0,
          value: fs.form.productValue,
          disabled: busy,
          details: "Estimated retail value of this prize.",
          onInput: (e) => fs.set("productValue", e.target.value),
          onBlur: () => fs.touchField("productValue")
        }
      ),
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Points Cost",
          suffix: "pts",
          step: 1,
          min: 1,
          value: fs.form.pointsCost,
          disabled: busy,
          details: "How many points a customer needs to claim this prize.",
          error: fs.errorFor("pointsCost") ?? void 0,
          onInput: (e) => fs.set("pointsCost", e.target.value),
          onBlur: () => fs.touchField("pointsCost")
        }
      )
    ] }),
    suggestedPoints !== null && /* @__PURE__ */ jsx("s-box", { paddingBlockStart: "small", children: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
      /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
        "Suggested: ",
        /* @__PURE__ */ jsxs("strong", { children: [
          suggestedPoints.toLocaleString(),
          " pts"
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          size: "small",
          disabled: busy,
          onClick: () => fs.set("pointsCost", String(suggestedPoints)),
          children: "Use this"
        }
      )
    ] }) })
  ] });
}
function MultiplierCalculator({
  productValue,
  multiplier,
  onMultiplierChange,
  pointsPerDollar,
  onPointsPerDollarChange,
  suggestedPoints
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Multiplier Calculator" }),
    /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Points cost = Product value × Multiplier × Points per $1. Lower multiplier = easier to claim (10x). Higher = harder (20x)." }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Multiplier",
          suffix: "x",
          step: 1,
          min: 1,
          max: 100,
          value: multiplier,
          onInput: (e) => onMultiplierChange(Number(e.target.value) || 15)
        }
      ),
      /* @__PURE__ */ jsx(
        "s-number-field",
        {
          label: "Points per $1 spent",
          suffix: "pts",
          step: 1,
          min: 1,
          value: pointsPerDollar,
          onInput: (e) => onPointsPerDollarChange(Number(e.target.value) || 10)
        }
      )
    ] }),
    productValue && suggestedPoints && /* @__PURE__ */ jsx("s-box", { paddingBlockStart: "small", children: /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
      "$",
      Number(productValue).toLocaleString(),
      " × ",
      multiplier,
      "x × ",
      pointsPerDollar,
      " pts/$1",
      " = ",
      /* @__PURE__ */ jsxs("strong", { children: [
        suggestedPoints.toLocaleString(),
        " pts"
      ] }),
      " · ",
      "Spend equivalent: ",
      /* @__PURE__ */ jsxs("strong", { children: [
        "$",
        (suggestedPoints / pointsPerDollar).toLocaleString()
      ] }),
      " · ",
      "Effective return: ",
      /* @__PURE__ */ jsxs("strong", { children: [
        (Number(productValue) / (suggestedPoints / pointsPerDollar) * 100).toFixed(1),
        "%"
      ] }),
      " · ",
      "Value per point: ",
      /* @__PURE__ */ jsxs("strong", { children: [
        "$",
        (Number(productValue) / suggestedPoints).toFixed(4)
      ] })
    ] }) })
  ] });
}
function PrizeSummaryPanel({ fs, imageFile, busy }) {
  return /* @__PURE__ */ jsxs("s-box", { children: [
    /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Summary" }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Title:" }),
        " ",
        fs.form.title || "—"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product value:" }),
        " ",
        fs.form.productValue ? `$${Number(fs.form.productValue).toLocaleString()}` : "—"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Points cost:" }),
        " ",
        fs.form.pointsCost ? `${Number(fs.form.pointsCost).toLocaleString()} pts` : "—"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Image:" }),
        " ",
        imageFile ? `✅ ${imageFile.name}` : fs.form.imageUrl ? "✅ Uploaded" : "❌ None"
      ] }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsxs("s-text", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Status:" }),
        " ",
        fs.form.isActive ? "Active ✅" : "Inactive ❌"
      ] })
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsxs("s-section", { children: [
      /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Active Status" }),
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Inactive prizes will not be shown to customers in the widget." }),
      /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "small" }),
      /* @__PURE__ */ jsx(
        "s-switch",
        {
          labelAccessibilityVisibility: "exclusion",
          label: fs.form.isActive ? "Active" : "Inactive",
          checked: fs.form.isActive,
          disabled: busy,
          onChange: (e) => fs.set("isActive", e.target.checked)
        }
      )
    ] })
  ] });
}
function PrizeForm({
  formRef,
  fs,
  isEdit,
  busy,
  multiplier,
  onMultiplierChange,
  pointsPerDollar,
  onPointsPerDollarChange,
  suggestedPoints,
  onPrimary,
  onDiscard
}) {
  var _a2, _b;
  const imageFile = ((_b = (_a2 = fs.pendingFiles) == null ? void 0 : _a2.image) == null ? void 0 : _b[0]) ?? null;
  const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : null;
  return /* @__PURE__ */ jsxs("form", { ref: formRef, children: [
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "2fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsxs("s-box", { children: [
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsxs("s-section", { children: [
          /* @__PURE__ */ jsx(
            "s-text-field",
            {
              label: "Prize Title",
              placeholder: "e.g. SanDisk CFexpress Card",
              value: fs.form.title,
              disabled: busy,
              error: fs.errorFor("title") ?? void 0,
              onInput: (e) => fs.set("title", e.target.value),
              onBlur: () => fs.touchField("title")
            }
          ),
          /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
          /* @__PURE__ */ jsx(
            "s-text-area",
            {
              label: "Description / Notes (Optional)",
              placeholder: "e.g. Aspirational prize. Set value to your cost.",
              value: fs.form.description,
              rows: 3,
              disabled: busy,
              onInput: (e) => fs.set("description", e.target.value)
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsx(ImageUploadField, { fs, imageFile, imagePreviewUrl, busy }) }),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", children: /* @__PURE__ */ jsx(PricingFields, { fs, busy, suggestedPoints }) }),
        /* @__PURE__ */ jsx(
          MultiplierCalculator,
          {
            productValue: fs.form.productValue,
            multiplier,
            onMultiplierChange,
            pointsPerDollar,
            onPointsPerDollarChange,
            suggestedPoints
          }
        ),
        /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" })
      ] }),
      /* @__PURE__ */ jsx(PrizeSummaryPanel, { fs, imageFile, busy })
    ] }),
    /* @__PURE__ */ jsx(
      SaveBar,
      {
        visible: fs.isDirty || busy,
        position: "bottom-center",
        message: isEdit ? "You have unsaved changes" : "New prize — not saved yet",
        primaryLabel: isEdit ? "Update Prize" : "Save Prize",
        secondaryLabel: "Discard",
        loading: busy,
        disabled: busy,
        onPrimary,
        onSecondary: onDiscard
      }
    )
  ] });
}
function DeleteConfirmModal({ deleteTarget, isDeleting, onConfirm }) {
  return /* @__PURE__ */ jsxs("s-modal", { id: "delete-prize-modal", heading: "Delete Prize", size: "small", children: [
    /* @__PURE__ */ jsxs("s-paragraph", { color: "subdued", children: [
      "Are you sure you want to delete ",
      /* @__PURE__ */ jsx("strong", { children: deleteTarget == null ? void 0 : deleteTarget.title }),
      "? Existing claims will not be affected, but customers will no longer be able to claim this prize. This action cannot be undone."
    ] }),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "secondary-actions",
        commandFor: "delete-prize-modal",
        command: "--hide",
        disabled: isDeleting,
        children: "Cancel"
      }
    ),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "primary-action",
        variant: "primary",
        destructive: true,
        onClick: onConfirm,
        commandFor: "delete-prize-modal",
        command: "--hide",
        loading: isDeleting,
        disabled: isDeleting,
        children: "Yes, Delete"
      }
    )
  ] });
}
const loader$a = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const prizes = await prisma.physicalPrize.findMany({
    where: {
      sessionId: session.id
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  return {
    prizes
  };
};
const action$h = async ({
  request
}) => {
  var _a2, _b;
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  if (submitType === "addPrize") {
    const data = JSON.parse(formData.get("prize") || "{}");
    if (!((_a2 = data.title) == null ? void 0 : _a2.trim())) return {
      message: "Title is required.",
      status: "error",
      submitType
    };
    if (!data.pointsCost || Number(data.pointsCost) <= 0) return {
      message: "Points cost must be greater than 0.",
      status: "error",
      submitType
    };
    try {
      const uploadedUrl = await uploadImageIfPresent(admin, formData.get("image"));
      const created = await prisma.physicalPrize.create({
        data: {
          title: data.title.trim(),
          description: data.description || null,
          imageUrl: uploadedUrl || null,
          pointsCost: Number(data.pointsCost),
          productValue: data.productValue ? Number(data.productValue) : null,
          isActive: data.isActive ?? true,
          session: {
            connect: {
              id: session.id
            }
          }
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Prize created successfully.",
        prize: created,
        status: "success",
        submitType
      };
    } catch (err) {
      console.error("Create PhysicalPrize Error:", err);
      return {
        message: err.message || "Failed to create prize.",
        status: "error",
        submitType
      };
    }
  }
  if (submitType === "updatePrize") {
    const data = JSON.parse(formData.get("prize") || "{}");
    if (!data.id) return {
      message: "Prize ID is required.",
      status: "error",
      submitType
    };
    if (!((_b = data.title) == null ? void 0 : _b.trim())) return {
      message: "Title is required.",
      status: "error",
      submitType
    };
    if (!data.pointsCost || Number(data.pointsCost) <= 0) return {
      message: "Points cost must be greater than 0.",
      status: "error",
      submitType
    };
    try {
      const existing = await prisma.physicalPrize.findUnique({
        where: {
          id: parseInt(data.id)
        }
      });
      if (!existing || existing.sessionId !== session.id) return {
        message: "Prize not found or access denied.",
        status: "error",
        submitType
      };
      const uploadedUrl = await uploadImageIfPresent(admin, formData.get("image"));
      const imageUrl = uploadedUrl || data.imageUrl || null;
      const updated = await prisma.physicalPrize.update({
        where: {
          id: parseInt(data.id)
        },
        data: {
          title: data.title.trim(),
          description: data.description || null,
          imageUrl,
          pointsCost: Number(data.pointsCost),
          productValue: data.productValue ? Number(data.productValue) : null,
          isActive: data.isActive ?? true
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Prize updated successfully.",
        prize: updated,
        status: "success",
        submitType
      };
    } catch (err) {
      console.error("Update PhysicalPrize Error:", err);
      return {
        message: err.message || "Failed to update prize.",
        status: "error",
        submitType
      };
    }
  }
  if (submitType === "deletePrize") {
    const prizeId = parseInt(formData.get("prizeId"));
    if (!prizeId) return {
      message: "Prize ID is required.",
      status: "error",
      submitType
    };
    try {
      const prize = await prisma.physicalPrize.findUnique({
        where: {
          id: prizeId
        }
      });
      if (!prize || prize.sessionId !== session.id) return {
        message: "Prize not found or access denied.",
        status: "error",
        submitType
      };
      await prisma.physicalPrize.delete({
        where: {
          id: prizeId
        }
      });
      await syncAppConfig(admin, session);
      return {
        message: "Prize deleted successfully.",
        status: "success",
        submitType
      };
    } catch (err) {
      console.error("Delete PhysicalPrize Error:", err);
      return {
        message: err.message || "Failed to delete prize.",
        status: "error",
        submitType
      };
    }
  }
  return {
    message: "Invalid action.",
    status: "error",
    submitType
  };
};
const route$3 = UNSAFE_withComponentProps(function PhysicalPrizesPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = usePhysicalPrizesPage(loaderData, actionData);
  const isEdit = page.view === "edit";
  return /* @__PURE__ */ jsxs("s-page", {
    inlineSize: "base",
    children: [/* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsx(PageHeading$1, {
        view: page.view,
        isAnyBusy: page.isAnyBusy,
        onCreate: page.goToCreate,
        onBackToList: page.goToList
      })
    }), page.view === "list" && /* @__PURE__ */ jsx(PrizeTable, {
      prizes: page.paginatedPrizes,
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      isAnyBusy: page.isAnyBusy,
      onEdit: page.goToEdit,
      onRequestDelete: page.setDeleteTarget,
      onPageChange: page.setCurrentPage
    }), (page.view === "create" || page.view === "edit") && /* @__PURE__ */ jsx(PrizeForm, {
      formRef: page.formRef,
      fs: page.fs,
      isEdit,
      busy: page.busy,
      multiplier: page.multiplier,
      onMultiplierChange: page.setMultiplier,
      pointsPerDollar: page.pointsPerDollar,
      onPointsPerDollarChange: page.setPointsPerDollar,
      suggestedPoints: page.suggestedPoints,
      onPrimary: isEdit ? page.handleUpdate : page.handleSave,
      onDiscard: page.handleDiscard
    }), /* @__PURE__ */ jsx(DeleteConfirmModal, {
      deleteTarget: page.deleteTarget,
      isDeleting: page.isDeleting,
      onConfirm: page.handleDelete
    })]
  });
});
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$h,
  default: route$3,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const VALID_STATUSES = ["ALL", "NEW", "PENDING", "FULFILLED", "COMPLETED", "CANCELLED"];
const VALID_SORT_OPTIONS = ["date_desc", "date_asc", "points_desc", "points_asc"];
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 50;
const STATUS_CONFIG = {
  PENDING: { label: "Pending", tone: "warning", icon: "🕐" },
  FULFILLED: { label: "Fulfilled", tone: "info", icon: "📦" },
  COMPLETED: { label: "Completed", tone: "success", icon: "✅" },
  CANCELLED: { label: "Cancelled", tone: "critical", icon: "❌" }
};
const FILTER_TABS = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "PENDING", label: "Pending" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" }
];
const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "points_desc", label: "Points: high to low" },
  { value: "points_asc", label: "Points: low to high" }
];
function formatDate$1(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function parseIntParam(value, fallback, min = 1, max = Infinity) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}
function buildWhere(sessionId, { status, dateFrom, dateTo, newIds }) {
  const where = { prize: { sessionId } };
  if (status === "NEW") {
    where.id = { in: newIds };
  } else if (status !== "ALL") {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = /* @__PURE__ */ new Date(`${dateTo}T23:59:59`);
  }
  return where;
}
function buildOrderBy(sortBy) {
  switch (sortBy) {
    case "date_asc":
      return { createdAt: "asc" };
    case "points_desc":
      return { pointsCost: "desc" };
    case "points_asc":
      return { pointsCost: "asc" };
    default:
      return { createdAt: "desc" };
  }
}
async function getVerifiedClaim(sessionId, id) {
  const parsed = parseInt(id, 10);
  if (!Number.isFinite(parsed)) return null;
  const claim = await prisma.physicalPrizeClaim.findFirst({
    where: { id: parsed },
    include: {
      prize: { select: { sessionId: true, title: true } },
      customer: { select: { id: true, shopifyId: true, points: true } }
    }
  });
  if (!claim || claim.prize.sessionId !== sessionId) return null;
  return claim;
}
async function handleMarkClaimSeen({ formData, session }) {
  var _a2;
  const submitType = "markClaimSeen";
  const claimId = formData.get("claimId");
  if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };
  try {
    const claim = await getVerifiedClaim(session.id, claimId);
    if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };
    const now = /* @__PURE__ */ new Date();
    const isFirstView = !claim.viewedByAdmin;
    await prisma.physicalPrizeClaim.update({
      where: { id: parseInt(claimId, 10) },
      data: {
        isSeenByAdmin: true,
        viewedByAdmin: true,
        // Only stamp viewedAt on the very first view
        ...isFirstView ? { viewedAt: now } : {}
      }
    });
    return {
      status: "success",
      submitType,
      claimId: parseInt(claimId, 10),
      viewedAt: isFirstView ? now.toISOString() : ((_a2 = claim.viewedAt) == null ? void 0 : _a2.toISOString()) ?? null
    };
  } catch (err) {
    console.error("[markClaimSeen]", err);
    return { message: err.message || "Failed to mark seen.", status: "error", submitType };
  }
}
async function handleUpdateClaimStatus({ formData, session, admin }) {
  const submitType = "updateClaimStatus";
  const claimId = formData.get("claimId");
  const newStatus = formData.get("status");
  const trackingInfo = formData.get("trackingInfo") || null;
  if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };
  if (!["FULFILLED", "COMPLETED", "CANCELLED"].includes(newStatus))
    return { message: "Invalid status.", status: "error", submitType };
  try {
    const claim = await getVerifiedClaim(session.id, claimId);
    if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };
    if (claim.status === newStatus) return { message: "Claim is already in that status.", status: "error", submitType };
    const claimIdInt = parseInt(claimId, 10);
    if (newStatus === "CANCELLED") {
      const pointsCost = Math.abs(Number(claim.pointsCost) || 0);
      await prisma.$transaction(async (tx) => {
        await tx.physicalPrizeClaim.update({
          where: { id: claimIdInt },
          data: { status: "CANCELLED", fulfilledAt: null, completedAt: null }
        });
        await tx.customer.update({
          where: { id: claim.customer.id },
          data: { points: { increment: pointsCost } }
        });
      });
      const updated = await prisma.customer.findUnique({
        where: { id: claim.customer.id },
        select: { points: true }
      });
      await createTransaction({
        customerId: claim.customer.id,
        type: "ADJUST",
        reason: `Points refunded — prize cancelled: ${claim.prize.title}`,
        activity: `+${pointsCost} points refunded for cancelled prize: ${claim.prize.title}`,
        points: pointsCost,
        balanceAfter: (updated == null ? void 0 : updated.points) ?? 0,
        status: "COMPLETED"
      }, session);
      await syncCustomerConfig(admin, claim.customer.shopifyId);
      return {
        message: `Claim cancelled. ${Number(pointsCost).toLocaleString()} points refunded.`,
        status: "success",
        submitType,
        claimId: claimIdInt,
        newStatus: "CANCELLED"
      };
    }
    if (newStatus === "FULFILLED") {
      if (claim.status !== "PENDING")
        return { message: "Only pending claims can be marked as fulfilled.", status: "error", submitType };
      await prisma.physicalPrizeClaim.update({
        where: { id: claimIdInt },
        data: {
          status: "FULFILLED",
          fulfilledAt: /* @__PURE__ */ new Date(),
          ...trackingInfo ? { trackingInfo } : {}
        }
      });
      const customer2 = await prisma.customer.findUnique({
        where: { id: claim.customer.id },
        select: { points: true }
      });
      await createTransaction({
        customerId: claim.customer.id,
        type: "ADJUST",
        reason: `Prize claim fulfilled: ${claim.prize.title}`,
        activity: `Prize "${claim.prize.title}" marked as fulfilled — no points changed`,
        points: 0,
        balanceAfter: (customer2 == null ? void 0 : customer2.points) ?? 0,
        status: "COMPLETED"
      }, session);
      await syncCustomerConfig(admin, claim.customer.shopifyId);
      return {
        message: "Claim marked as fulfilled.",
        status: "success",
        submitType,
        claimId: claimIdInt,
        newStatus: "FULFILLED",
        trackingInfo
      };
    }
    if (newStatus === "COMPLETED") {
      if (claim.status !== "FULFILLED")
        return { message: "Only fulfilled claims can be marked as completed.", status: "error", submitType };
      await prisma.physicalPrizeClaim.update({
        where: { id: claimIdInt },
        data: { status: "COMPLETED", completedAt: /* @__PURE__ */ new Date() }
      });
      const customer2 = await prisma.customer.findUnique({
        where: { id: claim.customer.id },
        select: { points: true }
      });
      await createTransaction({
        customerId: claim.customer.id,
        type: "ADJUST",
        reason: `Prize claim completed: ${claim.prize.title}`,
        activity: `Prize "${claim.prize.title}" marked as completed — delivery confirmed`,
        points: 0,
        balanceAfter: (customer2 == null ? void 0 : customer2.points) ?? 0,
        status: "COMPLETED"
      }, session);
      await syncCustomerConfig(admin, claim.customer.shopifyId);
      return {
        message: "Claim marked as completed.",
        status: "success",
        submitType,
        claimId: claimIdInt,
        newStatus: "COMPLETED"
      };
    }
  } catch (err) {
    console.error("[updateClaimStatus]", err);
    return { message: err.message || "Failed to update claim.", status: "error", submitType };
  }
}
async function handleRevertClaim({ formData, session, admin }) {
  const submitType = "revertClaim";
  const claimId = formData.get("claimId");
  if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };
  try {
    const claim = await getVerifiedClaim(session.id, claimId);
    const claimIdInt = parseInt(claimId, 10);
    if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };
    const logRevert = async (tx, reason, activity) => {
      const customer2 = await tx.customer.findUnique({
        where: { id: claim.customer.id },
        select: { points: true }
      });
      await createTransaction({
        customerId: claim.customer.id,
        type: "ADJUST",
        reason,
        activity,
        points: 0,
        balanceAfter: (customer2 == null ? void 0 : customer2.points) ?? 0,
        status: "COMPLETED"
      }, session);
      await syncCustomerConfig(admin, claim.customer.shopifyId);
    };
    if (claim.status === "COMPLETED") {
      await prisma.$transaction(async (tx) => {
        await tx.physicalPrizeClaim.update({
          where: { id: claimIdInt },
          data: { status: "FULFILLED", completedAt: null }
        });
        await logRevert(
          tx,
          `Prize claim reverted to fulfilled: ${claim.prize.title}`,
          `Prize "${claim.prize.title}" reverted from completed → fulfilled — no points changed`
        );
      });
      return { message: "Claim reverted to fulfilled.", status: "success", submitType, claimId: claimIdInt, newStatus: "FULFILLED" };
    }
    if (claim.status === "FULFILLED") {
      await prisma.$transaction(async (tx) => {
        await tx.physicalPrizeClaim.update({
          where: { id: claimIdInt },
          data: { status: "PENDING", fulfilledAt: null, trackingInfo: null }
        });
        await logRevert(
          tx,
          `Prize claim reverted to pending: ${claim.prize.title}`,
          `Prize "${claim.prize.title}" reverted from fulfilled → pending — no points changed`
        );
      });
      return { message: "Claim reverted to pending.", status: "success", submitType, claimId: claimIdInt, newStatus: "PENDING" };
    }
    if (claim.status === "CANCELLED") {
      const pointsCost = Math.abs(Number(claim.pointsCost) || 0);
      if (claim.customer.points < pointsCost)
        return {
          message: `Not enough points. Required: ${pointsCost.toLocaleString()}, Available: ${claim.customer.points.toLocaleString()}.`,
          status: "error",
          submitType
        };
      await prisma.$transaction(async (tx) => {
        await tx.physicalPrizeClaim.update({
          where: { id: claimIdInt },
          data: { status: "PENDING", fulfilledAt: null, completedAt: null, trackingInfo: null }
        });
        await tx.customer.update({
          where: { id: claim.customer.id },
          data: { points: { decrement: pointsCost } }
        });
      });
      const updated = await prisma.customer.findUnique({
        where: { id: claim.customer.id },
        select: { points: true }
      });
      await createTransaction({
        customerId: claim.customer.id,
        type: "ADJUST",
        reason: `Points re-deducted — prize reinstated: ${claim.prize.title}`,
        activity: `-${pointsCost} points re-deducted for reinstated prize: ${claim.prize.title}`,
        points: -pointsCost,
        balanceAfter: (updated == null ? void 0 : updated.points) ?? 0,
        status: "COMPLETED"
      }, session);
      await syncCustomerConfig(admin, claim.customer.shopifyId);
      return {
        message: `Claim reverted to pending. ${Number(pointsCost).toLocaleString()} points re-deducted.`,
        status: "success",
        submitType,
        claimId: claimIdInt,
        newStatus: "PENDING"
      };
    }
    return { message: "Cannot revert this claim.", status: "error", submitType };
  } catch (err) {
    console.error("[revertClaim]", err);
    return { message: err.message || "Failed to revert claim.", status: "error", submitType };
  }
}
async function handleSaveAdminNote({ formData, session }) {
  const submitType = "saveAdminNote";
  const claimId = formData.get("claimId");
  const adminNote = formData.get("adminNote") ?? "";
  if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };
  try {
    const claim = await getVerifiedClaim(session.id, claimId);
    if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };
    const trimmed = adminNote.trim() || null;
    await prisma.physicalPrizeClaim.update({
      where: { id: parseInt(claimId, 10) },
      data: { adminNote: trimmed }
    });
    return {
      message: "Note saved.",
      status: "success",
      submitType,
      claimId: parseInt(claimId, 10),
      adminNote: trimmed
    };
  } catch (err) {
    console.error("[saveAdminNote]", err);
    return { message: err.message || "Failed to save note.", status: "error", submitType };
  }
}
async function handleBulkAction({ formData, session, admin }) {
  const submitType = "bulkAction";
  const bulkAction = formData.get("bulkAction");
  let claimIds;
  try {
    claimIds = JSON.parse(formData.get("claimIds") || "[]");
    if (!Array.isArray(claimIds)) throw new Error();
  } catch {
    return { message: "Invalid claim IDs.", status: "error", submitType };
  }
  if (!claimIds.length) return { message: "No claims selected.", status: "error", submitType };
  if (!["FULFILLED", "COMPLETED", "CANCELLED"].includes(bulkAction))
    return { message: "Invalid bulk action.", status: "error", submitType };
  try {
    const results = { success: [], failed: [] };
    for (const claimId of claimIds) {
      const claim = await getVerifiedClaim(session.id, claimId);
      const id = parseInt(claimId, 10);
      const skip = !claim || bulkAction === "FULFILLED" && claim.status !== "PENDING" || bulkAction === "COMPLETED" && claim.status !== "FULFILLED" || bulkAction === "CANCELLED" && !["PENDING", "FULFILLED"].includes(claim.status);
      if (skip) {
        results.failed.push(id);
        continue;
      }
      if (bulkAction === "CANCELLED") {
        const pointsCost = Math.abs(Number(claim.pointsCost) || 0);
        await prisma.$transaction(async (tx) => {
          await tx.physicalPrizeClaim.update({
            where: { id },
            data: { status: "CANCELLED", fulfilledAt: null, completedAt: null }
          });
          await tx.customer.update({
            where: { id: claim.customer.id },
            data: { points: { increment: pointsCost } }
          });
        });
        const updated = await prisma.customer.findUnique({
          where: { id: claim.customer.id },
          select: { points: true }
        });
        await createTransaction({
          customerId: claim.customer.id,
          type: "ADJUST",
          reason: `Points refunded — prize cancelled: ${claim.prize.title}`,
          activity: `+${pointsCost} points refunded for cancelled prize: ${claim.prize.title}`,
          points: pointsCost,
          balanceAfter: (updated == null ? void 0 : updated.points) ?? 0,
          status: "COMPLETED"
        }, session);
        await syncCustomerConfig(admin, claim.customer.shopifyId);
      }
      if (bulkAction === "FULFILLED") {
        await prisma.physicalPrizeClaim.update({
          where: { id },
          data: { status: "FULFILLED", fulfilledAt: /* @__PURE__ */ new Date() }
        });
        const customer2 = await prisma.customer.findUnique({
          where: { id: claim.customer.id },
          select: { points: true }
        });
        await createTransaction({
          customerId: claim.customer.id,
          type: "ADJUST",
          reason: `Prize claim fulfilled: ${claim.prize.title}`,
          activity: `Prize "${claim.prize.title}" marked as fulfilled (bulk) — no points changed`,
          points: 0,
          balanceAfter: (customer2 == null ? void 0 : customer2.points) ?? 0,
          status: "COMPLETED"
        }, session);
        await syncCustomerConfig(admin, claim.customer.shopifyId);
      }
      if (bulkAction === "COMPLETED") {
        await prisma.physicalPrizeClaim.update({
          where: { id },
          data: { status: "COMPLETED", completedAt: /* @__PURE__ */ new Date() }
        });
        const customer2 = await prisma.customer.findUnique({
          where: { id: claim.customer.id },
          select: { points: true }
        });
        await createTransaction({
          customerId: claim.customer.id,
          type: "ADJUST",
          reason: `Prize claim completed: ${claim.prize.title}`,
          activity: `Prize "${claim.prize.title}" marked as completed (bulk) — delivery confirmed`,
          points: 0,
          balanceAfter: (customer2 == null ? void 0 : customer2.points) ?? 0,
          status: "COMPLETED"
        }, session);
        await syncCustomerConfig(admin, claim.customer.shopifyId);
      }
      results.success.push(id);
    }
    const actionLabel = { FULFILLED: "fulfilled", COMPLETED: "completed", CANCELLED: "cancelled" }[bulkAction];
    const msg = results.failed.length ? `${results.success.length} updated. ${results.failed.length} skipped (wrong status or not found).` : `${results.success.length} claim${results.success.length > 1 ? "s" : ""} ${actionLabel}.`;
    return {
      message: msg,
      status: "success",
      submitType,
      bulkAction,
      updatedIds: results.success,
      newStatus: bulkAction
    };
  } catch (err) {
    console.error("[bulkAction]", err);
    return { message: err.message || "Bulk action failed.", status: "error", submitType };
  }
}
function usePrizeClaimsPage(loaderData, actionData) {
  var _a2, _b;
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalRef = useRef(null);
  const noteModalRef = useRef(null);
  const bulkModalRef = useRef(null);
  const viewModalRef = useRef(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteValue, setNoteValue] = useState("");
  const [viewTarget, setViewTarget] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [selectedIds, setSelectedIds] = useState(/* @__PURE__ */ new Set());
  const [newDismissed, setNewDismissed] = useState(false);
  const newClaimIds = useRef(new Set((loaderData == null ? void 0 : loaderData.newIds) ?? []));
  const sessionViewedIds = useRef(/* @__PURE__ */ new Set());
  const [optimisticViewedIds, setOptimisticViewedIds] = useState(/* @__PURE__ */ new Set());
  useEffect(() => {
    const freshNew = new Set((loaderData == null ? void 0 : loaderData.newIds) ?? []);
    sessionViewedIds.current.forEach((id) => freshNew.delete(id));
    newClaimIds.current = freshNew;
  }, [loaderData]);
  const activeTab = VALID_STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "ALL";
  const sortBy = VALID_SORT_OPTIONS.includes(searchParams.get("sortBy")) ? searchParams.get("sortBy") : "date_desc";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const { page: currentPage, perPage, totalItems, totalPages } = (loaderData == null ? void 0 : loaderData.pagination) ?? {
    page: 1,
    perPage: DEFAULT_PER_PAGE,
    totalItems: 0,
    totalPages: 1
  };
  const startIndex = (currentPage - 1) * perPage;
  const claims = (loaderData == null ? void 0 : loaderData.claims) ?? [];
  const stats = (loaderData == null ? void 0 : loaderData.stats) ?? {};
  const isSubmitting = navigation.state === "submitting";
  const pendingClaimId = (_a2 = navigation.formData) == null ? void 0 : _a2.get("claimId");
  const pendingSubmit = (_b = navigation.formData) == null ? void 0 : _b.get("submitType");
  const isBusy = (id) => isSubmitting && Number(pendingClaimId) === Number(id);
  const updateParams = useCallback((updates, resetPage = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === "" || v == null) next.delete(k);
        else next.set(k, String(v));
      });
      if (resetPage && !("page" in updates)) next.set("page", "1");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setCurrentPage = useCallback((p) => updateParams({ page: p }, false), [updateParams]);
  const setPerPage = useCallback((pp) => updateParams({ perPage: pp }), [updateParams]);
  const setActiveTab = useCallback((s) => {
    updateParams({ status: s });
    setSelectedIds(/* @__PURE__ */ new Set());
  }, [updateParams]);
  const setSortBy = useCallback((s) => updateParams({ sortBy: s }), [updateParams]);
  const setDateFrom = useCallback((d) => updateParams({ dateFrom: d }), [updateParams]);
  const setDateTo = useCallback((d) => updateParams({ dateTo: d }), [updateParams]);
  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ["status", "sortBy", "dateFrom", "dateTo", "page"].forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const hasActiveFilters = activeTab !== "ALL" || sortBy !== "date_desc" || dateFrom || dateTo;
  useEffect(() => {
    if (!actionData) return;
    if (actionData.submitType === "markClaimSeen") return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
  }, [actionData, shopify2]);
  const openConfirm = useCallback((claim, action2) => {
    setConfirmTarget({ claim, action: action2 });
    setTrackingInput("");
    requestAnimationFrame(() => {
      var _a3;
      return (_a3 = modalRef.current) == null ? void 0 : _a3.showOverlay();
    });
  }, []);
  const handleConfirm = useCallback(() => {
    var _a3;
    if (!confirmTarget) return;
    (_a3 = modalRef.current) == null ? void 0 : _a3.hideOverlay();
    const { claim, action: action2 } = confirmTarget;
    if (action2 === "REVERT") {
      submit({ submitType: "revertClaim", claimId: String(claim.id) }, { method: "post" });
    } else {
      submit({
        submitType: "updateClaimStatus",
        claimId: String(claim.id),
        status: action2,
        trackingInfo: trackingInput.trim()
      }, { method: "post" });
    }
    setConfirmTarget(null);
    setTrackingInput("");
  }, [confirmTarget, submit, trackingInput]);
  const openNoteModal = useCallback((claim) => {
    setNoteTarget(claim);
    setNoteValue(claim.adminNote ?? "");
    requestAnimationFrame(() => {
      var _a3;
      return (_a3 = noteModalRef.current) == null ? void 0 : _a3.showOverlay();
    });
  }, []);
  const handleSaveNote = useCallback(() => {
    var _a3;
    if (!noteTarget) return;
    (_a3 = noteModalRef.current) == null ? void 0 : _a3.hideOverlay();
    submit(
      { submitType: "saveAdminNote", claimId: String(noteTarget.id), adminNote: noteValue },
      { method: "post" }
    );
  }, [noteTarget, noteValue, submit]);
  const openViewModal = useCallback((claim) => {
    setViewTarget(claim);
    requestAnimationFrame(() => {
      var _a3;
      return (_a3 = viewModalRef.current) == null ? void 0 : _a3.showOverlay();
    });
    if (!claim.viewedByAdmin) {
      setOptimisticViewedIds((prev) => /* @__PURE__ */ new Set([...prev, claim.id]));
    }
    if (newClaimIds.current.has(claim.id)) {
      newClaimIds.current.delete(claim.id);
      sessionViewedIds.current.add(claim.id);
      submit({ submitType: "markClaimSeen", claimId: String(claim.id) }, { method: "post" });
    } else if (!claim.viewedByAdmin) {
      submit({ submitType: "markClaimSeen", claimId: String(claim.id) }, { method: "post" });
    }
  }, [submit]);
  const openBulkConfirm = useCallback((action2) => {
    setBulkAction(action2);
    requestAnimationFrame(() => {
      var _a3;
      return (_a3 = bulkModalRef.current) == null ? void 0 : _a3.showOverlay();
    });
  }, []);
  const handleBulkConfirm = useCallback(() => {
    var _a3;
    (_a3 = bulkModalRef.current) == null ? void 0 : _a3.hideOverlay();
    submit(
      { submitType: "bulkAction", bulkAction, claimIds: JSON.stringify([...selectedIds]) },
      { method: "post" }
    );
    setSelectedIds(/* @__PURE__ */ new Set());
    setBulkAction(null);
  }, [bulkAction, selectedIds, submit]);
  const pendingOnPage = claims.filter((c) => c.status === "PENDING");
  const fulfilledOnPage = claims.filter((c) => c.status === "FULFILLED");
  const selectablePage = [...pendingOnPage, ...fulfilledOnPage];
  const allPageSelected = selectablePage.length > 0 && selectablePage.every((c) => selectedIds.has(c.id));
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = selectablePage.every((c) => next.has(c.id));
      selectablePage.forEach((c) => all ? next.delete(c.id) : next.add(c.id));
      return next;
    });
  }, [selectablePage]);
  const clearSelection = useCallback(() => setSelectedIds(/* @__PURE__ */ new Set()), []);
  const handleOpenCustomer = useCallback(async (shopifyId) => {
    try {
      await shopify2.intents.invoke("edit:shopify/Customer", { value: shopifyId });
    } catch {
      shopify2.toast.show("Could not open customer profile.", { isError: true });
    }
  }, [shopify2]);
  const closeConfirmModal = useCallback(() => {
    setConfirmTarget(null);
    setTrackingInput("");
  }, []);
  const closeNoteModal = useCallback(() => setNoteTarget(null), []);
  const closeBulkModal = useCallback(() => setBulkAction(null), []);
  const closeViewModal = useCallback(() => setViewTarget(null), []);
  return {
    // Refs (attach directly to <s-modal ref={...}>)
    modalRef,
    noteModalRef,
    bulkModalRef,
    viewModalRef,
    // Loader-derived data
    claims,
    stats,
    activeTab,
    sortBy,
    dateFrom,
    dateTo,
    currentPage,
    perPage,
    totalItems,
    totalPages,
    startIndex,
    loaderError: (loaderData == null ? void 0 : loaderData.loaderError) ?? null,
    // Submission state
    isSubmitting,
    pendingSubmit,
    isBusy,
    // New / viewed tracking
    newClaimIds,
    optimisticViewedIds,
    // Filters
    setCurrentPage,
    setPerPage,
    setActiveTab,
    setSortBy,
    setDateFrom,
    setDateTo,
    clearFilters,
    hasActiveFilters,
    // New-claims banner
    newDismissed,
    setNewDismissed,
    // Confirm modal
    confirmTarget,
    trackingInput,
    setTrackingInput,
    openConfirm,
    handleConfirm,
    closeConfirmModal,
    // Note modal
    noteTarget,
    noteValue,
    setNoteValue,
    openNoteModal,
    handleSaveNote,
    closeNoteModal,
    // View modal
    viewTarget,
    openViewModal,
    closeViewModal,
    // Bulk modal/bar
    bulkAction,
    openBulkConfirm,
    handleBulkConfirm,
    closeBulkModal,
    // Selection
    selectedIds,
    selectablePage,
    allPageSelected,
    toggleSelect,
    toggleSelectAllPage,
    clearSelection,
    // Misc
    handleOpenCustomer
  };
}
function LoaderErrorBanner({ loaderError }) {
  if (!loaderError) return null;
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx("s-banner", { tone: "critical", heading: "Something went wrong", children: loaderError }) });
}
function NewClaimsBanner({ stats, newDismissed, onDismiss, onViewNew }) {
  if (newDismissed || !stats.new || stats.new === 0) return null;
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx(
    "s-banner",
    {
      tone: "info",
      heading: `${stats.new} new prize request${stats.new > 1 ? "s" : ""} since your last visit`,
      dismissible: true,
      onDismiss,
      children: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
        /* @__PURE__ */ jsxs("s-text", { variant: "bodySm", children: [
          stats.new,
          " new ",
          stats.new > 1 ? "requests need" : "request needs",
          " your attention."
        ] }),
        /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: onViewNew, children: "View new requests" })
      ] })
    }
  ) });
}
function StatsBar({ stats }) {
  const tiles = [
    { label: "Total", tone: "info", value: stats.total ?? 0, sub: "All claims" },
    { label: "New", tone: "info", value: stats.new ?? 0, sub: "Since last visit" },
    { label: "Pending", tone: "warning", value: stats.pending ?? 0, sub: "Awaiting action" },
    { label: "Fulfilled", tone: "info", value: stats.fulfilled ?? 0, sub: "Sent to customer" },
    { label: "Completed", tone: "success", value: stats.completed ?? 0, sub: "Fully delivered" },
    { label: "Cancelled", tone: "critical", value: stats.cancelled ?? 0, sub: "Points refunded" }
  ];
  return /* @__PURE__ */ jsx("s-grid", { gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: "base", children: tiles.map(({ label: label2, tone, value, sub }) => /* @__PURE__ */ jsx("s-box", { padding: "base", background: "base", borderWidth: "base", borderColor: "base", borderRadius: "base", children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
    /* @__PURE__ */ jsx("s-badge", { tone, children: label2 }),
    /* @__PURE__ */ jsx("s-heading", { children: value }),
    /* @__PURE__ */ jsx("s-text", { variant: "bodySm", tone: "subdued", children: sub })
  ] }) }, label2)) });
}
function FilterBar({
  stats,
  activeTab,
  onTabChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortBy,
  onSortByChange,
  hasActiveFilters,
  onClearFilters,
  totalItems
}) {
  const countFor = (v) => ({
    NEW: stats.new,
    PENDING: stats.pending,
    FULFILLED: stats.fulfilled,
    COMPLETED: stats.completed,
    CANCELLED: stats.cancelled
  })[v] ?? stats.total ?? 0;
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
      /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Filter:" }),
      FILTER_TABS.map(({ value, label: label2 }) => /* @__PURE__ */ jsxs(
        "s-button",
        {
          variant: activeTab === value ? "primary" : "secondary",
          onClick: () => onTabChange(value),
          children: [
            label2,
            " (",
            countFor(value),
            ")",
            value === "NEW" && stats.new > 0 && activeTab !== "NEW" && " 🔵"
          ]
        },
        value
      ))
    ] }),
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-date-field",
        {
          label: "From date",
          value: dateFrom,
          onChange: (e) => onDateFromChange(e.currentTarget.value)
        }
      ),
      /* @__PURE__ */ jsx(
        "s-date-field",
        {
          label: "To date",
          value: dateTo,
          onChange: (e) => onDateToChange(e.currentTarget.value)
        }
      ),
      /* @__PURE__ */ jsx(
        "s-select",
        {
          label: "Sort by",
          value: sortBy,
          onChange: (e) => onSortByChange(e.currentTarget.value),
          children: SORT_OPTIONS.map(({ value, label: label2 }) => /* @__PURE__ */ jsx("s-option", { value, children: label2 }, value))
        }
      )
    ] }),
    hasActiveFilters && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
      /* @__PURE__ */ jsx("s-button", { variant: "plain", tone: "critical", onClick: onClearFilters, children: "Clear filters" }),
      /* @__PURE__ */ jsxs("s-text", { variant: "bodySm", tone: "subdued", children: [
        totalItems,
        " of ",
        stats.total ?? 0,
        " claims"
      ] })
    ] })
  ] }) });
}
function BulkActionBar({ claims, selectedIds, isSubmitting, onBulkAction, onClearSelection }) {
  if (selectedIds.size === 0) return null;
  const selected = claims.filter((c) => selectedIds.has(c.id));
  const hasAnyPending = selected.some((c) => c.status === "PENDING");
  const hasAnyFulfilled = selected.some((c) => c.status === "FULFILLED");
  const hasAnyCancellable = selected.some((c) => ["PENDING", "FULFILLED"].includes(c.status));
  return /* @__PURE__ */ jsx("s-section", { children: /* @__PURE__ */ jsx("s-banner", { tone: "info", heading: `${selectedIds.size} claim${selectedIds.size > 1 ? "s" : ""} selected`, children: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
    hasAnyPending && /* @__PURE__ */ jsx("s-button", { variant: "primary", disabled: isSubmitting, onClick: () => onBulkAction("FULFILLED"), children: "Mark All Fulfilled" }),
    hasAnyFulfilled && /* @__PURE__ */ jsx("s-button", { variant: "primary", disabled: isSubmitting, onClick: () => onBulkAction("COMPLETED"), children: "Mark All Completed" }),
    hasAnyCancellable && /* @__PURE__ */ jsx("s-button", { variant: "secondary", tone: "critical", disabled: isSubmitting, onClick: () => onBulkAction("CANCELLED"), children: "Cancel All & Refund" }),
    /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: onClearSelection, children: "Clear selection" })
  ] }) }) });
}
function ClaimsTable({
  claims,
  selectablePage,
  allPageSelected,
  onToggleSelectAllPage,
  selectedIds,
  onToggleSelect,
  isSubmitting,
  isBusy,
  newClaimIds,
  optimisticViewedIds,
  onOpenCustomer,
  onView,
  currentPage,
  totalPages,
  totalItems,
  perPage,
  startIndex,
  setCurrentPage,
  setPerPage
}) {
  return /* @__PURE__ */ jsxs("s-section", { padding: "none", children: [
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: selectablePage.length > 0 && /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: allPageSelected,
            onChange: onToggleSelectAllPage,
            title: "Select all pending/fulfilled on this page"
          }
        ) }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Prize" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Customer" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Points Spent" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Claimed On" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Fulfilled On" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Completed On" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Status" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: claims.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "9", children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "No claims found." }) }) }) : claims.map((claim) => {
        const sc = STATUS_CONFIG[claim.status] || STATUS_CONFIG.PENDING;
        const busy = isBusy(claim.id);
        const { customer: customer2, prize } = claim;
        const fullName = (customer2 == null ? void 0 : customer2.name) || [customer2 == null ? void 0 : customer2.firstName, customer2 == null ? void 0 : customer2.lastName].filter(Boolean).join(" ") || "Unknown";
        const isPending = claim.status === "PENDING";
        const isFulfilled = claim.status === "FULFILLED";
        const isSelectable = isPending || isFulfilled;
        const isNew = newClaimIds.current.has(claim.id);
        return /* @__PURE__ */ jsxs("s-table-row", { children: [
          /* @__PURE__ */ jsx("s-table-cell", { children: isSelectable && /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: selectedIds.has(claim.id),
              onChange: () => onToggleSelect(claim.id),
              disabled: isSubmitting
            }
          ) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
            (prize == null ? void 0 : prize.imageUrl) ? /* @__PURE__ */ jsx("s-thumbnail", { src: prize.imageUrl, size: "small", alt: prize.title ?? "Prize" }) : /* @__PURE__ */ jsx("s-thumbnail", { alt: "No image", size: "small" }),
            /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "none", children: [
              /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: (prize == null ? void 0 : prize.title) ?? "—" }),
              (prize == null ? void 0 : prize.productValue) && /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
                "Value: $",
                Number(prize.productValue).toLocaleString()
              ] })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "none", children: [
            /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
              /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: fullName }),
              (customer2 == null ? void 0 : customer2.shopifyId) && /* @__PURE__ */ jsx("s-button", { variant: "plain", disabled: busy, onClick: () => onOpenCustomer(customer2.shopifyId), children: "View profile" })
            ] }),
            /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: (customer2 == null ? void 0 : customer2.email) ?? "—" })
          ] }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-text", { variant: "headingSm", children: [
            Number(claim.pointsCost).toLocaleString(),
            " pts"
          ] }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: formatDate$1(claim.createdAt) }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: formatDate$1(claim.fulfilledAt) }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: formatDate$1(claim.completedAt) }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-300", children: [
            /* @__PURE__ */ jsxs("s-badge", { tone: sc.tone, children: [
              sc.icon,
              " ",
              sc.label
            ] }),
            isNew && /* @__PURE__ */ jsx("s-badge", { tone: "info", size: "small", children: "New" }),
            !claim.viewedByAdmin && !optimisticViewedIds.has(claim.id) && !isNew && /* @__PURE__ */ jsx("s-badge", { tone: "warning", size: "small", children: "👁 Unreviewed" }),
            claim.adminNote && /* @__PURE__ */ jsx("s-badge", { tone: "attention", size: "small", children: "📝 Note" })
          ] }) }),
          /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: () => onView(claim), children: isNew ? "👁 View (New)" : "👁 View" }) })
        ] }, claim.id);
      }) })
    ] }),
    /* @__PURE__ */ jsx("s-divider", {}),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base", paddingInline: "base", children: /* @__PURE__ */ jsx(
      Pagination,
      {
        currentPage,
        totalPages,
        totalItems,
        perPage,
        startIndex,
        setCurrentPage,
        setPerPage,
        label: "claims"
      }
    ) })
  ] });
}
function ConfirmActionModal({
  modalRef,
  confirmTarget,
  trackingInput,
  onTrackingInputChange,
  isSubmitting,
  onConfirm,
  onHide
}) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  const confirmAction = confirmTarget == null ? void 0 : confirmTarget.action;
  const isCancelling = confirmAction === "CANCELLED";
  const isReverting = confirmAction === "REVERT";
  const isFulfilling = confirmAction === "FULFILLED";
  const isCompleting = confirmAction === "COMPLETED";
  const pts = Number(((_a2 = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _a2.pointsCost) ?? 0).toLocaleString();
  const prizeTitle = ((_c = (_b = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _b.prize) == null ? void 0 : _c.title) ?? "this prize";
  const customerName = ((_e = (_d = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _d.customer) == null ? void 0 : _e.name) || [(_g = (_f = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _f.customer) == null ? void 0 : _g.firstName, (_i = (_h = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _h.customer) == null ? void 0 : _i.lastName].filter(Boolean).join(" ") || "the customer";
  const customerPoints = Number(((_k = (_j = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _j.customer) == null ? void 0 : _k.points) ?? 0);
  const revertCost = Number(((_l = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _l.pointsCost) ?? 0);
  const isCancelledRevert = ((_m = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _m.status) === "CANCELLED";
  const notEnoughPoints = isReverting && isCancelledRevert && customerPoints < revertCost;
  const revertLabel = ((_n = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _n.status) === "COMPLETED" ? "Revert to Fulfilled" : "Revert to Pending";
  const modalHeading = isCancelling ? "Cancel Prize Request" : isReverting ? revertLabel : isCompleting ? "Mark as Completed" : "Mark as Fulfilled";
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      ref: modalRef,
      id: "confirm-claim-modal",
      heading: modalHeading,
      accessibilityLabel: modalHeading,
      onHide,
      children: [
        /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
          isCancelling && /* @__PURE__ */ jsxs("s-banner", { tone: "warning", heading: "Points will be refunded", children: [
            pts,
            " points will be returned to ",
            customerName,
            "'s account automatically."
          ] }),
          isReverting && isCancelledRevert && notEnoughPoints && /* @__PURE__ */ jsxs("s-banner", { tone: "critical", heading: "Insufficient points", children: [
            customerName,
            " only has ",
            customerPoints.toLocaleString(),
            " pts but ",
            revertCost.toLocaleString(),
            " pts are needed. Cannot revert."
          ] }),
          isReverting && isCancelledRevert && !notEnoughPoints && /* @__PURE__ */ jsxs("s-banner", { tone: "warning", heading: "Points will be deducted", children: [
            pts,
            " points will be deducted from ",
            customerName,
            "'s account again."
          ] }),
          isCompleting && /* @__PURE__ */ jsx("s-banner", { tone: "success", heading: "Final confirmation", children: "This will mark the prize as fully delivered and completed." }),
          /* @__PURE__ */ jsx("s-text", { children: isCancelling ? `Are you sure you want to cancel the request for "${prizeTitle}"? Points will be refunded.` : isReverting ? ((_o = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _o.status) === "COMPLETED" ? `Revert "${prizeTitle}" back to fulfilled?` : ((_p = confirmTarget == null ? void 0 : confirmTarget.claim) == null ? void 0 : _p.status) === "FULFILLED" ? `Revert "${prizeTitle}" back to pending?` : `Revert "${prizeTitle}" back to pending? ${pts} points will be deducted from ${customerName}.` : isCompleting ? `Mark "${prizeTitle}" by ${customerName} as completed?` : `Mark "${prizeTitle}" by ${customerName} as fulfilled?` }),
          isFulfilling && /* @__PURE__ */ jsx(
            "s-text-field",
            {
              label: "Notes / License key / Download link (optional)",
              placeholder: "e.g. License key: XXXX-XXXX-XXXX",
              value: trackingInput,
              onChange: (e) => onTrackingInputChange(e.currentTarget.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-button", { slot: "secondary-actions", variant: "secondary", commandFor: "confirm-claim-modal", command: "--hide", disabled: isSubmitting, children: "Go Back" }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "primary-action",
            variant: "primary",
            tone: isCancelling ? "critical" : void 0,
            onClick: onConfirm,
            loading: isSubmitting,
            disabled: isSubmitting || notEnoughPoints,
            children: isCancelling ? `Cancel & Refund ${pts} pts` : isReverting ? isCancelledRevert ? `Revert & Deduct ${pts} pts` : revertLabel : isCompleting ? "Mark as Completed" : "Mark as Fulfilled"
          }
        )
      ]
    }
  );
}
function AdminNoteModal({
  modalRef,
  noteTarget,
  noteValue,
  onNoteValueChange,
  isSubmitting,
  onSave,
  onHide
}) {
  var _a2, _b, _c;
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      ref: modalRef,
      id: "note-claim-modal",
      heading: "Admin Note",
      accessibilityLabel: "Admin Note",
      onHide,
      children: [
        /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
          /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
            "Note for: ",
            /* @__PURE__ */ jsx("strong", { children: ((_a2 = noteTarget == null ? void 0 : noteTarget.prize) == null ? void 0 : _a2.title) ?? "this claim" }),
            " — ",
            ((_b = noteTarget == null ? void 0 : noteTarget.customer) == null ? void 0 : _b.name) || ((_c = noteTarget == null ? void 0 : noteTarget.customer) == null ? void 0 : _c.email) || ""
          ] }),
          /* @__PURE__ */ jsx(
            "s-text-field",
            {
              label: "Note",
              multiline: 4,
              placeholder: "Internal notes about this claim...",
              value: noteValue,
              onChange: (e) => onNoteValueChange(e.currentTarget.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("s-button", { slot: "secondary-actions", variant: "secondary", commandFor: "note-claim-modal", command: "--hide", disabled: isSubmitting, children: "Cancel" }),
        /* @__PURE__ */ jsx("s-button", { slot: "primary-action", variant: "primary", onClick: onSave, loading: isSubmitting, disabled: isSubmitting, children: "Save Note" })
      ]
    }
  );
}
function BulkConfirmModal({
  modalRef,
  bulkAction,
  selectedIds,
  isSubmitting,
  onConfirm,
  onHide
}) {
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      ref: modalRef,
      id: "bulk-claim-modal",
      heading: bulkAction === "FULFILLED" ? "Bulk Mark Fulfilled" : bulkAction === "COMPLETED" ? "Bulk Mark Completed" : "Bulk Cancel & Refund",
      accessibilityLabel: "Bulk action",
      onHide,
      children: [
        /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
          bulkAction === "CANCELLED" && /* @__PURE__ */ jsx("s-banner", { tone: "warning", heading: "Points will be refunded", children: "Points will be refunded to all selected customers automatically." }),
          /* @__PURE__ */ jsx("s-text", { children: bulkAction === "FULFILLED" ? `Mark ${selectedIds.size} pending claim${selectedIds.size > 1 ? "s" : ""} as fulfilled?` : bulkAction === "COMPLETED" ? `Mark ${selectedIds.size} fulfilled claim${selectedIds.size > 1 ? "s" : ""} as completed?` : `Cancel ${selectedIds.size} claim${selectedIds.size > 1 ? "s" : ""} and refund points?` }),
          /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: bulkAction === "FULFILLED" ? "Only PENDING claims will be updated. Others will be skipped." : bulkAction === "COMPLETED" ? "Only FULFILLED claims will be updated. Others will be skipped." : "Only PENDING and FULFILLED claims will be cancelled. Others will be skipped." })
        ] }),
        /* @__PURE__ */ jsx("s-button", { slot: "secondary-actions", variant: "secondary", commandFor: "bulk-claim-modal", command: "--hide", disabled: isSubmitting, children: "Go Back" }),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            slot: "primary-action",
            variant: "primary",
            tone: bulkAction === "CANCELLED" ? "critical" : void 0,
            onClick: onConfirm,
            loading: isSubmitting,
            disabled: isSubmitting,
            children: bulkAction === "FULFILLED" ? `Fulfill ${selectedIds.size} Claims` : bulkAction === "COMPLETED" ? `Complete ${selectedIds.size} Claims` : `Cancel ${selectedIds.size} Claims`
          }
        )
      ]
    }
  );
}
function ViewClaimModal({
  modalRef,
  viewTarget,
  onHide,
  isSubmitting,
  pendingSubmit,
  isBusy,
  onOpenCustomer,
  onOpenNote,
  onOpenConfirm
}) {
  const hideThenRun = (fn) => () => {
    var _a2;
    (_a2 = modalRef.current) == null ? void 0 : _a2.hideOverlay();
    fn();
  };
  return /* @__PURE__ */ jsxs(
    "s-modal",
    {
      ref: modalRef,
      id: "view-claim-modal",
      heading: "Claim Details",
      accessibilityLabel: "Claim Details",
      onHide,
      children: [
        viewTarget && (() => {
          const vc = viewTarget;
          const sc = STATUS_CONFIG[vc.status] || STATUS_CONFIG.PENDING;
          const customer2 = vc.customer;
          const prize = vc.prize;
          const fullName = (customer2 == null ? void 0 : customer2.name) || [customer2 == null ? void 0 : customer2.firstName, customer2 == null ? void 0 : customer2.lastName].filter(Boolean).join(" ") || "Unknown";
          return /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "base", children: [
            /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", alignItems: "center", children: [
              (prize == null ? void 0 : prize.imageUrl) ? /* @__PURE__ */ jsx("s-thumbnail", { src: prize.imageUrl, size: "large", alt: (prize == null ? void 0 : prize.title) ?? "Prize" }) : /* @__PURE__ */ jsx("s-thumbnail", { alt: "No image", size: "large" }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small", children: [
                /* @__PURE__ */ jsx("s-text", { variant: "headingMd", children: (prize == null ? void 0 : prize.title) ?? "—" }),
                (prize == null ? void 0 : prize.productValue) && /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
                  "Product Value: $",
                  Number(prize.productValue).toLocaleString()
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx("s-divider", {}),
            /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
              /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "Customer" }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small", alignItems: "center", children: [
                /* @__PURE__ */ jsx("s-text", { variant: "bodyMd", children: fullName }),
                (customer2 == null ? void 0 : customer2.shopifyId) && /* @__PURE__ */ jsx("s-button", { variant: "plain", onClick: () => onOpenCustomer(customer2.shopifyId), children: "View profile" })
              ] }),
              /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: (customer2 == null ? void 0 : customer2.email) ?? "—" }),
              /* @__PURE__ */ jsxs("s-text", { tone: "subdued", variant: "bodySm", children: [
                "Current Balance: ",
                Number((customer2 == null ? void 0 : customer2.points) ?? 0).toLocaleString(),
                " pts"
              ] })
            ] }),
            /* @__PURE__ */ jsx("s-divider", {}),
            /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Points Spent" }),
                /* @__PURE__ */ jsxs("s-text", { variant: "headingSm", children: [
                  Number(vc.pointsCost).toLocaleString(),
                  " pts"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Status" }),
                /* @__PURE__ */ jsxs("s-badge", { tone: sc.tone, children: [
                  sc.icon,
                  " ",
                  sc.label
                ] })
              ] }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Claimed On" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", children: formatDate$1(vc.createdAt) })
              ] }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Fulfilled On" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", children: formatDate$1(vc.fulfilledAt) })
              ] }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "Completed On" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", children: formatDate$1(vc.completedAt) })
              ] }),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { tone: "subdued", variant: "bodySm", children: "First Reviewed" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", children: vc.viewedByAdmin ? formatDate$1(vc.viewedAt) : /* @__PURE__ */ jsx("s-badge", { tone: "warning", size: "small", children: "👁 Not yet reviewed" }) })
              ] })
            ] }),
            vc.trackingInfo && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("s-divider", {}),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "🔑 Notes / License / Link" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", children: vc.trackingInfo })
              ] })
            ] }),
            vc.adminNote && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("s-divider", {}),
              /* @__PURE__ */ jsxs("s-stack", { direction: "block", gap: "small-200", children: [
                /* @__PURE__ */ jsx("s-text", { variant: "headingSm", children: "📝 Admin Note" }),
                /* @__PURE__ */ jsx("s-text", { variant: "bodySm", tone: "subdued", children: vc.adminNote })
              ] })
            ] })
          ] });
        })(),
        /* @__PURE__ */ jsx("s-button", { slot: "secondary-actions", variant: "secondary", commandFor: "view-claim-modal", command: "--hide", children: "Close" }),
        viewTarget && (() => {
          const vt = viewTarget;
          const vtBusy = isBusy(vt.id);
          const vtPending = vt.status === "PENDING";
          const vtFulfilled = vt.status === "FULFILLED";
          const vtCompleted = vt.status === "COMPLETED";
          const vtCancelled = vt.status === "CANCELLED";
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "secondary-actions",
                variant: "secondary",
                disabled: vtBusy,
                onClick: hideThenRun(() => onOpenNote(vt)),
                children: vt.adminNote ? "Edit Note" : "Add Note"
              }
            ),
            (vtPending || vtFulfilled) && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "secondary-actions",
                variant: "secondary",
                tone: "critical",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "CANCELLED")),
                children: "Cancel & Refund"
              }
            ),
            vtFulfilled && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "secondary-actions",
                variant: "plain",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "REVERT")),
                children: "Revert to Pending"
              }
            ),
            vtCompleted && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "secondary-actions",
                variant: "plain",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "REVERT")),
                children: "Revert to Fulfilled"
              }
            ),
            vtCancelled && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "secondary-actions",
                variant: "plain",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "REVERT")),
                children: "Revert to Pending"
              }
            ),
            vtPending && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "primary-action",
                variant: "primary",
                loading: vtBusy && pendingSubmit === "updateClaimStatus",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "FULFILLED")),
                children: "Mark Fulfilled"
              }
            ),
            vtFulfilled && /* @__PURE__ */ jsx(
              "s-button",
              {
                slot: "primary-action",
                variant: "primary",
                loading: vtBusy && pendingSubmit === "updateClaimStatus",
                disabled: vtBusy || isSubmitting,
                onClick: hideThenRun(() => onOpenConfirm(vt, "COMPLETED")),
                children: "Mark Completed"
              }
            )
          ] });
        })()
      ]
    }
  );
}
const loader$9 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") ?? "ALL";
  const rawSort = url.searchParams.get("sortBy") ?? "date_desc";
  const rawDateFrom = url.searchParams.get("dateFrom") ?? "";
  const rawDateTo = url.searchParams.get("dateTo") ?? "";
  const rawPage = url.searchParams.get("page") ?? "1";
  const rawPerPage = url.searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE);
  const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "ALL";
  const sortBy = VALID_SORT_OPTIONS.includes(rawSort) ? rawSort : "date_desc";
  const dateFrom = rawDateFrom.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDateFrom : "";
  const dateTo = rawDateTo.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDateTo : "";
  const perPage = parseIntParam(rawPerPage, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);
  try {
    const [allClaims, newClaimsRaw] = await Promise.all([prisma.physicalPrizeClaim.groupBy({
      by: ["status"],
      where: {
        prize: {
          sessionId: session.id
        }
      },
      _count: {
        _all: true
      }
    }), prisma.physicalPrizeClaim.findMany({
      where: {
        prize: {
          sessionId: session.id
        },
        isSeenByAdmin: false
      },
      select: {
        id: true
      }
    })]);
    const newIds = newClaimsRaw.map((c) => c.id);
    const countByStatus = Object.fromEntries(allClaims.map(({
      status: s,
      _count
    }) => [s, _count._all]));
    const stats = {
      total: Object.values(countByStatus).reduce((a, b) => a + b, 0),
      new: newIds.length,
      pending: countByStatus.PENDING ?? 0,
      fulfilled: countByStatus.FULFILLED ?? 0,
      completed: countByStatus.COMPLETED ?? 0,
      cancelled: countByStatus.CANCELLED ?? 0
    };
    const where = buildWhere(session.id, {
      status,
      dateFrom,
      dateTo,
      newIds
    });
    const orderBy = buildOrderBy(sortBy);
    const [totalItems, claims] = await Promise.all([prisma.physicalPrizeClaim.count({
      where
    }), prisma.physicalPrizeClaim.findMany({
      where,
      orderBy,
      skip: (Math.max(1, parseIntParam(rawPage, 1)) - 1) * perPage,
      take: perPage,
      include: {
        prize: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            productValue: true
          }
        },
        customer: {
          select: {
            id: true,
            shopifyId: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            points: true
          }
        }
      }
    })]);
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const page = parseIntParam(rawPage, 1, 1, totalPages);
    const newIdSet = new Set(newIds);
    const claimsWithNewFlag = claims.map((c) => ({
      ...c,
      _isNew: newIdSet.has(c.id)
    }));
    return {
      claims: claimsWithNewFlag,
      stats,
      newIds,
      // sent to client for ref tracking
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages
      }
    };
  } catch (err) {
    console.error("[PrizeClaims Loader]", err);
    return {
      claims: [],
      stats: {
        total: 0,
        new: 0,
        pending: 0,
        fulfilled: 0,
        completed: 0,
        cancelled: 0
      },
      newIds: [],
      pagination: {
        page: 1,
        perPage,
        totalItems: 0,
        totalPages: 1
      },
      loaderError: "Failed to load claims. Please refresh."
    };
  }
};
const action$g = async ({
  request
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const ctx = {
    formData,
    session,
    admin
  };
  switch (submitType) {
    case "markClaimSeen":
      return handleMarkClaimSeen(ctx);
    case "updateClaimStatus":
      return handleUpdateClaimStatus(ctx);
    case "revertClaim":
      return handleRevertClaim(ctx);
    case "saveAdminNote":
      return handleSaveAdminNote(ctx);
    case "bulkAction":
      return handleBulkAction(ctx);
    default:
      return {
        message: "Invalid action.",
        status: "error",
        submitType
      };
  }
};
const route$2 = UNSAFE_withComponentProps(function PrizeClaimsPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = usePrizeClaimsPage(loaderData, actionData);
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Prize Claims",
    inlineSize: "large",
    children: [/* @__PURE__ */ jsx(ConfirmActionModal, {
      modalRef: page.modalRef,
      confirmTarget: page.confirmTarget,
      trackingInput: page.trackingInput,
      onTrackingInputChange: page.setTrackingInput,
      isSubmitting: page.isSubmitting,
      onConfirm: page.handleConfirm,
      onHide: page.closeConfirmModal
    }), /* @__PURE__ */ jsx(AdminNoteModal, {
      modalRef: page.noteModalRef,
      noteTarget: page.noteTarget,
      noteValue: page.noteValue,
      onNoteValueChange: page.setNoteValue,
      isSubmitting: page.isSubmitting,
      onSave: page.handleSaveNote,
      onHide: page.closeNoteModal
    }), /* @__PURE__ */ jsx(BulkConfirmModal, {
      modalRef: page.bulkModalRef,
      bulkAction: page.bulkAction,
      selectedIds: page.selectedIds,
      isSubmitting: page.isSubmitting,
      onConfirm: page.handleBulkConfirm,
      onHide: page.closeBulkModal
    }), /* @__PURE__ */ jsx(ViewClaimModal, {
      modalRef: page.viewModalRef,
      viewTarget: page.viewTarget,
      onHide: page.closeViewModal,
      isSubmitting: page.isSubmitting,
      pendingSubmit: page.pendingSubmit,
      isBusy: page.isBusy,
      onOpenCustomer: page.handleOpenCustomer,
      onOpenNote: page.openNoteModal,
      onOpenConfirm: page.openConfirm
    }), /* @__PURE__ */ jsx(LoaderErrorBanner, {
      loaderError: page.loaderError
    }), /* @__PURE__ */ jsx(NewClaimsBanner, {
      stats: page.stats,
      newDismissed: page.newDismissed,
      onDismiss: () => page.setNewDismissed(true),
      onViewNew: () => page.setActiveTab("NEW")
    }), /* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsx("s-text", {
        tone: "subdued",
        variant: "bodySm",
        children: "Manage customer prize requests — fulfill when sent, complete when delivered, or cancel to refund points."
      })
    }), /* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsx(StatsBar, {
        stats: page.stats
      })
    }), /* @__PURE__ */ jsx(FilterBar, {
      stats: page.stats,
      activeTab: page.activeTab,
      onTabChange: page.setActiveTab,
      dateFrom: page.dateFrom,
      onDateFromChange: page.setDateFrom,
      dateTo: page.dateTo,
      onDateToChange: page.setDateTo,
      sortBy: page.sortBy,
      onSortByChange: page.setSortBy,
      hasActiveFilters: page.hasActiveFilters,
      onClearFilters: page.clearFilters,
      totalItems: page.totalItems
    }), /* @__PURE__ */ jsx(BulkActionBar, {
      claims: page.claims,
      selectedIds: page.selectedIds,
      isSubmitting: page.isSubmitting,
      onBulkAction: page.openBulkConfirm,
      onClearSelection: page.clearSelection
    }), /* @__PURE__ */ jsx(ClaimsTable, {
      claims: page.claims,
      selectablePage: page.selectablePage,
      allPageSelected: page.allPageSelected,
      onToggleSelectAllPage: page.toggleSelectAllPage,
      selectedIds: page.selectedIds,
      onToggleSelect: page.toggleSelect,
      isSubmitting: page.isSubmitting,
      isBusy: page.isBusy,
      newClaimIds: page.newClaimIds,
      optimisticViewedIds: page.optimisticViewedIds,
      onOpenCustomer: page.handleOpenCustomer,
      onView: page.openViewModal,
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      totalItems: page.totalItems,
      perPage: page.perPage,
      startIndex: page.startIndex,
      setCurrentPage: page.setCurrentPage,
      setPerPage: page.setPerPage
    })]
  });
});
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$g,
  default: route$2,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const EVENT_TYPES = [
  { value: "ORDER", label: "ORDER — Direct Purchase" },
  { value: "REFERRAL", label: "REFERRAL — Refer a Friend" },
  { value: "REVIEW", label: "REVIEW — Product Review (Loox)" }
  // { value: "BIRTHDAY", label: "BIRTHDAY — Birthday Reward" },
  // { value: "SIGNUP", label: "SIGNUP — Account Sign Up" },
  // { value: "SUBSCRIPTION", label: "SUBSCRIPTION — Subscription Event" },
  // { value: "MANUAL", label: "MANUAL — Manual Adjustment" },
  // { value: "CUSTOM", label: "CUSTOM — Custom Event" },
];
const EMPTY_EVENT = { name: "", type: "", description: "", isActive: true };
const PER_PAGE = 10;
function findDuplicateEventError(events, ev, excludeId = null) {
  var _a2;
  if (!((_a2 = ev.name) == null ? void 0 : _a2.trim())) return "Event name is required.";
  if (!ev.type) return "Please select an event type.";
  const norm = (s) => s == null ? void 0 : s.trim().toLowerCase();
  const others = excludeId ? events.filter((e) => e.id !== excludeId) : events;
  if (others.some((e) => norm(e.name) === norm(ev.name))) {
    return "An event with this name already exists.";
  }
  if (!excludeId && others.some((e) => norm(e.type) === norm(ev.type))) {
    return "An event with this type already exists.";
  }
  return null;
}
function useEventsPage(loaderData, actionData) {
  var _a2;
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const pendingSubmitType = ((_a2 = navigation.formData) == null ? void 0 : _a2.get("submitType")) ?? null;
  const isSubmitting = navigation.state === "submitting";
  const isAdding = isSubmitting && pendingSubmitType === "addEvent";
  const isUpdating = isSubmitting && pendingSubmitType === "updateEvent";
  const isDeleting = isSubmitting && pendingSubmitType === "deleteEvent";
  const isAnyBusy = isSubmitting;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ ...EMPTY_EVENT });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const events = (loaderData == null ? void 0 : loaderData.events) ?? [];
  const totalPages = Math.max(1, Math.ceil(events.length / PER_PAGE));
  const paginatedEvents = events.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  useEffect(() => {
    if (!actionData) return;
    shopify2.toast.show(actionData.message, { isError: actionData.status === "error" });
    if (actionData.status === "success") {
      if (actionData.submitType === "addEvent") {
        setShowAddForm(false);
        setNewEvent({ ...EMPTY_EVENT });
      }
      if (actionData.submitType === "updateEvent" || actionData.submitType === "deleteEvent") {
        setSelectedEvent(null);
      }
    }
  }, [actionData, shopify2]);
  useEffect(() => {
    setCurrentPage(1);
  }, [events.length]);
  const validateEvent = useCallback((ev, excludeId = null) => {
    const error = findDuplicateEventError(events, ev, excludeId);
    if (error) {
      shopify2.toast.show(error, { isError: true });
      return false;
    }
    return true;
  }, [events, shopify2]);
  const toggleAddForm = useCallback(() => {
    setNewEvent({ ...EMPTY_EVENT });
    setShowAddForm((prev) => !prev);
  }, []);
  const cancelAddForm = useCallback(() => {
    setShowAddForm(false);
    setNewEvent({ ...EMPTY_EVENT });
  }, []);
  const handleAddEvent2 = useCallback(() => {
    if (!validateEvent(newEvent)) return;
    submit({ submitType: "addEvent", event: JSON.stringify(newEvent) }, { method: "post" });
  }, [newEvent, submit, validateEvent]);
  const handleUpdateEvent2 = useCallback(() => {
    if (!validateEvent(selectedEvent, selectedEvent == null ? void 0 : selectedEvent.id)) return;
    submit({ submitType: "updateEvent", event: JSON.stringify(selectedEvent) }, { method: "post" });
  }, [selectedEvent, submit, validateEvent]);
  const handleDeleteEvent2 = useCallback(() => {
    if (!selectedEvent) return;
    submit({ submitType: "deleteEvent", eventId: selectedEvent.id }, { method: "post" });
  }, [selectedEvent, submit]);
  return {
    events,
    paginatedEvents,
    currentPage,
    totalPages,
    setCurrentPage,
    isAdding,
    isUpdating,
    isDeleting,
    isAnyBusy,
    showAddForm,
    toggleAddForm,
    cancelAddForm,
    newEvent,
    setNewEvent,
    selectedEvent,
    setSelectedEvent,
    handleAddEvent: handleAddEvent2,
    handleUpdateEvent: handleUpdateEvent2,
    handleDeleteEvent: handleDeleteEvent2
  };
}
async function handleAddEvent({ formData, session }) {
  var _a2, _b, _c;
  const submitType = "addEvent";
  const newEvent = JSON.parse(formData.get("event") || "{}");
  if (!((_a2 = newEvent.name) == null ? void 0 : _a2.trim()) || !((_b = newEvent.type) == null ? void 0 : _b.trim()))
    return { message: "Name and Type are required.", status: "error", submitType };
  try {
    const created = await prisma.event.create({
      data: {
        shop: session.shop,
        sessionId: session.id,
        name: newEvent.name.trim(),
        type: newEvent.type.toUpperCase().trim(),
        description: ((_c = newEvent.description) == null ? void 0 : _c.trim()) || null
      }
    });
    return { message: "Event created successfully.", event: created, status: "success", submitType };
  } catch (err) {
    console.error("Create Event Error:", err);
    const msg = err.code === "P2002" ? "An event with this name or type already exists." : "Failed to create event. Please try again.";
    return { message: msg, status: "error", submitType };
  }
}
async function handleUpdateEvent({ formData, session }) {
  var _a2, _b, _c;
  const submitType = "updateEvent";
  const updatedEvent = JSON.parse(formData.get("event") || "{}");
  if (!updatedEvent.id || !((_a2 = updatedEvent.name) == null ? void 0 : _a2.trim()) || !((_b = updatedEvent.type) == null ? void 0 : _b.trim()))
    return { message: "ID, Name, and Type are required.", status: "error", submitType };
  try {
    const event = await prisma.event.update({
      where: { id: parseInt(updatedEvent.id), sessionId: session.id },
      data: {
        name: updatedEvent.name.trim(),
        type: updatedEvent.type.toUpperCase().trim(),
        description: ((_c = updatedEvent.description) == null ? void 0 : _c.trim()) || null,
        isActive: updatedEvent.isActive ?? true
      }
    });
    return { message: "Event updated successfully.", event, status: "success", submitType };
  } catch (err) {
    console.error("Update Event Error:", err);
    const msg = err.code === "P2002" ? "An event with this name or type already exists." : "Failed to update event. Please try again.";
    return { message: msg, status: "error", submitType };
  }
}
async function handleDeleteEvent({ formData, session }) {
  const submitType = "deleteEvent";
  const eventId = parseInt(formData.get("eventId"));
  if (!eventId)
    return { message: "Event ID is required.", status: "error", submitType };
  try {
    await prisma.event.delete({
      where: { id: eventId, sessionId: session.id }
    });
    return { message: "Event deleted successfully.", status: "success", submitType };
  } catch (err) {
    console.error("Delete Event Error:", err);
    return { message: "Failed to delete event. Please try again.", status: "error", submitType };
  }
}
function PageHeading({ showAddForm, isAnyBusy, onToggle }) {
  return /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr auto", gap: "large", alignItems: "center", children: [
    /* @__PURE__ */ jsx("h2", { style: { marginBlock: "0" }, children: "Points Events" }),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        icon: showAddForm ? "minus" : "plus",
        variant: showAddForm ? "auto" : "primary",
        disabled: isAnyBusy,
        onClick: onToggle,
        children: showAddForm ? "Cancel" : "Add New Event"
      }
    )
  ] });
}
function AddEventForm({ events, newEvent, setNewEvent, isAdding, onCancel, onSave }) {
  var _a2;
  const usedTypes = new Set(events.map((ev) => ev.type.toUpperCase()));
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsx("h3", { style: { marginBlock: "0" }, children: "Add New Event" }),
    /* @__PURE__ */ jsx("s-box", { paddingBlock: "base", children: /* @__PURE__ */ jsx("s-divider", {}) }),
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-text-field",
        {
          label: "Event Name *",
          value: newEvent.name,
          disabled: isAdding,
          placeholder: "e.g. Order Reward",
          onInput: (e) => setNewEvent((prev) => ({ ...prev, name: e.target.value }))
        }
      ),
      /* @__PURE__ */ jsxs(
        "s-select",
        {
          label: "Event Type *",
          value: newEvent.type,
          disabled: isAdding,
          onChange: (e) => setNewEvent((prev) => ({ ...prev, type: e.target.value })),
          children: [
            /* @__PURE__ */ jsx("s-option", { value: "", children: "Select event type…" }),
            EVENT_TYPES.map(({ value, label: label2 }) => {
              const alreadyUsed = usedTypes.has(value);
              return /* @__PURE__ */ jsxs("s-option", { value, disabled: alreadyUsed, children: [
                label2,
                alreadyUsed ? " — Already created" : ""
              ] }, value);
            })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(
      "s-text-area",
      {
        label: "Description",
        value: newEvent.description,
        disabled: isAdding,
        placeholder: "Optional description for this event",
        onInput: (e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))
      }
    ),
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", justifyContent: "end", paddingBlockStart: "base", children: [
      /* @__PURE__ */ jsx("s-button", { disabled: isAdding, onClick: onCancel, children: "Cancel" }),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "primary",
          loading: isAdding,
          disabled: isAdding || !((_a2 = newEvent.name) == null ? void 0 : _a2.trim()) || !newEvent.type,
          onClick: onSave,
          children: "Save Event"
        }
      )
    ] })
  ] });
}
function EventsTable({
  paginatedEvents,
  isAnyBusy,
  currentPage,
  totalPages,
  setCurrentPage,
  onEdit,
  onDelete
}) {
  return /* @__PURE__ */ jsxs("s-section", { children: [
    /* @__PURE__ */ jsxs("s-table", { children: [
      /* @__PURE__ */ jsxs("s-table-header-row", { children: [
        /* @__PURE__ */ jsx("s-table-header", { children: "Name" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Type" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Description" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Active" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Created" }),
        /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
      ] }),
      /* @__PURE__ */ jsx("s-table-body", { children: paginatedEvents.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "6", style: { textAlign: "center", padding: "3rem" }, children: 'No events yet. Click "Add New Event" to create one.' }) }) : paginatedEvents.map((ev) => /* @__PURE__ */ jsxs("s-table-row", { children: [
        /* @__PURE__ */ jsx("s-table-cell", { children: ev.name }),
        /* @__PURE__ */ jsx("s-table-cell", { children: ev.type }),
        /* @__PURE__ */ jsx("s-table-cell", { children: ev.description || "—" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: ev.isActive ? "✅ Yes" : "❌ No" }),
        /* @__PURE__ */ jsx("s-table-cell", { children: new Date(ev.createdAt).toLocaleDateString() }),
        /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsxs("s-stack", { gap: "small", direction: "inline", children: [
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "edit",
              disabled: isAnyBusy,
              onClick: () => onEdit(ev),
              commandFor: "edit-event-modal",
              command: "--show"
            }
          ),
          /* @__PURE__ */ jsx(
            "s-button",
            {
              variant: "text",
              size: "small",
              icon: "delete",
              destructive: true,
              disabled: isAnyBusy,
              onClick: () => onDelete(ev),
              commandFor: "delete-event-modal",
              command: "--show"
            }
          )
        ] }) })
      ] }, ev.id)) })
    ] }),
    totalPages > 1 && /* @__PURE__ */ jsxs("s-stack", { direction: "inline", justifyContent: "center", gap: "small", style: { marginBlockStart: "1rem" }, children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === 1 || isAnyBusy,
          onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
          children: "← Prev"
        }
      ),
      /* @__PURE__ */ jsxs("s-text", { children: [
        "Page ",
        currentPage,
        " of ",
        totalPages
      ] }),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "plain",
          disabled: currentPage === totalPages || isAnyBusy,
          onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
          children: "Next →"
        }
      )
    ] })
  ] });
}
function EditEventModal({ selectedEvent, setSelectedEvent, isUpdating, onSave }) {
  var _a2, _b;
  return /* @__PURE__ */ jsx("s-modal", { id: "edit-event-modal", heading: "Edit Points Event", size: "base", children: selectedEvent && /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("s-grid", { gridTemplateColumns: "1fr 1fr", gap: "base", children: [
      /* @__PURE__ */ jsx(
        "s-text-field",
        {
          label: "Name *",
          value: selectedEvent.name ?? "",
          disabled: isUpdating,
          onInput: (e) => setSelectedEvent((prev) => ({ ...prev, name: e.target.value }))
        }
      ),
      /* @__PURE__ */ jsxs(
        "s-select",
        {
          label: "Event Type",
          value: selectedEvent.type ?? "",
          disabled: true,
          details: "Event type cannot be changed after creation.",
          children: [
            EVENT_TYPES.map(({ value, label: label2 }) => /* @__PURE__ */ jsx("s-option", { value, children: label2 }, value)),
            !EVENT_TYPES.some((t) => t.value === selectedEvent.type) && /* @__PURE__ */ jsx("s-option", { value: selectedEvent.type, children: selectedEvent.type })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(
      "s-text-area",
      {
        label: "Description",
        value: selectedEvent.description ?? "",
        disabled: isUpdating,
        onInput: (e) => setSelectedEvent((prev) => ({ ...prev, description: e.target.value }))
      }
    ),
    /* @__PURE__ */ jsx("s-box", { paddingBlockEnd: "base" }),
    /* @__PURE__ */ jsx(
      "s-switch",
      {
        label: selectedEvent.isActive ? "Active" : "Inactive",
        checked: !!selectedEvent.isActive,
        disabled: isUpdating,
        onChange: (e) => setSelectedEvent((prev) => ({ ...prev, isActive: e.target.checked }))
      }
    ),
    /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "base", justifyContent: "end", paddingBlockStart: "base", children: [
      /* @__PURE__ */ jsx(
        "s-button",
        {
          commandFor: "edit-event-modal",
          command: "--hide",
          disabled: isUpdating,
          onClick: () => setSelectedEvent(null),
          children: "Discard"
        }
      ),
      /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "primary",
          loading: isUpdating,
          disabled: isUpdating || !((_a2 = selectedEvent.name) == null ? void 0 : _a2.trim()) || !((_b = selectedEvent.type) == null ? void 0 : _b.trim()),
          onClick: onSave,
          commandFor: "edit-event-modal",
          command: "--hide",
          children: "Save Changes"
        }
      )
    ] })
  ] }) });
}
function DeleteEventModal({ selectedEvent, isDeleting, onConfirm }) {
  return /* @__PURE__ */ jsxs("s-modal", { id: "delete-event-modal", heading: "Delete Points Event", size: "small", children: [
    /* @__PURE__ */ jsxs("s-paragraph", { color: "subdued", children: [
      "Are you sure you want to delete ",
      /* @__PURE__ */ jsx("strong", { children: selectedEvent == null ? void 0 : selectedEvent.name }),
      "? This will also remove any associated points rules. This action cannot be undone."
    ] }),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "secondary-actions",
        commandFor: "delete-event-modal",
        command: "--hide",
        disabled: isDeleting,
        children: "Cancel"
      }
    ),
    /* @__PURE__ */ jsx(
      "s-button",
      {
        slot: "primary-action",
        variant: "primary",
        destructive: true,
        loading: isDeleting,
        disabled: isDeleting,
        onClick: onConfirm,
        commandFor: "delete-event-modal",
        command: "--hide",
        children: "Yes, Delete"
      }
    )
  ] });
}
const loader$8 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const events = await prisma.event.findMany({
    where: {
      sessionId: session.id
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  return {
    events
  };
};
const action$f = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const submitType = formData.get("submitType");
  const ctx = {
    formData,
    session
  };
  switch (submitType) {
    case "addEvent":
      return handleAddEvent(ctx);
    case "updateEvent":
      return handleUpdateEvent(ctx);
    case "deleteEvent":
      return handleDeleteEvent(ctx);
    default:
      return {
        message: "Invalid action.",
        status: "error",
        submitType
      };
  }
};
const route$1 = UNSAFE_withComponentProps(function EventsPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const page = useEventsPage(loaderData, actionData);
  const handleEditClick = (ev) => page.setSelectedEvent({
    ...ev
  });
  const handleDeleteClick = (ev) => page.setSelectedEvent(ev);
  return /* @__PURE__ */ jsxs("s-page", {
    inlineSize: "base",
    children: [/* @__PURE__ */ jsx("s-section", {
      children: /* @__PURE__ */ jsx(PageHeading, {
        showAddForm: page.showAddForm,
        isAnyBusy: page.isAnyBusy,
        onToggle: page.toggleAddForm
      })
    }), page.showAddForm ? /* @__PURE__ */ jsx(AddEventForm, {
      events: page.events,
      newEvent: page.newEvent,
      setNewEvent: page.setNewEvent,
      isAdding: page.isAdding,
      onCancel: page.cancelAddForm,
      onSave: page.handleAddEvent
    }) : /* @__PURE__ */ jsx(EventsTable, {
      paginatedEvents: page.paginatedEvents,
      isAnyBusy: page.isAnyBusy,
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      setCurrentPage: page.setCurrentPage,
      onEdit: handleEditClick,
      onDelete: handleDeleteClick
    }), /* @__PURE__ */ jsx(EditEventModal, {
      selectedEvent: page.selectedEvent,
      setSelectedEvent: page.setSelectedEvent,
      isUpdating: page.isUpdating,
      onSave: page.handleUpdateEvent
    }), /* @__PURE__ */ jsx(DeleteEventModal, {
      selectedEvent: page.selectedEvent,
      isDeleting: page.isDeleting,
      onConfirm: page.handleDeleteEvent
    })]
  });
});
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$f,
  default: route$1,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
const DEFAULT_PAGE_SIZE = 25;
async function loadJobsData({ status, type, page = 1, perPage = DEFAULT_PAGE_SIZE }) {
  const where = {
    ...status ? { status } : {},
    ...type ? { type } : {}
  };
  const [jobs, total, distinctTypes] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    }),
    prisma.job.count({ where }),
    prisma.job.findMany({
      distinct: ["type"],
      select: { type: true },
      orderBy: { type: "asc" }
    })
  ]);
  return {
    jobs,
    total,
    page,
    perPage,
    types: distinctTypes.map((t) => t.type)
  };
}
async function transition(formData, data) {
  const mode = formData.get("mode");
  const fromStatus = formData.get("fromStatus");
  let where;
  if (mode === "one") {
    where = { id: Number(formData.get("jobId")), status: fromStatus };
  } else if (mode === "many") {
    const ids = (formData.get("jobIds") || "").split(",").map(Number).filter(Boolean);
    where = { id: { in: ids }, status: fromStatus };
  } else if (mode === "group") {
    where = { type: formData.get("type"), status: fromStatus };
  } else {
    throw new Error(`Unknown mode: "${mode}"`);
  }
  const { count } = await prisma.job.updateMany({ where, data });
  return count;
}
function requeueData() {
  return {
    status: "PENDING",
    attempts: 0,
    lockedAt: null,
    failedAt: null,
    runAt: /* @__PURE__ */ new Date()
  };
}
function describeMode(formData, count) {
  const mode = formData.get("mode");
  if (mode === "one") return `Job #${formData.get("jobId")}`;
  if (mode === "many") return `${count} selected job(s)`;
  return `${count} "${formData.get("type")}" job(s)`;
}
async function handleCancel({ formData }) {
  const count = await transition(formData, { status: "CANCELLED" });
  return { ok: true, intent: "cancel", message: `${describeMode(formData, count)} cancelled.` };
}
async function handleRetry({ formData }) {
  const count = await transition(formData, requeueData());
  return { ok: true, intent: "retry", message: `${describeMode(formData, count)} re-queued.` };
}
async function handleForceReset({ formData }) {
  const count = await transition(formData, {
    ...requeueData(),
    lastError: "Manually force-reset from PROCESSING via admin UI"
  });
  return { ok: true, intent: "forceReset", message: `${describeMode(formData, count)} reset to PENDING.` };
}
async function handleDelete({ formData }) {
  const mode = formData.get("mode");
  const fromStatus = formData.get("fromStatus");
  let where;
  if (mode === "one") {
    where = { id: Number(formData.get("jobId")), status: fromStatus };
  } else if (mode === "many") {
    const ids = (formData.get("jobIds") || "").split(",").map(Number).filter(Boolean);
    where = { id: { in: ids }, status: fromStatus };
  } else if (mode === "group") {
    where = { type: formData.get("type"), status: fromStatus };
  } else {
    return { ok: false, intent: "delete", message: "Unknown mode." };
  }
  const { count } = await prisma.job.deleteMany({ where });
  return { ok: true, intent: "delete", message: `${describeMode(formData, count)} deleted.` };
}
const STATUS_TONE = {
  PENDING: "info",
  PROCESSING: "attention",
  COMPLETED: "success",
  FAILED: "critical",
  CANCELLED: "neutral"
};
const MODAL_ID$1 = "jobs-confirm-modal";
const SELECTABLE_STATUSES = ["PENDING", "PROCESSING", "FAILED", "CANCELLED", "COMPLETED"];
function formatDate(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString(void 0, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}
function RowActions({ job, onRequestAction }) {
  const base = { mode: "one", jobId: String(job.id), fromStatus: job.status };
  switch (job.status) {
    case "PENDING":
      return /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "tertiary",
          tone: "critical",
          commandFor: MODAL_ID$1,
          command: "--show",
          onClick: () => onRequestAction({
            ...base,
            intent: "cancel",
            confirmHeading: "Cancel this job?",
            confirmText: `Job #${job.id} (${job.type}) will be marked CANCELLED and will not run.`
          }),
          children: "Cancel"
        }
      );
    case "PROCESSING":
      return /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "tertiary",
          commandFor: MODAL_ID$1,
          command: "--show",
          onClick: () => onRequestAction({
            ...base,
            intent: "forceReset",
            confirmHeading: "Force reset this job?",
            confirmText: `Job #${job.id} (${job.type}) will be reset to PENDING immediately. Only do this if you're sure it's actually stuck, not genuinely still running.`
          }),
          children: "Force reset"
        }
      );
    case "FAILED":
      return /* @__PURE__ */ jsxs("s-stack", { direction: "inline", gap: "small-200", children: [
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "tertiary",
            commandFor: MODAL_ID$1,
            command: "--show",
            onClick: () => onRequestAction({
              ...base,
              intent: "retry",
              confirmHeading: "Retry this job?",
              confirmText: `Job #${job.id} (${job.type}) will be re-queued as PENDING and picked up on the next poller cycle.`
            }),
            children: "Retry"
          }
        ),
        /* @__PURE__ */ jsx(
          "s-button",
          {
            variant: "tertiary",
            tone: "critical",
            commandFor: MODAL_ID$1,
            command: "--show",
            onClick: () => onRequestAction({
              ...base,
              intent: "cancel",
              confirmHeading: "Cancel this job?",
              confirmText: `Job #${job.id} (${job.type}) will be marked CANCELLED permanently (until manually requeued).`
            }),
            children: "Cancel"
          }
        )
      ] });
    case "CANCELLED":
      return /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "tertiary",
          commandFor: MODAL_ID$1,
          command: "--show",
          onClick: () => onRequestAction({
            ...base,
            intent: "retry",
            confirmHeading: "Requeue this job?",
            confirmText: `Job #${job.id} (${job.type}) will be set back to PENDING and processed again.`
          }),
          children: "Requeue"
        }
      );
    case "COMPLETED":
      return /* @__PURE__ */ jsx(
        "s-button",
        {
          variant: "tertiary",
          tone: "critical",
          commandFor: MODAL_ID$1,
          command: "--show",
          onClick: () => onRequestAction({
            ...base,
            intent: "delete",
            confirmHeading: "Delete this job permanently?",
            confirmText: `Job #${job.id} (${job.type}) will be permanently deleted. This cannot be undone, and removes its idempotency protection against a re-delivered webhook.`
          }),
          children: "Delete"
        }
      );
    default:
      return null;
  }
}
function JobsTable({
  jobs,
  selectedIds,
  onToggleSelect,
  onToggleSelectAllPage,
  allPageSelected,
  onRequestAction
}) {
  const anySelectableOnPage = jobs.some((j) => SELECTABLE_STATUSES.includes(j.status));
  return /* @__PURE__ */ jsx("s-section", { padding: "none", children: /* @__PURE__ */ jsxs("s-table", { children: [
    /* @__PURE__ */ jsxs("s-table-header-row", { children: [
      /* @__PURE__ */ jsx("s-table-header", { children: anySelectableOnPage && /* @__PURE__ */ jsx(
        "s-checkbox",
        {
          checked: allPageSelected,
          onChange: onToggleSelectAllPage,
          accessibilityLabel: "Select all jobs on this page"
        }
      ) }),
      /* @__PURE__ */ jsx("s-table-header", { children: "ID" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Type" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Shop" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Status" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Attempts" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Last Error" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Failed At" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Updated" }),
      /* @__PURE__ */ jsx("s-table-header", { children: "Actions" })
    ] }),
    /* @__PURE__ */ jsx("s-table-body", { children: jobs.length === 0 ? /* @__PURE__ */ jsx("s-table-row", { children: /* @__PURE__ */ jsx("s-table-cell", { colSpan: "10", children: /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "No jobs found for this filter." }) }) }) : jobs.map((job) => /* @__PURE__ */ jsxs("s-table-row", { children: [
      /* @__PURE__ */ jsx("s-table-cell", { children: SELECTABLE_STATUSES.includes(job.status) && /* @__PURE__ */ jsx(
        "s-checkbox",
        {
          checked: selectedIds.includes(job.id),
          onChange: () => onToggleSelect(job.id),
          accessibilityLabel: `Select job #${job.id}`
        }
      ) }),
      /* @__PURE__ */ jsxs("s-table-cell", { children: [
        "#",
        job.id
      ] }),
      /* @__PURE__ */ jsx("s-table-cell", { children: job.type }),
      /* @__PURE__ */ jsx("s-table-cell", { children: job.shop }),
      /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx("s-badge", { tone: STATUS_TONE[job.status] || "neutral", children: job.status }) }),
      /* @__PURE__ */ jsxs("s-table-cell", { children: [
        job.attempts,
        " / ",
        job.maxAttempts,
        job.autoRetryCount > 0 && /* @__PURE__ */ jsxs("s-text", { tone: "subdued", children: [
          " (auto x",
          job.autoRetryCount,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsx("s-table-cell", { children: job.lastError ? /* @__PURE__ */ jsx("s-text", { tone: "critical", children: job.lastError.length > 60 ? job.lastError.slice(0, 60) + "…" : job.lastError }) : /* @__PURE__ */ jsx("s-text", { tone: "subdued", children: "—" }) }),
      /* @__PURE__ */ jsx("s-table-cell", { children: formatDate(job.failedAt) }),
      /* @__PURE__ */ jsx("s-table-cell", { children: formatDate(job.updatedAt) }),
      /* @__PURE__ */ jsx("s-table-cell", { children: /* @__PURE__ */ jsx(RowActions, { job, onRequestAction }) })
    ] }, job.id)) })
  ] }) });
}
const STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];
const MODAL_ID = "jobs-confirm-modal";
const BULK_ACTIONS_BY_STATUS = {
  PENDING: [{
    intent: "cancel",
    label: "Cancel",
    tone: "critical",
    verb: "cancelled"
  }],
  PROCESSING: [{
    intent: "forceReset",
    label: "Force reset",
    verb: "reset to PENDING"
  }],
  FAILED: [{
    intent: "retry",
    label: "Retry",
    verb: "re-queued as PENDING"
  }, {
    intent: "cancel",
    label: "Cancel",
    tone: "critical",
    verb: "cancelled"
  }],
  CANCELLED: [{
    intent: "retry",
    label: "Requeue",
    verb: "re-queued as PENDING"
  }],
  COMPLETED: [{
    intent: "delete",
    label: "Delete",
    tone: "critical",
    verb: "permanently deleted"
  }]
};
const loader$7 = async ({
  request
}) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.has("status") ? url.searchParams.get("status") : "FAILED";
  const type = url.searchParams.get("type") || "";
  const page = Number(url.searchParams.get("page")) || 1;
  const perPage = Number(url.searchParams.get("perPage")) || DEFAULT_PAGE_SIZE;
  const data = await loadJobsData({
    status: status || void 0,
    type: type || void 0,
    page,
    perPage
  });
  return {
    ...data,
    status,
    type
  };
};
const action$e = async ({
  request
}) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  switch (intent) {
    case "cancel":
      return handleCancel({
        formData
      });
    case "retry":
      return handleRetry({
        formData
      });
    case "forceReset":
      return handleForceReset({
        formData
      });
    case "delete":
      return handleDelete({
        formData
      });
    default:
      return {
        ok: false,
        message: "Unknown intent."
      };
  }
};
const route = UNSAFE_withComponentProps(function JobsPage() {
  var _a2;
  const {
    jobs,
    total,
    page,
    perPage,
    types,
    status,
    type
  } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const [selectedIds, setSelectedIds] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startIndex = (page - 1) * perPage;
  const bulkActions = BULK_ACTIONS_BY_STATUS[status] || [];
  const selectableIdsOnPage = useMemo(() => bulkActions.length ? jobs.map((j) => j.id) : [], [jobs, bulkActions.length]);
  const allPageSelected = selectableIdsOnPage.length > 0 && selectableIdsOnPage.every((id) => selectedIds.includes(id));
  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.set("page", "1");
    setSearchParams(next);
    setSelectedIds([]);
  }
  function setCurrentPage(valueOrFn) {
    const newPage = typeof valueOrFn === "function" ? valueOrFn(page) : valueOrFn;
    const next = new URLSearchParams(searchParams);
    next.set("page", String(newPage));
    setSearchParams(next);
  }
  function setPerPage(valueOrFn) {
    const newPerPage = typeof valueOrFn === "function" ? valueOrFn(perPage) : valueOrFn;
    const next = new URLSearchParams(searchParams);
    next.set("perPage", String(newPerPage));
    next.set("page", "1");
    setSearchParams(next);
  }
  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleSelectAllPage() {
    setSelectedIds((prev) => allPageSelected ? prev.filter((id) => !selectableIdsOnPage.includes(id)) : [.../* @__PURE__ */ new Set([...prev, ...selectableIdsOnPage])]);
  }
  function requestAction(payload) {
    setPendingAction(payload);
  }
  function confirmPendingAction() {
    if (pendingAction) {
      const {
        confirmHeading,
        confirmText,
        ...formPayload
      } = pendingAction;
      fetcher.submit(formPayload, {
        method: "post"
      });
    }
    setPendingAction(null);
    setSelectedIds([]);
  }
  function requestBulkAction({
    intent,
    verb
  }) {
    requestAction({
      intent,
      mode: "many",
      jobIds: selectedIds.join(","),
      fromStatus: status,
      confirmHeading: `${intent === "delete" ? "Delete" : "Update"} ${selectedIds.length} job(s)?`,
      confirmText: `${selectedIds.length} selected job(s) will be ${verb}.`
    });
  }
  function requestGroupAction({
    intent,
    verb
  }) {
    requestAction({
      intent,
      mode: "group",
      type,
      fromStatus: status,
      confirmHeading: `${intent === "delete" ? "Delete" : "Update"} all ${status} "${type}" jobs?`,
      confirmText: `Every ${status} job of type "${type}" will be ${verb}. The exact count is checked at the time this runs.`
    });
  }
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Background Jobs",
    children: [/* @__PURE__ */ jsxs("s-section", {
      heading: "Filters",
      children: [/* @__PURE__ */ jsxs("s-stack", {
        direction: "inline",
        gap: "base",
        children: [/* @__PURE__ */ jsxs("s-select", {
          label: "Status",
          value: status,
          onChange: (e) => updateParam("status", e.currentTarget.value),
          children: [/* @__PURE__ */ jsx("s-option", {
            value: "",
            selected: status === "",
            children: "All statuses"
          }), STATUSES.map((s) => /* @__PURE__ */ jsx("s-option", {
            value: s,
            selected: status === s,
            children: s
          }, s))]
        }), /* @__PURE__ */ jsxs("s-select", {
          label: "Type",
          value: type,
          onChange: (e) => updateParam("type", e.currentTarget.value),
          children: [/* @__PURE__ */ jsx("s-option", {
            value: "",
            selected: type === "",
            children: "All types"
          }), types.map((t) => /* @__PURE__ */ jsx("s-option", {
            value: t,
            selected: type === t,
            children: t
          }, t))]
        })]
      }), !status && /* @__PURE__ */ jsx("s-paragraph", {
        tone: "subdued",
        children: "Bulk and group actions are only available when filtered to a specific status — pick one above to select rows or act on a whole type at once."
      }), ((_a2 = fetcher.data) == null ? void 0 : _a2.message) && /* @__PURE__ */ jsx("s-paragraph", {
        tone: fetcher.data.ok ? "success" : "critical",
        children: fetcher.data.message
      })]
    }), /* @__PURE__ */ jsxs("s-section", {
      heading: `${total} job(s)`,
      children: [bulkActions.length > 0 && /* @__PURE__ */ jsxs("s-stack", {
        direction: "inline",
        gap: "base",
        children: [bulkActions.map((a) => /* @__PURE__ */ jsxs("s-button", {
          variant: "secondary",
          tone: a.tone,
          disabled: selectedIds.length === 0,
          commandFor: MODAL_ID,
          command: "--show",
          onClick: () => requestBulkAction(a),
          children: [a.label, " selected (", selectedIds.length, ")"]
        }, `bulk-${a.intent}`)), type && bulkActions.map((a) => /* @__PURE__ */ jsxs("s-button", {
          variant: "secondary",
          tone: a.tone,
          commandFor: MODAL_ID,
          command: "--show",
          onClick: () => requestGroupAction(a),
          children: [a.label, " all ", status, ' "', type, '" jobs']
        }, `group-${a.intent}`))]
      }), /* @__PURE__ */ jsx(JobsTable, {
        jobs,
        selectedIds,
        onToggleSelect: toggleSelect,
        onToggleSelectAllPage: toggleSelectAllPage,
        allPageSelected,
        onRequestAction: requestAction
      }), /* @__PURE__ */ jsx(Pagination, {
        currentPage: page,
        totalPages,
        totalItems: total,
        perPage,
        startIndex,
        setCurrentPage,
        setPerPage,
        label: "jobs"
      })]
    }), /* @__PURE__ */ jsxs("s-modal", {
      id: MODAL_ID,
      heading: (pendingAction == null ? void 0 : pendingAction.confirmHeading) || "Confirm action",
      accessibilityLabel: (pendingAction == null ? void 0 : pendingAction.confirmHeading) || "Confirm action",
      children: [/* @__PURE__ */ jsx("s-text", {
        children: pendingAction == null ? void 0 : pendingAction.confirmText
      }), /* @__PURE__ */ jsx("s-button", {
        slot: "primary-action",
        variant: "primary",
        commandFor: MODAL_ID,
        command: "--hide",
        onClick: confirmPendingAction,
        children: "Confirm"
      }), /* @__PURE__ */ jsx("s-button", {
        slot: "secondary-actions",
        variant: "secondary",
        commandFor: MODAL_ID,
        command: "--hide",
        onClick: () => setPendingAction(null),
        children: "Cancel"
      })]
    })]
  });
});
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$e,
  default: route,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
function getCorsHeaders(request) {
  var _a2;
  const origin = (_a2 = request.headers.get("origin")) == null ? void 0 : _a2.toLowerCase();
  const allowedOrigins = [
    "https://www.northborders.co",
    "https://northborders.co"
    // www chara version, jodi lagey
  ];
  const isShopifyOrigin = origin && (origin.endsWith(".myshopify.com") || origin.endsWith(".shopify.com"));
  const isAllowedCustomOrigin = origin && allowedOrigins.includes(origin);
  if (isShopifyOrigin || isAllowedCustomOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": "application/json",
      "Vary": "Origin"
    };
  }
  return { "Content-Type": "application/json" };
}
const RETRY_CONFIG = {
  // 🔁 Total attempts (1 initial + retries)
  maxAttempts: 4,
  // ⏳ Balanced delay (slightly higher than 1s for production safety)
  baseDelayMs: 1200,
  // 📈 Exponential backoff (1.2s → 2.4s → 4.8s → 9.6s)
  backoffFactor: 2,
  // ⛔ Max delay cap (avoid too long wait)
  maxDelayMs: 3e4,
  // 30s
  // 🎲 Small jitter to avoid retry spikes
  jitterFactor: 0.3,
  // ⚠️ Retry all by default (can override per use-case)
  retryableErrors: [],
  // 🧠 Default context (auto used in logger)
  context: {
    app: "NBL"
  }
};
const withRetry = async (fn, options = {}) => {
  const config = { ...RETRY_CONFIG, ...options };
  const {
    maxAttempts,
    baseDelayMs,
    backoffFactor,
    maxDelayMs,
    jitterFactor,
    retryableErrors,
    context = {}
  } = config;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.success(
          context.shop,
          `Recovered on attempt ${attempt}/${maxAttempts}`,
          { attempt, maxAttempts, ...context }
        );
      }
      return result;
    } catch (error) {
      lastError = error;
      const message = (error == null ? void 0 : error.message) || "Unknown error";
      if (retryableErrors.length && !retryableErrors.some(
        (e) => typeof e === "string" ? message.toLowerCase().includes(e.toLowerCase()) : typeof e === "function" && error instanceof e
      )) {
        logger.error(
          context.shop,
          `Non-retryable error — aborting`,
          { attempt, maxAttempts, error: message, ...context }
        );
        throw error;
      }
      if (attempt === maxAttempts) {
        logger.error(
          context.shop,
          `All ${maxAttempts} attempts failed`,
          { attempt, maxAttempts, error: message, ...context }
        );
        throw error;
      }
      let delay = baseDelayMs * backoffFactor ** (attempt - 1);
      delay = Math.min(delay, maxDelayMs);
      if (jitterFactor) {
        delay += Math.random() * delay * jitterFactor;
      }
      logger.warn(
        context.shop,
        `Attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`,
        { attempt, maxAttempts, error: message, delayMs: Math.round(delay), ...context }
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
};
const MODULE$9 = "api.claim-prize.jsx";
async function action$d({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return corsResponse$1(null, 204, corsHeaders);
  if (request.method !== "POST") return corsResponse$1({
    error: "Method not allowed"
  }, 405, corsHeaders);
  try {
    const body = await request.json();
    validateRequestBody$1(body);
    const {
      shop,
      customerId,
      customerIndex,
      prizeId
    } = body;
    const [customer2, {
      admin,
      session
    }] = await Promise.all([getValidCustomer$1(customerIndex), unauthenticated.admin(shop)]);
    if (!session) throw new AppError$1("Valid shop session required", 401);
    if (!customer2) throw new AppError$1("Customer not found", 404);
    const prize = await getValidPrize(prizeId);
    if (!prize) throw new AppError$1("Prize not found", 404);
    if (!prize.isActive) throw new AppError$1("This prize is no longer available", 422);
    if (prize.pointsCost > customer2.points) {
      throw new AppError$1(`Insufficient points. Required: ${prize.pointsCost}, Available: ${customer2.points}`, 422);
    }
    const {
      claim,
      pointsCost
    } = await claimPrize({
      session,
      customer: customer2,
      prize
    });
    const updatedCustomer = await withRetry(() => syncCustomerConfig(admin, customerId), {
      maxAttempts: 3,
      baseDelayMs: 800,
      retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT", "Something went wrong. Please try again later."],
      context: {
        module: MODULE$9,
        claimId: claim.id,
        shop
      }
    }).catch((err) => {
      logger.error("Metafield sync failed after all retries — claim is still valid", {
        module: MODULE$9,
        claimId: claim.id,
        error: err == null ? void 0 : err.message
      });
      return null;
    });
    logger.info("Prize claimed successfully", {
      module: MODULE$9,
      customerId,
      customerIndex,
      prizeId,
      claimId: claim.id
    });
    return corsResponse$1({
      shop,
      claimId: claim.id,
      prizeId: prize.id,
      status: claim.status,
      title: prize.title,
      points: (updatedCustomer == null ? void 0 : updatedCustomer.points) ?? null,
      pointsCost: -pointsCost,
      createdAt: claim.createdAt
    }, 200, corsHeaders);
  } catch (err) {
    const statusCode = err instanceof AppError$1 ? err.statusCode : 500;
    logger.error("Claim prize api error", err, {
      module: MODULE$9
    });
    return corsResponse$1({
      error: "Claim prize api error",
      details: err.message
    }, statusCode, corsHeaders);
  }
}
async function loader$6({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return corsResponse$1(null, 204, corsHeaders);
  return corsResponse$1({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, corsHeaders);
}
async function claimPrize({
  session,
  customer: customer2,
  prize
}) {
  const pointsCost = Math.abs(Number(prize.pointsCost) || 0);
  const claim = await prisma.physicalPrizeClaim.create({
    data: {
      status: "PENDING",
      pointsCost,
      customer: {
        connect: {
          id: customer2.id
        }
      },
      prize: {
        connect: {
          id: prize.id
        }
      }
    }
  });
  const transaction = await createTransaction({
    customerId: customer2.id,
    type: "REDEEM",
    reason: `${pointsCost} points redeemed for prize: ${prize.title}`,
    activity: `-${pointsCost} points redeemed for prize: ${prize.title}`,
    points: pointsCost,
    status: "COMPLETED",
    // Customer is live in the widget right now and sees the claim
    // confirmation on screen immediately — never surface this as a
    // toast on a later visit.
    notifiedAt: /* @__PURE__ */ new Date()
  }, session);
  if (!transaction) {
    logger.error("Transaction failed — cancelling prize claim", {
      module: MODULE$9,
      claimId: claim.id,
      customerId: customer2.id,
      prizeId: prize.id
    });
    await prisma.physicalPrizeClaim.update({
      where: {
        id: claim.id
      },
      data: {
        status: "CANCELLED"
      }
    });
    throw new AppError$1("Points deduction failed. Please try again.", 500);
  }
  await prisma.physicalPrizeClaim.update({
    where: {
      id: claim.id
    },
    data: {
      transactionId: transaction.id
    }
  });
  return {
    claim,
    pointsCost
  };
}
function validateRequestBody$1({
  shop,
  customerId,
  customerIndex,
  prizeId
}) {
  if (!shop) throw new AppError$1("Valid shop required", 400);
  if (!customerId || !customerIndex) throw new AppError$1("Valid customer required", 400);
  if (!prizeId) throw new AppError$1("Valid prizeId required", 400);
}
async function getValidPrize(id) {
  try {
    return await prisma.physicalPrize.findFirst({
      where: {
        id: Number(id)
      }
    });
  } catch (error) {
    logger.error("Failed to fetch prize", {
      module: MODULE$9,
      prizeId: id,
      error: error == null ? void 0 : error.message
    });
    return null;
  }
}
async function getValidCustomer$1(id) {
  try {
    return await prisma.customer.findFirst({
      where: {
        id: Number(id)
      }
    });
  } catch (error) {
    logger.error("Failed to fetch customer", {
      module: MODULE$9,
      customerIndex: id,
      error: error == null ? void 0 : error.message
    });
    return null;
  }
}
function corsResponse$1(body, status, corsHeaders) {
  return new Response(body !== null ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
let AppError$1 = class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
};
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const PREFIX = "NBL";
const MAX_ATTEMPTS = 5;
function generateCode() {
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `${PREFIX}_${random}`;
}
async function generateDiscountCode() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    const exists = await prisma.reward.findFirst({
      where: { code },
      select: { id: true }
    });
    if (!exists) {
      if (attempt > 1) {
        logger.info(`Discount code generated after ${attempt} attempts`, { code });
      }
      return code;
    }
    logger.warn(`Discount code collision on attempt ${attempt}/${MAX_ATTEMPTS}`, { code });
  }
  throw new Error(`Failed to generate a unique discount code after ${MAX_ATTEMPTS} attempts`);
}
const generateRewardVoucher = async (admin, customerId, rewardRule) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  if (!(admin == null ? void 0 : admin.graphql)) throw new Error("Something went wrong. Please try again later.");
  if (!customerId) throw new Error("Customer not found. Please login again.");
  if (!(rewardRule == null ? void 0 : rewardRule.id)) throw new Error("Reward is not available right now.");
  if (!["fixed", "percentage"].includes(rewardRule.discountType)) throw new Error("Invalid reward configuration.");
  const customerGid = normalizeCustomerGid(customerId);
  if (!customerGid) throw new Error("Invalid customer. Please try again.");
  const ctx = { customerId, rewardRuleId: rewardRule.id };
  const code = await generateDiscountCode().catch((err) => {
    logger.error("Failed to generate discount code", err, ctx);
    throw new Error("Something went wrong. Please try again later.");
  });
  const discountValue = buildDiscountValue(rewardRule);
  const json = await runDiscountMutation(admin, { code, customerGid, discountValue }).catch((err) => {
    logger.error("Shopify GraphQL request failed", err, ctx);
    throw new Error("Something went wrong. Please try again later.");
  });
  const userErrors = (_b = (_a2 = json == null ? void 0 : json.data) == null ? void 0 : _a2.discountCodeBasicCreate) == null ? void 0 : _b.userErrors;
  if (userErrors == null ? void 0 : userErrors.length) {
    logger.error("Shopify userErrors", { userErrors, ...ctx });
    throw new Error("Failed to create voucher. Please try again.");
  }
  const discountCode = (_i = (_h = (_g = (_f = (_e = (_d = (_c = json == null ? void 0 : json.data) == null ? void 0 : _c.discountCodeBasicCreate) == null ? void 0 : _d.codeDiscountNode) == null ? void 0 : _e.codeDiscount) == null ? void 0 : _f.codes) == null ? void 0 : _g.nodes) == null ? void 0 : _h[0]) == null ? void 0 : _i.code;
  if (!discountCode) {
    logger.error("Discount code missing in response", { json, ...ctx });
    throw new Error("Something went wrong while generating your reward. Please try again.");
  }
  logger.success("Reward voucher created", { discountCode, ...ctx });
  return discountCode;
};
function buildDiscountValue({ discountType, rewardValue }) {
  if (discountType === "fixed") {
    return {
      discountAmount: {
        amount: String(rewardValue ?? 0),
        appliesOnEachItem: false
      }
    };
  }
  const raw = Number(rewardValue ?? 0);
  return { percentage: Math.min(1, raw > 1 ? raw / 100 : raw) };
}
async function runDiscountMutation(admin, { code, customerGid, discountValue }) {
  const response = await admin.graphql(
    `#graphql
        mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
                codeDiscountNode {
                    id
                    codeDiscount {
                        ... on DiscountCodeBasic {
                            title
                            codes(first: 1) {
                                nodes { code }
                            }
                        }
                    }
                }
                userErrors { field message }
            }
        }`,
    {
      variables: {
        basicCodeDiscount: {
          title: code,
          code,
          startsAt: (/* @__PURE__ */ new Date()).toISOString(),
          endsAt: null,
          customerSelection: { customers: { add: [customerGid] } },
          customerGets: {
            appliesOnOneTimePurchase: true,
            appliesOnSubscription: true,
            value: discountValue,
            items: { all: true }
          },
          usageLimit: 1,
          appliesOncePerCustomer: true
        }
      }
    }
  );
  return response.json();
}
const DEFAULT_REWARD_SELECT = {
  id: true,
  title: true,
  event: true,
  type: true,
  code: true,
  rewardKey: true,
  orderId: true,
  pointsCost: true,
  status: true,
  discountUsed: true,
  usedAt: true,
  expiresAt: true,
  metadata: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  rewardRuleId: true,
  customerId: true
};
const createCustomerReward = async (input2, select = DEFAULT_REWARD_SELECT) => {
  try {
    const customerId = Number(input2.customerId);
    const entityId = input2.orderId || input2.referralId || "0";
    const rewardKey = input2.rewardKey ?? `${input2.event || "EVENT"}:${input2.type || "DEFAULT"}:${customerId}:${entityId}:${input2.code ?? ""}:${input2.title ?? ""}`;
    const reward = await prisma.reward.create({
      data: {
        customerId,
        rewardKey,
        event: input2.event ?? null,
        type: input2.type ?? "DEFAULT",
        status: input2.status ?? "PENDING",
        title: input2.title ?? null,
        description: input2.description ?? null,
        code: input2.code ?? null,
        orderId: input2.orderId ?? null,
        rewardRuleId: input2.rewardRuleId ? Number(input2.rewardRuleId) : null,
        pointsCost: input2.pointsCost !== void 0 ? Number(input2.pointsCost) : null,
        expiresAt: input2.expiresAt ?? null,
        metadata: input2.metadata ?? {}
        // usedAt intentionally omitted — set only when reward is actually used
      },
      select
    });
    logger.info("Customer reward created", {
      rewardId: reward.id,
      customerId,
      event: reward.event,
      type: reward.type,
      rewardKey: reward.rewardKey
    });
    return reward;
  } catch (error) {
    if ((error == null ? void 0 : error.code) === "P2002") {
      logger.warn("Duplicate reward skipped", {
        customerId: input2.customerId,
        event: input2.event,
        type: input2.type
      });
      return null;
    }
    logger.error("Failed to create customer reward", {
      input: input2,
      error: error == null ? void 0 : error.message,
      stack: error == null ? void 0 : error.stack
    });
    return null;
  }
};
const MODULE$8 = "api.get-voucher.jsx";
async function action$c({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return corsResponse(null, 204, corsHeaders);
  if (request.method !== "POST") return corsResponse({
    error: "Method not allowed"
  }, 405, corsHeaders);
  try {
    const body = await request.json();
    validateRequestBody(body);
    const {
      shop,
      customerId,
      customerIndex,
      rewardRuleId,
      title
    } = body;
    logger.info("Received get-voucher request", {
      module: MODULE$8,
      shop,
      rewardRuleId,
      customerIndex
    });
    const [customer2, {
      admin,
      session
    }] = await Promise.all([getValidCustomer(customerIndex), unauthenticated.admin(shop)]);
    if (!session) throw new AppError2("Valid shop session required", 401);
    if (!customer2) throw new AppError2("Customer not found", 404);
    const rewardRule = await getValidRewardRule(rewardRuleId);
    if (!rewardRule) throw new AppError2("Reward rule not found", 404);
    if (!rewardRule.isActive) throw new AppError2("Reward is no longer active", 422);
    if (rewardRule.usageLimit && rewardRule.usageCount >= rewardRule.usageLimit) {
      throw new AppError2("Reward usage limit reached", 422);
    }
    if (rewardRule.usagePerUser) {
      const usedCount = await prisma.reward.count({
        where: {
          customerId: customer2.id,
          rewardRuleId: rewardRule.id,
          status: {
            in: ["ACTIVE", "USED"]
          }
        }
      });
      if (usedCount >= rewardRule.usagePerUser) {
        throw new AppError2("You have reached the usage limit for this reward", 422);
      }
    }
    if (rewardRule.pointsCost > customer2.points) {
      throw new AppError2(`Insufficient points. Required: ${rewardRule.pointsCost}, Available: ${customer2.points}`, 422);
    }
    const {
      voucherCode,
      pointsCost,
      rewardTitle,
      activity,
      createdAt
    } = await redeemReward({
      admin,
      session,
      customer: customer2,
      rewardRule,
      title,
      customerId
    });
    const updatedCustomer = await withRetry(() => syncCustomerConfig(admin, customerId), {
      maxAttempts: 3,
      baseDelayMs: 800,
      retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
      context: {
        shop,
        module: MODULE$8
      }
    }).catch((err) => {
      logger.error("Metafield sync failed after all retries — redemption is still valid", {
        module: MODULE$8,
        error: err == null ? void 0 : err.message
      });
      return null;
    });
    logger.info("Reward redeemed successfully", {
      module: MODULE$8,
      customerId,
      customerIndex,
      rewardRuleId,
      voucherCode
    });
    return corsResponse({
      shop,
      voucherCode,
      title: title || rewardTitle,
      points: (updatedCustomer == null ? void 0 : updatedCustomer.points) ?? null,
      pointsCost: -pointsCost,
      activity,
      createdAt
    }, 200, corsHeaders);
  } catch (err) {
    const statusCode = err instanceof AppError2 ? err.statusCode : 500;
    logger.error("Get voucher api error", err, {
      module: MODULE$8
    });
    return corsResponse({
      error: "Get voucher api error",
      details: err.message
    }, statusCode, corsHeaders);
  }
}
async function loader$5({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return corsResponse(null, 204, corsHeaders);
  return corsResponse({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, corsHeaders);
}
async function redeemReward({
  admin,
  session,
  customer: customer2,
  rewardRule,
  customerId,
  title
}) {
  const shop = session == null ? void 0 : session.shop;
  const voucherCode = await withRetry(() => generateRewardVoucher(admin, customerId, rewardRule), {
    maxAttempts: 3,
    baseDelayMs: 800,
    retryableErrors: [
      "fetch failed",
      "ECONNRESET",
      "ETIMEDOUT",
      // generateRewardVoucher.js catches network errors and re-throws
      // with this message — include it so withRetry can match and retry
      "Something went wrong. Please try again later."
    ],
    context: {
      shop,
      module: MODULE$8,
      customerId,
      rewardRuleId: rewardRule.id
    }
  });
  if (!voucherCode) throw new AppError2("Voucher generation failed", 500);
  const pointsCost = Math.abs(Number(rewardRule.pointsCost) || 0);
  const [newReward] = await Promise.all([createCustomerReward({
    customerId: customer2.id,
    rewardRuleId: rewardRule.id,
    event: "MANUAL",
    type: "REDEEM",
    title: title || rewardRule.title || "Points redemption",
    description: rewardRule.description || "Redeemed points for a discount voucher",
    code: voucherCode,
    pointsCost,
    status: "ACTIVE"
  }), prisma.rewardRule.update({
    where: {
      id: rewardRule.id
    },
    data: {
      usageCount: {
        increment: 1
      }
    }
  })]);
  const transaction = await createTransaction({
    customerId: customer2.id,
    type: "REDEEM",
    reason: `${pointsCost} points redeemed for reward: ${rewardRule.title}`,
    activity: `-${pointsCost} points redeemed for reward: ${rewardRule.title}`,
    points: pointsCost,
    rewardId: newReward == null ? void 0 : newReward.id,
    status: "COMPLETED",
    // Customer is live in the widget right now and sees the voucher
    // code on screen immediately — this should never also surface
    // as a toast notification on a later visit.
    notifiedAt: /* @__PURE__ */ new Date()
  }, session);
  if (!transaction) {
    logger.error("Transaction failed — cancelling reward and rolling back usage count", {
      module: MODULE$8,
      customerId: customer2.id,
      rewardRuleId: rewardRule.id,
      rewardId: newReward == null ? void 0 : newReward.id
    });
    await Promise.allSettled([(newReward == null ? void 0 : newReward.id) ? prisma.reward.update({
      where: {
        id: newReward.id
      },
      data: {
        status: "CANCELLED"
      }
    }) : Promise.resolve(), prisma.rewardRule.update({
      where: {
        id: rewardRule.id
      },
      data: {
        usageCount: {
          decrement: 1
        }
      }
    })]);
    throw new AppError2("Points deduction failed. Please try again.", 500);
  }
  return {
    voucherCode,
    pointsCost,
    rewardTitle: rewardRule.title,
    activity: `-${pointsCost} points redeemed for reward: ${rewardRule.title}`,
    createdAt: (newReward == null ? void 0 : newReward.createdAt) ?? /* @__PURE__ */ new Date()
  };
}
function validateRequestBody({
  shop,
  customerId,
  customerIndex,
  rewardRuleId
}) {
  if (!shop) throw new AppError2("Valid shop required", 400);
  if (!customerId || !customerIndex) throw new AppError2("Valid customer required", 400);
  if (!rewardRuleId) throw new AppError2("Valid rewardRuleId required", 400);
}
async function getValidRewardRule(id) {
  try {
    return await prisma.rewardRule.findFirst({
      where: {
        id: Number(id)
      }
    });
  } catch (error) {
    logger.error("Failed to fetch reward rule", {
      module: MODULE$8,
      rewardRuleId: id,
      error: error == null ? void 0 : error.message
    });
    return null;
  }
}
async function getValidCustomer(id) {
  try {
    return await prisma.customer.findFirst({
      where: {
        id: Number(id)
      }
    });
  } catch (error) {
    logger.error("Failed to fetch customer", {
      module: MODULE$8,
      customerIndex: id,
      error: error == null ? void 0 : error.message
    });
    return null;
  }
}
function corsResponse(body, status, corsHeaders) {
  return new Response(body !== null ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
class AppError2 extends Error {
  /**
   * @param {string} message    - Human-readable error description
   * @param {number} statusCode - HTTP status code to return (default 500)
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const MODULE$7 = "api.join-our-program.jsx";
const HTTP$1 = (
  /** @type {const} */
  {
    OK: 200,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500
  }
);
async function action$b({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: HTTP$1.NO_CONTENT,
      headers: corsHeaders
    });
  }
  if (request.method !== "POST") {
    return jsonResponse$4({
      error: "Method not allowed"
    }, HTTP$1.METHOD_NOT_ALLOWED, corsHeaders);
  }
  let shop, customerId;
  try {
    ({
      shop,
      customerId
    } = await request.json());
  } catch {
    return jsonResponse$4({
      error: "Invalid or malformed JSON body"
    }, HTTP$1.BAD_REQUEST, corsHeaders);
  }
  if (!shop) {
    return jsonResponse$4({
      error: "Field 'shop' is required"
    }, HTTP$1.BAD_REQUEST, corsHeaders);
  }
  if (!customerId) {
    return jsonResponse$4({
      error: "Field 'customerId' is required"
    }, HTTP$1.BAD_REQUEST, corsHeaders);
  }
  try {
    const {
      admin,
      session
    } = await unauthenticated.admin(shop);
    if (!session) {
      return jsonResponse$4({
        error: "No active session found for shop"
      }, HTTP$1.UNAUTHORIZED, corsHeaders);
    }
    logger.info("Join program request received", {
      module: MODULE$7,
      shop,
      customerId
    });
    const customerData = await customer(admin, customerId);
    if (!customerData) {
      return jsonResponse$4({
        error: "Customer not found in Shopify"
      }, HTTP$1.BAD_REQUEST, corsHeaders);
    }
    await storeCustomer(session, customerData);
    await syncCustomerConfig(admin, customerId);
    logger.success("Customer successfully joined program", {
      module: MODULE$7,
      shop,
      customerId
    });
    return jsonResponse$4({
      success: true,
      shop,
      customerId
    }, HTTP$1.OK, corsHeaders);
  } catch (err) {
    logger.error("Unhandled error in join-our-program action", {
      module: MODULE$7,
      shop,
      customerId,
      error: err == null ? void 0 : err.message,
      stack: err == null ? void 0 : err.stack
    });
    return jsonResponse$4({
      error: "Failed to join program",
      details: err == null ? void 0 : err.message
    }, HTTP$1.INTERNAL_SERVER_ERROR, corsHeaders);
  }
}
async function loader$4({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: HTTP$1.NO_CONTENT,
      headers: corsHeaders
    });
  }
  return jsonResponse$4({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, HTTP$1.OK, corsHeaders);
}
function jsonResponse$4(data, status, headers2) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers2
    }
  });
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const getPointRuleByEvent = async (event = null) => {
  if (!event) {
    logger.warn("getPointRuleByEvent called without event type");
    return null;
  }
  try {
    const rule = await prisma.pointsRule.findFirst({
      where: {
        isActive: true,
        event: {
          type: { equals: event, mode: "insensitive" },
          isActive: true
        }
      },
      include: { event: true }
    });
    return rule ?? null;
  } catch (error) {
    logger.error("getPointRuleByEvent error", {
      event,
      message: error == null ? void 0 : error.message
    });
    return null;
  }
};
const generateReferralDiscountCode = async (admin, customerId, referralCode) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  try {
    if (!admin || typeof admin.graphql !== "function") {
      throw new Error("Something went wrong. Please try again later.");
    }
    if (!customerId) {
      throw new Error("Customer not found. Please login again.");
    }
    if (!referralCode || typeof referralCode !== "string") {
      throw new Error("Invalid referral code.");
    }
    const customerGid = normalizeCustomerGid(customerId);
    if (!customerGid) {
      throw new Error("Invalid customer. Please try again.");
    }
    const referralRule = await getPointRuleByEvent("Referral");
    if (!(referralRule == null ? void 0 : referralRule.isActive)) {
      throw new Error("Referral not available right now");
    }
    const referralTrigger = ((_b = (_a2 = referralRule == null ? void 0 : referralRule.conditions) == null ? void 0 : _a2.referral) == null ? void 0 : _b.trigger) ?? "oneTime";
    const referredEarningRule = ((_d = (_c = referralRule == null ? void 0 : referralRule.conditions) == null ? void 0 : _c.referral) == null ? void 0 : _d.referred) ?? null;
    if (!referredEarningRule) {
      throw new Error("Referral reward is not available right now.");
    }
    const code = await generateDiscountCode();
    const title = `${code}_REFERRAL_${referredEarningRule.discountType === "fixed" ? `$${referredEarningRule.discountValue}` : `${referredEarningRule.discountValue}%`}`;
    let discountInput = null;
    if (referredEarningRule.discountType === "fixed") {
      discountInput = {
        discountAmount: {
          amount: String(referredEarningRule.discountValue || 0),
          appliesOnEachItem: false
        }
      };
    } else if (referredEarningRule.discountType === "percentage") {
      const percentValue = Number(referredEarningRule.discountValue || 0);
      discountInput = {
        percentage: Math.min(
          1,
          percentValue > 1 ? percentValue / 100 : percentValue
        )
      };
    } else {
      throw new Error("Invalid reward configuration.");
    }
    const response = await admin.graphql(
      `#graphql
            mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
                discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
                    codeDiscountNode {
                        id
                        codeDiscount {
                            ... on DiscountCodeBasic {
                                title
                                codes(first: 1) {
                                    nodes {
                                        code
                                    }
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`,
      {
        variables: {
          basicCodeDiscount: {
            title,
            code,
            startsAt: (/* @__PURE__ */ new Date()).toISOString(),
            endsAt: null,
            customerSelection: {
              customers: {
                add: [customerGid]
              }
            },
            customerGets: {
              appliesOnOneTimePurchase: referralTrigger === "oneTime" || referralTrigger === "both",
              appliesOnSubscription: referralTrigger === "subscription" || referralTrigger === "both",
              value: discountInput,
              items: { all: true }
            },
            usageLimit: 1,
            appliesOncePerCustomer: true
          }
        }
      }
    );
    const json = await response.json();
    const errors = (_f = (_e = json == null ? void 0 : json.data) == null ? void 0 : _e.discountCodeBasicCreate) == null ? void 0 : _f.userErrors;
    if (errors == null ? void 0 : errors.length) {
      logger.error("Shopify Discount Error", { errors });
      throw new Error("Failed to create discount. Please try again.");
    }
    const discountCode = (_m = (_l = (_k = (_j = (_i = (_h = (_g = json == null ? void 0 : json.data) == null ? void 0 : _g.discountCodeBasicCreate) == null ? void 0 : _h.codeDiscountNode) == null ? void 0 : _i.codeDiscount) == null ? void 0 : _j.codes) == null ? void 0 : _k.nodes) == null ? void 0 : _l[0]) == null ? void 0 : _m.code;
    if (!discountCode) {
      logger.error("Discount code missing in response", { json });
      throw new Error("Something went wrong while generating your reward.");
    }
    logger.success("Discount code created", {
      customerId,
      referralCode,
      discountCode
    });
    return discountCode;
  } catch (error) {
    logger.error("generateReferralDiscountCode failed", {
      message: error.message,
      stack: error.stack,
      customerId,
      referralCode
    });
    throw new Error(error.message || "Something went wrong. Please try again.");
  }
};
const MODULE$6 = "api.get-referral-discount";
const REFERRAL_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REDEEMED: "REDEEMED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
};
const ERROR_CODES$1 = {
  // 400
  INVALID_INPUT: {
    code: "INVALID_INPUT",
    status: 400
  },
  // 404
  INVALID_REFERRAL_CODE: {
    code: "INVALID_REFERRAL_CODE",
    status: 404
  },
  CUSTOMER_NOT_FOUND: {
    code: "CUSTOMER_NOT_FOUND",
    status: 404
  },
  // 409
  DISCOUNT_ALREADY_USED: {
    code: "DISCOUNT_ALREADY_USED",
    status: 409
  },
  DISCOUNT_ALREADY_EXISTS: {
    code: "DISCOUNT_ALREADY_EXISTS",
    status: 409
  },
  REFERRAL_ALREADY_LOCKED: {
    code: "REFERRAL_ALREADY_LOCKED",
    status: 409
  },
  // 422
  SELF_REFERRAL: {
    code: "SELF_REFERRAL",
    status: 422
  },
  INELIGIBLE_CUSTOMER_ORDERS: {
    code: "INELIGIBLE_CUSTOMER_ORDERS",
    status: 422
  },
  // 500
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    status: 500
  }
};
async function action$a({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  if (request.method !== "POST") {
    return jsonResponse$3({
      success: false,
      message: "Method not allowed.",
      code: ERROR_CODES$1.INVALID_INPUT.code
    }, 405, corsHeaders);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse$3({
      success: false,
      message: "Invalid request body.",
      code: ERROR_CODES$1.INVALID_INPUT.code
    }, 400, corsHeaders);
  }
  const {
    shop,
    customerId,
    referralCode
  } = body;
  try {
    validateInput({
      shop,
      customerId,
      referralCode
    });
    const {
      admin,
      session
    } = await unauthenticated.admin(shop);
    if (!session) {
      throw createError$1("Valid shop session required.", ERROR_CODES$1.INVALID_INPUT);
    }
    const referredOrderCount = await withRetry(() => customerOrderCount(admin, customerId), {
      maxAttempts: 3,
      baseDelayMs: 800,
      retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
      context: {
        shop,
        customerId,
        module: MODULE$6
      }
    });
    logger.info("Checking referral eligibility", {
      shop,
      customerId,
      referralCode,
      referredOrderCount
    });
    if (referredOrderCount > 0) {
      throw createError$1("You are not eligible for the referral reward because you have already placed an order.", ERROR_CODES$1.INELIGIBLE_CUSTOMER_ORDERS);
    }
    const [referrer, referred] = await Promise.all([getReferrer(referralCode), getReferred(customerId)]);
    validateCustomers(referrer, referred);
    if (referrer.id === referred.id) {
      throw createError$1("You cannot use your own referral code.", ERROR_CODES$1.SELF_REFERRAL);
    }
    const existingReferral = await findExistingReferral(referred.id);
    if (existingReferral) {
      return handleExistingReferral({
        existingReferral,
        currentReferrerId: referrer.id,
        referralCode,
        corsHeaders
      });
    }
    const discountCode = await withRetry(() => generateReferralDiscountCode(admin, customerId, referralCode), {
      maxAttempts: 3,
      baseDelayMs: 800,
      retryableErrors: [
        "fetch failed",
        "ECONNRESET",
        "ETIMEDOUT",
        // generateReferralDiscountCode catches network errors and
        // re-throws with this message — include it so withRetry can
        // match and retry accordingly
        "Something went wrong. Please try again later."
      ],
      context: {
        shop,
        customerId,
        referralCode,
        module: MODULE$6
      }
    });
    if (!discountCode) {
      throw createError$1("Failed to generate your discount code. Please try again.", ERROR_CODES$1.INTERNAL_ERROR);
    }
    const newReferral = await createReferral(referrer.id, referred.id, discountCode);
    await createTransaction({
      customerId: referred.id,
      type: "EARN",
      points: 0,
      referralId: newReferral.id,
      status: "PENDING",
      reason: `Referral code ${referralCode} applied — waiting for your first order to confirm the reward`,
      activity: `Referral discount is ready — use it at checkout on your first order`,
      metadata: {
        referralCode,
        discountCode,
        referrerId: referrer.id
      },
      // The referred customer is live in the widget right now,
      // applying the code themselves, and sees this confirmation
      // on screen immediately — never surface it as a toast later.
      notifiedAt: /* @__PURE__ */ new Date()
    }, session);
    await createCustomerReward({
      customerId: referred.id,
      event: "REFERRAL",
      type: "DEFAULT",
      status: "ACTIVE",
      title: "Referral discount voucher",
      description: `Use code ${discountCode} at checkout to get your referral discount on your first order.`,
      code: discountCode
      // referralId: newReferral.id, // TODO: uncomment after Reward.referralId added to schema
    });
    await withRetry(() => syncCustomerConfig(admin, customerId), {
      maxAttempts: 3,
      baseDelayMs: 800,
      retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
      context: {
        shop,
        customerId,
        module: MODULE$6
      }
    }).catch((err) => {
      logger.error("Metafield sync failed after all retries — referral is still valid", {
        module: MODULE$6,
        customerId,
        error: err == null ? void 0 : err.message
      });
      return null;
    });
    logger.success("Referral discount generated", {
      referrerId: referrer.id,
      referredId: referred.id,
      discountCode
    });
    return jsonResponse$3({
      success: true,
      referralCode,
      referralDiscountCode: discountCode,
      message: "Your referral discount code is ready! Use it at checkout."
    }, 200, corsHeaders);
  } catch (err) {
    const errorDef = (err == null ? void 0 : err.errorDef) || ERROR_CODES$1.INTERNAL_ERROR;
    const isClientError = errorDef.status < 500;
    if (isClientError) {
      logger.warn("Referral request rejected", {
        error: err == null ? void 0 : err.message,
        code: errorDef.code,
        shop,
        customerId,
        referralCode,
        module: MODULE$6
      });
    } else {
      logger.error("Referral API error", {
        error: err == null ? void 0 : err.message,
        code: errorDef.code,
        shop,
        customerId,
        referralCode,
        module: MODULE$6
      });
    }
    return jsonResponse$3({
      success: false,
      message: err.message || "Something went wrong. Please try again.",
      code: errorDef.code
    }, errorDef.status, corsHeaders);
  }
}
async function loader$3({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return jsonResponse$3({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, corsHeaders);
}
function jsonResponse$3(data, status, headers2) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers2
    }
  });
}
function createError$1(message, errorDef) {
  const err = new Error(message);
  err.errorDef = errorDef;
  return err;
}
function validateInput({
  shop,
  customerId,
  referralCode
}) {
  if (!shop) throw createError$1("Shop is required.", ERROR_CODES$1.INVALID_INPUT);
  if (!customerId) throw createError$1("Customer ID is required.", ERROR_CODES$1.INVALID_INPUT);
  if (!referralCode) throw createError$1("Referral code is required.", ERROR_CODES$1.INVALID_INPUT);
}
function getReferrer(referralCode) {
  return prisma.customer.findFirst({
    where: {
      referralCode
    },
    select: {
      id: true,
      referralCode: true
    }
  });
}
function getReferred(customerId) {
  return prisma.customer.findFirst({
    where: {
      shopifyId: normalizeCustomerGid(customerId)
    },
    select: {
      id: true
    }
  });
}
function validateCustomers(referrer, referred) {
  if (!referrer) {
    throw createError$1("Invalid referral code. Please check the code and try again.", ERROR_CODES$1.INVALID_REFERRAL_CODE);
  }
  if (!referred) {
    throw createError$1("Customer account not found. Please log in and try again.", ERROR_CODES$1.CUSTOMER_NOT_FOUND);
  }
}
function findExistingReferral(referredId) {
  return prisma.referral.findUnique({
    where: {
      referredId
    },
    select: {
      id: true,
      referrerId: true,
      discountCode: true,
      discountUsed: true
    }
  });
}
function handleExistingReferral({
  existingReferral,
  currentReferrerId,
  referralCode,
  corsHeaders
}) {
  if (existingReferral.discountUsed) {
    return jsonResponse$3({
      success: false,
      code: ERROR_CODES$1.DISCOUNT_ALREADY_USED.code,
      message: "You have already used your referral discount. It can only be used once."
    }, ERROR_CODES$1.DISCOUNT_ALREADY_USED.status, corsHeaders);
  }
  if (existingReferral.referrerId !== currentReferrerId) {
    return jsonResponse$3({
      success: false,
      code: ERROR_CODES$1.REFERRAL_ALREADY_LOCKED.code,
      message: "You already have a referral discount from another person. You cannot switch referral codes."
    }, ERROR_CODES$1.REFERRAL_ALREADY_LOCKED.status, corsHeaders);
  }
  return jsonResponse$3({
    success: true,
    referralCode,
    referralDiscountCode: existingReferral.discountCode,
    message: "Your referral discount code is still valid. Use it at checkout!"
  }, 200, corsHeaders);
}
async function createReferral(referrerId, referredId, discountCode) {
  try {
    return await prisma.referral.create({
      data: {
        status: REFERRAL_STATUS.ACTIVE,
        discountCode,
        discountInfo: "Referral discount code generated",
        referrerId,
        referredId
      },
      select: {
        id: true
      }
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw createError$1("A referral discount has already been generated for your account.", ERROR_CODES$1.DISCOUNT_ALREADY_EXISTS);
    }
    throw err;
  }
}
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
async function isDuplicateEvent({ shop, eventKey }) {
  try {
    await prisma.webhookEvent.create({
      data: { shop: shop ?? "unknown", eventKey }
    });
    return false;
  } catch (err) {
    if ((err == null ? void 0 : err.code) === "P2002") {
      return true;
    }
    logger.error("isDuplicateEvent error", { eventKey, error: err == null ? void 0 : err.message });
    throw err;
  }
}
const MODULE$5 = "api.loox-new-review-trigger";
const REVIEW_TYPE = {
  TEXT: "TEXT",
  PHOTO: "PHOTO",
  VIDEO: "VIDEO"
};
const REWARD_MODE = {
  ONCE: "once",
  PER_TYPE: "per_type",
  UNLIMITED: "unlimited"
};
const validateReview = (email, productId) => {
  if (!email || !productId) {
    logger.warn(MODULE$5, "Missing required fields, skipping", {
      email,
      productId
    });
    return false;
  }
  return true;
};
const detectReviewType = async (photoUrl) => {
  if (!photoUrl) return REVIEW_TYPE.TEXT;
  if (/\.(mp4|mov)$/i.test(photoUrl)) return REVIEW_TYPE.VIDEO;
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(photoUrl)) return REVIEW_TYPE.PHOTO;
  try {
    const res = await fetch(photoUrl, {
      method: "HEAD"
    });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.startsWith("video/")) return REVIEW_TYPE.VIDEO;
    if (contentType.startsWith("image/")) return REVIEW_TYPE.PHOTO;
  } catch {
  }
  return REVIEW_TYPE.PHOTO;
};
const loadCustomerAndRule = async (email) => {
  const [customer2, rule] = await Promise.all([prisma.customer.findFirst({
    where: {
      email
    },
    select: {
      id: true,
      shopifyId: true,
      sessionId: true
    }
  }), getPointRuleByEvent("REVIEW")]);
  return {
    customer: customer2,
    rule
  };
};
const loadSession = (sessionId) => prisma.session.findUnique({
  where: {
    id: sessionId
  },
  select: {
    id: true,
    shop: true
  }
});
const resolveRewardConfig = (conditions, reviewType) => {
  const review = (conditions == null ? void 0 : conditions.review) ?? {};
  const typeKeyMap = {
    [REVIEW_TYPE.VIDEO]: review.video,
    [REVIEW_TYPE.PHOTO]: review.image,
    [REVIEW_TYPE.TEXT]: review.text
  };
  const typeConfig = typeKeyMap[reviewType] ?? {};
  if (typeConfig.isActive === false) return null;
  const points = Number(typeConfig.points) || 0;
  const rewardMode = review.rewardMode ?? REWARD_MODE.PER_TYPE;
  return {
    points,
    rewardMode,
    typeConfig
  };
};
const checkIdempotency = async ({
  email,
  productId,
  reviewType,
  rewardMode,
  shop
}) => {
  let eventKey;
  switch (rewardMode) {
    case REWARD_MODE.ONCE:
      eventKey = `LOOX_REVIEW:${email}:${productId}`;
      break;
    case REWARD_MODE.UNLIMITED:
      eventKey = `LOOX_REVIEW:${email}:${productId}:${reviewType}:${Date.now()}`;
      break;
    case REWARD_MODE.PER_TYPE:
    default:
      eventKey = `LOOX_REVIEW:${email}:${productId}:${reviewType}`;
  }
  const isDuplicate = await isDuplicateEvent({
    shop,
    eventKey
  });
  return {
    isDuplicate,
    eventKey
  };
};
const buildRewardKey = (customerId, productId, reviewType, rewardMode) => {
  switch (rewardMode) {
    case REWARD_MODE.ONCE:
      return `REVIEW:DEFAULT:${customerId}:${productId}`;
    case REWARD_MODE.UNLIMITED:
      return `REVIEW:DEFAULT:${customerId}:${productId}:${reviewType}:${Date.now()}`;
    case REWARD_MODE.PER_TYPE:
    default:
      return `REVIEW:DEFAULT:${customerId}:${productId}:${reviewType}`;
  }
};
const issueReward = async ({
  customerId,
  sessionId,
  eventId,
  reviewType,
  rewardMode,
  points,
  productId,
  productTitle,
  rating,
  author,
  orderId
}) => {
  const label2 = reviewType.charAt(0) + reviewType.slice(1).toLowerCase();
  const reason = `${label2} review submitted for "${productTitle}"`;
  const activity = points > 0 ? `+${points} points for ${label2.toLowerCase()} review on "${productTitle}"` : `${label2} review submitted for "${productTitle}" -- no points for this review type`;
  const sharedMetadata = {
    reviewType,
    rewardMode,
    productId,
    productTitle,
    rating,
    orderId
  };
  const rewardKey = buildRewardKey(customerId, productId, reviewType, rewardMode);
  await Promise.all([createTransaction({
    customerId,
    type: "EARN",
    eventId,
    points,
    status: "COMPLETED",
    reason,
    activity,
    metadata: sharedMetadata
  }, {
    id: sessionId
  }), createCustomerReward({
    customerId,
    event: "REVIEW",
    type: "DEFAULT",
    status: "COMPLETED",
    title: `${label2} review reward`,
    description: points > 0 ? `You earned ${points} points for submitting a ${label2.toLowerCase()} review on "${productTitle}".` : `Thank you for your ${label2.toLowerCase()} review on "${productTitle}".`,
    rewardKey,
    metadata: {
      ...sharedMetadata,
      author
    }
  })]);
};
const jsonResponse$2 = (data, status, headers2) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json",
    ...headers2
  }
});
const action$9 = async ({
  request
}) => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  if (request.method !== "POST") {
    return jsonResponse$2({
      error: "Method not allowed"
    }, 405, corsHeaders);
  }
  let data;
  try {
    data = await request.json();
  } catch (error) {
    logger.error(MODULE$5, "Failed to parse request body", {
      error: error == null ? void 0 : error.message
    });
    return new Response("OK", {
      status: 200,
      headers: corsHeaders
    });
  }
  handleLooxReview(data).catch((err) => logger.error(MODULE$5, "Background review handler failed", {
    error: err == null ? void 0 : err.message,
    stack: err == null ? void 0 : err.stack
  }));
  return new Response("OK", {
    status: 200,
    headers: corsHeaders
  });
};
const loader$2 = async ({
  request
}) => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return jsonResponse$2({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, corsHeaders);
};
const handleLooxReview = async (reviewData) => {
  const {
    email,
    author,
    rating,
    product_title,
    product_id,
    photo_url,
    order_id
  } = reviewData;
  if (!validateReview(email, product_id)) return;
  const reviewType = await detectReviewType(photo_url);
  const {
    customer: customer2,
    rule
  } = await loadCustomerAndRule(email);
  if (!customer2) {
    logger.warn(MODULE$5, "Customer not found, skipping", {
      email
    });
    return;
  }
  if (!rule) {
    logger.warn(MODULE$5, "REVIEW rule not found, skipping");
    return;
  }
  if (!rule.isActive) {
    logger.warn(MODULE$5, "REVIEW rule is inactive, skipping");
    return;
  }
  const dbSession = await loadSession(customer2.sessionId);
  if (!dbSession) {
    logger.warn(MODULE$5, "Session not found, skipping", {
      customerId: customer2.id
    });
    return;
  }
  const rewardConfig = resolveRewardConfig(rule.conditions, reviewType);
  if (!rewardConfig) {
    logger.info(MODULE$5, `${reviewType} review type is disabled, skipping`, {
      email
    });
    return;
  }
  const {
    points,
    rewardMode,
    typeConfig
  } = rewardConfig;
  logger.info(MODULE$5, "Review resolved", {
    reviewType,
    rewardMode,
    points,
    email,
    product_title
  });
  const {
    isDuplicate,
    eventKey
  } = await checkIdempotency({
    email,
    productId: product_id,
    reviewType,
    rewardMode,
    shop: dbSession.shop
  });
  if (isDuplicate) {
    logger.warn(MODULE$5, "Duplicate review event skipped", {
      eventKey,
      rewardMode
    });
    return;
  }
  const {
    admin
  } = await unauthenticated.admin(dbSession.shop);
  await issueReward({
    customerId: customer2.id,
    sessionId: dbSession.id,
    eventId: rule.event.id,
    reviewType,
    rewardMode,
    points,
    productId: product_id,
    productTitle: product_title,
    rating,
    author,
    orderId: order_id || null
  });
  await syncCustomerConfig(admin, customer2.shopifyId);
  logger.success(MODULE$5, "Loox review handled", {
    email,
    customerId: customer2.id,
    reviewType,
    rewardMode,
    points,
    product_title
  });
};
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const MODULE$4 = "api.provision-customer";
const ERROR_CODES = {
  INVALID_INPUT: {
    code: "INVALID_INPUT",
    status: 400
  },
  SHOPIFY_CUSTOMER_NOT_FOUND: {
    code: "SHOPIFY_CUSTOMER_NOT_FOUND",
    status: 404
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    status: 500
  }
};
const FAST_RETRY = {
  maxAttempts: 2,
  baseDelayMs: 400,
  backoffFactor: 2,
  maxDelayMs: 1500,
  jitterFactor: 0.2,
  retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"]
};
async function action$8({
  request
}) {
  var _a2;
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  if (request.method !== "POST") {
    return jsonResponse$1({
      success: false,
      message: "Method not allowed.",
      code: ERROR_CODES.INVALID_INPUT.code
    }, 405, corsHeaders);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse$1({
      success: false,
      message: "Invalid request body.",
      code: ERROR_CODES.INVALID_INPUT.code
    }, 400, corsHeaders);
  }
  const {
    shop,
    customerId
  } = body;
  try {
    if (!shop) throw createError("Shop is required.", ERROR_CODES.INVALID_INPUT);
    if (!customerId) throw createError("Customer ID is required.", ERROR_CODES.INVALID_INPUT);
    const shopifyId = normalizeCustomerGid(customerId);
    const existing = await prisma.customer.findUnique({
      where: {
        shopifyId
      },
      select: {
        id: true
      }
    });
    if (existing) {
      return jsonResponse$1({
        success: true,
        shouldReload: false
      }, 200, corsHeaders);
    }
    const {
      admin,
      session
    } = await unauthenticated.admin(shop);
    if (!session) {
      throw createError("Valid shop session required.", ERROR_CODES.INVALID_INPUT);
    }
    const shopifyCustomer = await withRetry(() => customer(admin, shopifyId), {
      ...FAST_RETRY,
      context: {
        shop,
        customerId: shopifyId,
        module: MODULE$4
      }
    });
    if (!shopifyCustomer) {
      throw createError("Shopify customer not found.", ERROR_CODES.SHOPIFY_CUSTOMER_NOT_FOUND);
    }
    const email = ((_a2 = shopifyCustomer.defaultEmailAddress) == null ? void 0 : _a2.emailAddress) || null;
    const name = `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim();
    const referralCode = await generateReferralCode();
    let created = true;
    let customerRecord;
    try {
      customerRecord = await prisma.customer.create({
        data: {
          shopifyId,
          name: name || null,
          firstName: shopifyCustomer.firstName || null,
          lastName: shopifyCustomer.lastName || null,
          email,
          referralCode,
          sessionId: session.id,
          metadata: shopifyCustomer
        },
        select: {
          id: true
        }
      });
    } catch (err) {
      if (err.code === "P2002") {
        created = false;
        customerRecord = await prisma.customer.findUnique({
          where: {
            shopifyId
          },
          select: {
            id: true
          }
        });
      } else {
        throw err;
      }
    }
    if (!customerRecord) {
      throw createError("Failed to create customer record.", ERROR_CODES.INTERNAL_ERROR);
    }
    await syncCustomerConfig(admin, shopifyId);
    if (created) {
      logger.success("Customer auto-provisioned from storefront", {
        shop,
        shopifyId,
        referralCode,
        module: MODULE$4
      });
    }
    return jsonResponse$1({
      success: true,
      shouldReload: created
    }, 200, corsHeaders);
  } catch (err) {
    const errorDef = (err == null ? void 0 : err.errorDef) || ERROR_CODES.INTERNAL_ERROR;
    const isClientError = errorDef.status < 500;
    if (isClientError) {
      logger.warn("Customer provision rejected", {
        error: err == null ? void 0 : err.message,
        code: errorDef.code,
        shop,
        customerId,
        module: MODULE$4
      });
    } else {
      logger.error("Customer provision error", {
        error: err == null ? void 0 : err.message,
        code: errorDef.code,
        shop,
        customerId,
        module: MODULE$4
      });
    }
    return jsonResponse$1({
      success: false,
      message: err.message || "Something went wrong.",
      code: errorDef.code
    }, errorDef.status, corsHeaders);
  }
}
async function loader$1({
  request
}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return jsonResponse$1({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, corsHeaders);
}
function jsonResponse$1(data, status, headers2) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers2
    }
  });
}
function createError(message, errorDef) {
  const err = new Error(message);
  err.errorDef = errorDef;
  return err;
}
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const MODULE$3 = "widget-ui/route.jsx";
const HTTP = (
  /** @type {const} */
  {
    OK: 200,
    UNAUTHORIZED: 401,
    INTERNAL_SERVER_ERROR: 500
  }
);
async function loader({
  request
}) {
  const {
    session,
    admin
  } = await authenticate.public.appProxy(request);
  if (!session) {
    return jsonResponse({
      error: "Unauthorized"
    }, HTTP.UNAUTHORIZED);
  }
  const url = new URL(request.url);
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");
  if (!loggedInCustomerId) {
    return jsonResponse({
      customer: null
    }, HTTP.OK, {
      "Cache-Control": "public, max-age=30"
    });
  }
  try {
    const customerData = await customer(admin, loggedInCustomerId);
    if (!customerData) {
      logger.warn(MODULE$3, "Customer not found for logged_in_customer_id", {
        shop: session.shop,
        loggedInCustomerId
      });
      return jsonResponse({
        customer: null
      }, HTTP.OK, {
        "Cache-Control": "private, no-store"
      });
    }
    logger.info(MODULE$3, "Widget data served for logged-in customer", {
      shop: session.shop,
      loggedInCustomerId
    });
    return jsonResponse(
      {
        customer: customerData
      },
      HTTP.OK,
      // Personalized response — never let this be cached by CDNs/browsers.
      {
        "Cache-Control": "private, no-store"
      }
    );
  } catch (error) {
    logger.error(MODULE$3, "Failed to load widget data", {
      shop: session.shop,
      loggedInCustomerId,
      error: error == null ? void 0 : error.message
    });
    return jsonResponse({
      customer: null
    }, HTTP.OK, {
      "Cache-Control": "private, no-store"
    });
  }
}
function jsonResponse(data, status, headers2 = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers2
    }
  });
}
const route26 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const action$7 = async ({
  request
}) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }
  const {
    session
  } = await authenticate.public.appProxy(request);
  if (!session) {
    return new Response("Unauthorized", {
      status: 401
    });
  }
  const url = new URL(request.url);
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");
  if (!loggedInCustomerId) {
    return Response.json({
      ok: false,
      marked: 0
    });
  }
  const customer2 = await prisma.customer.findUnique({
    where: {
      shopifyId: normalizeCustomerGid(loggedInCustomerId)
    },
    select: {
      id: true
    }
  });
  if (!customer2) {
    return Response.json({
      ok: false,
      marked: 0
    });
  }
  let ids = null;
  try {
    const body = await request.json();
    if (Array.isArray(body == null ? void 0 : body.ids) && body.ids.length > 0) {
      ids = body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id));
    }
  } catch (err) {
  }
  const where = ids && ids.length ? {
    id: {
      in: ids
    },
    customerId: customer2.id,
    notifiedAt: null
  } : {
    customerId: customer2.id,
    notifiedAt: null
  };
  const {
    count
  } = await prisma.transaction.updateMany({
    where,
    data: {
      notifiedAt: /* @__PURE__ */ new Date()
    }
  });
  return Response.json({
    ok: true,
    marked: count
  });
};
const route27 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
const MODULE$2 = "webhooks.app.orders.paid";
const ENABLE_IDEMPOTENCY$3 = true;
const action$6 = async ({
  request
}) => {
  var _a2;
  try {
    const {
      payload,
      topic,
      shop
    } = await authenticate.webhook(request);
    const order = payload;
    const webhookId = request.headers.get("X-Shopify-Webhook-Id");
    const eventKey = webhookId ? `SHOPIFY:${webhookId}` : `${topic}:${order.admin_graphql_api_id}`;
    if (ENABLE_IDEMPOTENCY$3) {
      const isDuplicate = await isDuplicateEvent({
        shop,
        eventKey
      });
      if (isDuplicate) {
        logger.warn(MODULE$2, "Duplicate webhook — skipping", {
          shop,
          eventKey
        });
        return new Response("OK", {
          status: 200
        });
      }
    }
    await prisma.job.upsert({
      where: {
        idempotencyKey: eventKey
      },
      create: {
        type: "ORDER_PAID",
        shop,
        idempotencyKey: eventKey,
        payload: {
          orderId: order.admin_graphql_api_id,
          customerId: (_a2 = order == null ? void 0 : order.customer) == null ? void 0 : _a2.admin_graphql_api_id,
          webhookId
        }
      },
      update: {}
      // already queued — do nothing
    });
    logger.info(MODULE$2, "ORDER_PAID job enqueued", {
      shop,
      orderId: order.admin_graphql_api_id
    });
    return new Response("OK", {
      status: 200
    });
  } catch (error) {
    logger.error(MODULE$2, "Webhook entry error", {
      error: error == null ? void 0 : error.message
    });
    return new Response("OK", {
      status: 200
    });
  }
};
const route28 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6
}, Symbol.toStringTag, { value: "Module" }));
const MODULE$1 = "webhooks.app.orders.cancelled";
const ENABLE_IDEMPOTENCY$2 = true;
const action$5 = async ({
  request
}) => {
  try {
    const {
      payload,
      topic,
      shop
    } = await authenticate.webhook(request);
    const order = payload;
    const webhookId = request.headers.get("X-Shopify-Webhook-Id");
    const eventKey = webhookId ? `SHOPIFY:${webhookId}` : `${topic}:${order.admin_graphql_api_id}`;
    if (ENABLE_IDEMPOTENCY$2) {
      const isDuplicate = await isDuplicateEvent({
        shop,
        eventKey
      });
      if (isDuplicate) {
        logger.warn(MODULE$1, "Duplicate webhook — skipping", {
          shop,
          eventKey
        });
        return new Response("OK", {
          status: 200
        });
      }
    }
    await prisma.job.upsert({
      where: {
        idempotencyKey: eventKey
      },
      create: {
        type: "ORDER_REVERSED",
        shop,
        idempotencyKey: eventKey,
        payload: {
          orderId: order.admin_graphql_api_id,
          reversalType: "CANCEL",
          webhookId
        }
      },
      update: {}
      // already queued — do nothing
    });
    logger.info(MODULE$1, "ORDER_REVERSED (CANCEL) job enqueued", {
      shop,
      orderId: order.admin_graphql_api_id
    });
    return new Response("OK", {
      status: 200
    });
  } catch (error) {
    logger.error(MODULE$1, "Webhook entry error", {
      error: error == null ? void 0 : error.message
    });
    return new Response("OK", {
      status: 200
    });
  }
};
const route29 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5
}, Symbol.toStringTag, { value: "Module" }));
const MODULE = "webhooks.app.refunds.create";
const ENABLE_IDEMPOTENCY$1 = true;
const getRefundAmount = (refund) => ((refund == null ? void 0 : refund.transactions) ?? []).filter((t) => t.kind === "refund" && t.status === "success").reduce((sum, t) => sum + Number(t.amount || 0), 0);
const action$4 = async ({
  request
}) => {
  try {
    const {
      payload,
      topic,
      shop
    } = await authenticate.webhook(request);
    const refund = payload;
    const orderGid = `gid://shopify/Order/${refund.order_id}`;
    const refundAmount = getRefundAmount(refund);
    const webhookId = request.headers.get("X-Shopify-Webhook-Id");
    const eventKey = webhookId ? `SHOPIFY:${webhookId}` : `${topic}:${refund.admin_graphql_api_id ?? refund.id}`;
    if (ENABLE_IDEMPOTENCY$1) {
      const isDuplicate = await isDuplicateEvent({
        shop,
        eventKey
      });
      if (isDuplicate) {
        logger.warn(MODULE, "Duplicate webhook — skipping", {
          shop,
          eventKey
        });
        return new Response("OK", {
          status: 200
        });
      }
    }
    if (refundAmount <= 0) {
      logger.info(MODULE, "Refund amount is 0 — nothing to reverse, skipping", {
        shop,
        orderId: orderGid,
        refundId: refund.id
      });
      return new Response("OK", {
        status: 200
      });
    }
    await prisma.job.upsert({
      where: {
        idempotencyKey: eventKey
      },
      create: {
        type: "ORDER_REVERSED",
        shop,
        idempotencyKey: eventKey,
        payload: {
          orderId: orderGid,
          reversalType: "REFUND",
          refundId: refund.id,
          refundAmount,
          webhookId
        }
      },
      update: {}
      // already queued — do nothing
    });
    logger.info(MODULE, "ORDER_REVERSED (REFUND) job enqueued", {
      shop,
      orderId: orderGid,
      refundId: refund.id,
      refundAmount
    });
    return new Response("OK", {
      status: 200
    });
  } catch (error) {
    logger.error(MODULE, "Webhook entry error", {
      error: error == null ? void 0 : error.message
    });
    return new Response("OK", {
      status: 200
    });
  }
};
const route30 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({
  request
}) => {
  const {
    admin,
    shop,
    session,
    topic,
    payload
  } = await authenticate.webhook(request);
  logger.info(shop, `Received ${topic} webhook`);
  const eventKey = request.headers.get("x-shopify-webhook-id");
  if (eventKey) {
    const alreadyProcessed = await prisma.webhookEvent.findUnique({
      where: {
        eventKey
      }
    });
    if (alreadyProcessed) {
      logger.warn(shop, "Duplicate webhook, skipping", {
        eventKey
      });
      return new Response();
    }
  }
  if (!(session == null ? void 0 : session.id)) {
    logger.warn(shop, "No session found, skipping");
    await logWebhookEvent({
      eventKey,
      shop,
      topic,
      status: "SKIPPED",
      error: "No session"
    });
    return new Response();
  }
  const customer2 = payload;
  const shopifyId = (customer2 == null ? void 0 : customer2.admin_graphql_api_id) || String(customer2 == null ? void 0 : customer2.id);
  const email = customer2 == null ? void 0 : customer2.email;
  if (!email) {
    logger.warn(shop, "No email in payload, skipping", {
      shopifyId
    });
    await logWebhookEvent({
      eventKey,
      shop,
      topic,
      status: "SKIPPED",
      error: "No email in payload"
    });
    return new Response();
  }
  if (!shopifyId) {
    logger.warn(shop, "No shopifyId in payload, skipping");
    await logWebhookEvent({
      eventKey,
      shop,
      topic,
      status: "SKIPPED",
      error: "No shopifyId in payload"
    });
    return new Response();
  }
  try {
    const name = `${customer2.first_name || ""} ${customer2.last_name || ""}`.trim();
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        shopifyId
      },
      select: {
        id: true
      }
    });
    if (existingCustomer) {
      await prisma.customer.update({
        where: {
          shopifyId
        },
        data: {
          email,
          name: name || null,
          firstName: customer2.first_name || null,
          lastName: customer2.last_name || null,
          metadata: customer2
        }
      });
      logger.info(shop, "Customer updated", {
        email,
        shopifyId
      });
    } else {
      const referralCode = await generateReferralCode();
      await prisma.customer.create({
        data: {
          shopifyId,
          name: name || null,
          firstName: customer2.first_name || null,
          lastName: customer2.last_name || null,
          email,
          referralCode,
          sessionId: session.id,
          metadata: customer2
        }
      });
      logger.success(shop, "Customer created", {
        email,
        shopifyId,
        referralCode
      });
    }
    await syncCustomerConfig(admin, shopifyId).catch((err) => {
      logger.error(shop, "syncCustomerConfig failed", err, {
        shopifyId
      });
    });
    await logWebhookEvent({
      eventKey,
      shop,
      topic,
      status: "PROCESSED"
    });
  } catch (error) {
    logger.error(shop, "Customer webhook error", error, {
      shopifyId,
      email
    });
    await logWebhookEvent({
      eventKey,
      shop,
      topic,
      status: "FAILED",
      error: (error == null ? void 0 : error.message) || String(error)
    });
  }
  return new Response();
};
async function logWebhookEvent({
  eventKey,
  shop,
  topic,
  status,
  error = null
}) {
  if (!eventKey) return;
  try {
    await prisma.webhookEvent.upsert({
      where: {
        eventKey
      },
      update: {
        status,
        error
      },
      create: {
        shop,
        eventKey,
        topic,
        status,
        error
      }
    });
  } catch (err) {
    logger.error(shop, "Failed to log WebhookEvent", err);
  }
}
const route31 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const ENABLE_IDEMPOTENCY = true;
const action$2 = async ({
  request
}) => {
  var _a2;
  let topic;
  let shop;
  let payload;
  let webhookId = null;
  try {
    const auth = await authenticate.webhook(request);
    ({
      topic,
      shop,
      payload
    } = auth);
    webhookId = request.headers.get("X-Shopify-Webhook-Id");
    logger.info(`Received ${topic} webhook`, {
      shop,
      webhookId,
      customerGid: payload == null ? void 0 : payload.admin_graphql_api_id
    });
    if (!(payload == null ? void 0 : payload.admin_graphql_api_id)) {
      logger.warn("Missing admin_graphql_api_id in customer delete webhook", {
        shop
      });
      return new Response("Missing required data", {
        status: 400
      });
    }
    const shopifyGid = payload.admin_graphql_api_id;
    if (ENABLE_IDEMPOTENCY) {
      const eventKey = webhookId ? `SHOPIFY:${webhookId}` : `${topic}:${shopifyGid}`;
      const isDuplicate = await isDuplicateEvent({
        shop,
        eventKey
      });
      if (isDuplicate) {
        logger.warn("Duplicate webhook skipped", {
          shop,
          eventKey,
          topic
        });
        return new Response("OK", {
          status: 200
        });
      }
    }
    await prisma.customer.delete({
      where: {
        shopifyId: shopifyGid
      }
    });
    logger.success("Customer permanently deleted (Hard Delete)", {
      shop,
      customerGid: shopifyGid,
      topic
    });
    return new Response("OK", {
      status: 200
    });
  } catch (error) {
    if ((error == null ? void 0 : error.code) === "P2025") {
      logger.warn("Customer not found in database (already deleted)", {
        shop,
        customerGid: payload == null ? void 0 : payload.admin_graphql_api_id
      });
      return new Response("OK", {
        status: 200
      });
    }
    if ((error == null ? void 0 : error.code) === "P2003" || ((_a2 = error == null ? void 0 : error.message) == null ? void 0 : _a2.includes("Foreign key constraint"))) {
      logger.error("Foreign key constraint error during customer delete", {
        shop,
        customerGid: payload == null ? void 0 : payload.admin_graphql_api_id,
        error: error.message
      });
      return new Response("OK", {
        status: 200
      });
    }
    logger.error("Customer delete webhook failed", {
      error: (error == null ? void 0 : error.message) || String(error),
      shop,
      topic,
      webhookId,
      customerGid: payload == null ? void 0 : payload.admin_graphql_api_id
    });
    return new Response("Internal Server Error", {
      status: 200
    });
  }
};
const route32 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: "Module" }));
const action$1 = async ({
  request
}) => {
  const {
    shop,
    session,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.updateMany({
      where: {
        shop
      },
      data: {
        accessToken: ""
      }
    });
  }
  return new Response();
};
const route33 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1
}, Symbol.toStringTag, { value: "Module" }));
const action = async ({
  request
}) => {
  const {
    payload,
    session,
    topic,
    shop
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route34 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-Bf6CIbrc.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/index-D71CjKr8.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-CenwNr5g.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/index-D71CjKr8.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-D2TfIsnQ.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/AppProxyProvider-Dg2rUN0h.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-Ca9fSjJt.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js"], "css": ["/assets/route-Cn4e-5ys.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/app-GwOf84Gl.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/AppNav-ChvwWWVh.js", "/assets/AppProxyProvider-Dg2rUN0h.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app._index-D9fFNfGs.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/index": { "id": "layout/index", "parentId": "root", "path": void 0, "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/index-BEiUN_ES.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/AppNav-ChvwWWVh.js", "/assets/AppProxyProvider-Dg2rUN0h.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/dashboard/route": { "id": "layout/dashboard/route", "parentId": "layout/index", "path": "app/dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-DzPN4ZY3.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/customers/index/route": { "id": "layout/customers/index/route", "parentId": "layout/index", "path": "app/customers", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-_RZGhbNG.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/Pagination-Cwp4IEHD.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/customers/$id/route": { "id": "layout/customers/$id/route", "parentId": "layout/index", "path": "app/customers/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-VtNZy3n2.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/Pagination-Cwp4IEHD.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/customize/route": { "id": "layout/customize/route", "parentId": "layout/index", "path": "app/customize", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-Crk5G1lW.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/SaveBar-C2zMrY8r.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/index-D71CjKr8.js"], "css": ["/assets/SaveBar-CSoQfLf-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/points-rules/index/route": { "id": "layout/points-rules/index/route", "parentId": "layout/index", "path": "app/points-rules", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-CyYO8rOi.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/points-rules/order/route": { "id": "layout/points-rules/order/route", "parentId": "layout/index", "path": "app/points-rules/order", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-DXTTKWrQ.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/ActiveToggle-C4y6W8P8.js", "/assets/ruleConstants-h07_KEqp.js", "/assets/SaveBar-C2zMrY8r.js", "/assets/useFormState-BOp1iSuw.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/index-D71CjKr8.js"], "css": ["/assets/SaveBar-CSoQfLf-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/points-rules/referral/route": { "id": "layout/points-rules/referral/route", "parentId": "layout/index", "path": "app/points-rules/referral", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-BP6GrHZy.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/ActiveToggle-C4y6W8P8.js", "/assets/SaveBar-C2zMrY8r.js", "/assets/useFormState-BOp1iSuw.js", "/assets/ruleConstants-h07_KEqp.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/index-D71CjKr8.js"], "css": ["/assets/SaveBar-CSoQfLf-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/points-rules/review/route": { "id": "layout/points-rules/review/route", "parentId": "layout/index", "path": "app/points-rules/review", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-BFd0SD7P.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/ActiveToggle-C4y6W8P8.js", "/assets/SaveBar-C2zMrY8r.js", "/assets/useFormState-BOp1iSuw.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/index-D71CjKr8.js"], "css": ["/assets/SaveBar-CSoQfLf-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/rewards-rules/route": { "id": "layout/rewards-rules/route", "parentId": "layout/index", "path": "app/rewards-rules", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-DCNe8k_Q.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useFormState-BOp1iSuw.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/physical-prizes-rules/route": { "id": "layout/physical-prizes-rules/route", "parentId": "layout/index", "path": "app/physical-prizes-rules", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-CYHNcFK-.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useFormState-BOp1iSuw.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/SaveBar-C2zMrY8r.js", "/assets/index-D71CjKr8.js"], "css": ["/assets/SaveBar-CSoQfLf-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/physical-prizes-claims-manage/route": { "id": "layout/physical-prizes-claims-manage/route", "parentId": "layout/index", "path": "app/physical-prizes-claims-manage", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-BB_V0WFH.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useAppBridge-Bj34gXAL.js", "/assets/Pagination-Cwp4IEHD.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/points-events/route": { "id": "layout/points-events/route", "parentId": "layout/index", "path": "app/points-events", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-CqDgQuV6.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "layout/jobs/route": { "id": "layout/jobs/route", "parentId": "layout/index", "path": "app/jobs", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-D6M3Quma.js", "imports": ["/assets/chunk-UVKPFVEO-Bm2Giuur.js", "/assets/Pagination-Cwp4IEHD.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/physical-prize-claim": { "id": "api-routes/physical-prize-claim", "parentId": "root", "path": "api/claim-prize", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/physical-prize-claim-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/reward-claim": { "id": "api-routes/reward-claim", "parentId": "root", "path": "api/get-reward-voucher", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/reward-claim-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/join-our-program": { "id": "api-routes/join-our-program", "parentId": "root", "path": "api/join-our-program", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/join-our-program-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/referral-claim": { "id": "api-routes/referral-claim", "parentId": "root", "path": "api/get-referral-discount", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/referral-claim-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/loox-new-review-trigger": { "id": "api-routes/loox-new-review-trigger", "parentId": "root", "path": "api/loox-new-review-trigger", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/loox-new-review-trigger-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "api-routes/provision-customer": { "id": "api-routes/provision-customer", "parentId": "root", "path": "api/provision-customer", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/provision-customer-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "widget-ui/route": { "id": "widget-ui/route", "parentId": "root", "path": "widget-data", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/route-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "widget-ui/notifications-mark-seen": { "id": "widget-ui/notifications-mark-seen", "parentId": "root", "path": "widget-data/notifications/mark-seen", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/notifications-mark-seen-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/order-paid": { "id": "webhook-routes/order-paid", "parentId": "root", "path": "webhooks/app/orders_paid", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/order-paid-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/order-cancelled": { "id": "webhook-routes/order-cancelled", "parentId": "root", "path": "webhooks/app/orders_cancelled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/order-cancelled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/refund-created": { "id": "webhook-routes/refund-created", "parentId": "root", "path": "webhooks/app/refunds_create", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/refund-created-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/customer-create": { "id": "webhook-routes/customer-create", "parentId": "root", "path": "webhooks/app/customers_create", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/customer-create-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/customer-delete": { "id": "webhook-routes/customer-delete", "parentId": "root", "path": "webhooks/app/customers_delete", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/customer-delete-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/app-uninstalled": { "id": "webhook-routes/app-uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/app-uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "webhook-routes/scopes-update": { "id": "webhook-routes/scopes-update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/scopes-update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-799bfa55.js", "version": "799bfa55", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_passThroughRequests": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route2
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "layout/index": {
    id: "layout/index",
    parentId: "root",
    path: void 0,
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "layout/dashboard/route": {
    id: "layout/dashboard/route",
    parentId: "layout/index",
    path: "app/dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "layout/customers/index/route": {
    id: "layout/customers/index/route",
    parentId: "layout/index",
    path: "app/customers",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "layout/customers/$id/route": {
    id: "layout/customers/$id/route",
    parentId: "layout/index",
    path: "app/customers/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "layout/customize/route": {
    id: "layout/customize/route",
    parentId: "layout/index",
    path: "app/customize",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "layout/points-rules/index/route": {
    id: "layout/points-rules/index/route",
    parentId: "layout/index",
    path: "app/points-rules",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "layout/points-rules/order/route": {
    id: "layout/points-rules/order/route",
    parentId: "layout/index",
    path: "app/points-rules/order",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "layout/points-rules/referral/route": {
    id: "layout/points-rules/referral/route",
    parentId: "layout/index",
    path: "app/points-rules/referral",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "layout/points-rules/review/route": {
    id: "layout/points-rules/review/route",
    parentId: "layout/index",
    path: "app/points-rules/review",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "layout/rewards-rules/route": {
    id: "layout/rewards-rules/route",
    parentId: "layout/index",
    path: "app/rewards-rules",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "layout/physical-prizes-rules/route": {
    id: "layout/physical-prizes-rules/route",
    parentId: "layout/index",
    path: "app/physical-prizes-rules",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "layout/physical-prizes-claims-manage/route": {
    id: "layout/physical-prizes-claims-manage/route",
    parentId: "layout/index",
    path: "app/physical-prizes-claims-manage",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "layout/points-events/route": {
    id: "layout/points-events/route",
    parentId: "layout/index",
    path: "app/points-events",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "layout/jobs/route": {
    id: "layout/jobs/route",
    parentId: "layout/index",
    path: "app/jobs",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "api-routes/physical-prize-claim": {
    id: "api-routes/physical-prize-claim",
    parentId: "root",
    path: "api/claim-prize",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "api-routes/reward-claim": {
    id: "api-routes/reward-claim",
    parentId: "root",
    path: "api/get-reward-voucher",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "api-routes/join-our-program": {
    id: "api-routes/join-our-program",
    parentId: "root",
    path: "api/join-our-program",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "api-routes/referral-claim": {
    id: "api-routes/referral-claim",
    parentId: "root",
    path: "api/get-referral-discount",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "api-routes/loox-new-review-trigger": {
    id: "api-routes/loox-new-review-trigger",
    parentId: "root",
    path: "api/loox-new-review-trigger",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "api-routes/provision-customer": {
    id: "api-routes/provision-customer",
    parentId: "root",
    path: "api/provision-customer",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  },
  "widget-ui/route": {
    id: "widget-ui/route",
    parentId: "root",
    path: "widget-data",
    index: void 0,
    caseSensitive: void 0,
    module: route26
  },
  "widget-ui/notifications-mark-seen": {
    id: "widget-ui/notifications-mark-seen",
    parentId: "root",
    path: "widget-data/notifications/mark-seen",
    index: void 0,
    caseSensitive: void 0,
    module: route27
  },
  "webhook-routes/order-paid": {
    id: "webhook-routes/order-paid",
    parentId: "root",
    path: "webhooks/app/orders_paid",
    index: void 0,
    caseSensitive: void 0,
    module: route28
  },
  "webhook-routes/order-cancelled": {
    id: "webhook-routes/order-cancelled",
    parentId: "root",
    path: "webhooks/app/orders_cancelled",
    index: void 0,
    caseSensitive: void 0,
    module: route29
  },
  "webhook-routes/refund-created": {
    id: "webhook-routes/refund-created",
    parentId: "root",
    path: "webhooks/app/refunds_create",
    index: void 0,
    caseSensitive: void 0,
    module: route30
  },
  "webhook-routes/customer-create": {
    id: "webhook-routes/customer-create",
    parentId: "root",
    path: "webhooks/app/customers_create",
    index: void 0,
    caseSensitive: void 0,
    module: route31
  },
  "webhook-routes/customer-delete": {
    id: "webhook-routes/customer-delete",
    parentId: "root",
    path: "webhooks/app/customers_delete",
    index: void 0,
    caseSensitive: void 0,
    module: route32
  },
  "webhook-routes/app-uninstalled": {
    id: "webhook-routes/app-uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route33
  },
  "webhook-routes/scopes-update": {
    id: "webhook-routes/scopes-update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route34
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
