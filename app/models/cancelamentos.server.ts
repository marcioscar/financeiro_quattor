import { db } from "~/db.server";

export async function getCancelamentos() {
	return db.cancelamentos.findMany({
		orderBy: { data_limite: "asc" },
	});
}

export async function updateCancelamento(
	id: string,
	data: {
		cancelado?: boolean;
		recibo?: string | null;
	},
) {
	return db.cancelamentos.update({
		where: { id },
		data,
	});
}
