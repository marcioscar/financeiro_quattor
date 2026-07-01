import type { Route } from "./+types/not-found";

export async function loader() {
	return new Response("Not Found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
	return new Response("Not Found", { status: 404 });
}

export default function NotFoundRoute() {
	return null;
}
