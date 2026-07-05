import { redirect } from "react-router";
import { authenticate } from "shopify-server";


export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);

  throw redirect(`/app/dashboard?${url.searchParams.toString()}`);

  return null;
};

export default function Dashboard() {
  return <s-page heading="Dashboard">
    <s-section>
      Under development
    </s-section>
  </s-page>
}