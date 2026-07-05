/**
 * Shown when the loader's try/catch caught an error and returned a safe
 * empty state instead of crashing the page.
 */
export function LoaderErrorBanner({ loaderError }) {
    if (!loaderError) return null;
    return (
        <s-section>
            <s-banner tone="critical" heading="Something went wrong">
                {loaderError}
            </s-banner>
        </s-section>
    );
}
