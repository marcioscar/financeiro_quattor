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
	let dataConclusao: Date | null | undefined;

	if (typeof data.cancelado === "boolean") {
		const atual = await db.cancelamentos.findUnique({
			where: { id },
			select: { cancelado: true, data_conclusao: true },
		});

		if (data.cancelado) {
			const jaConcluido = atual?.cancelado === true;
			dataConclusao =
				jaConcluido && atual?.data_conclusao
					? new Date(atual.data_conclusao)
					: new Date();
		} else {
			dataConclusao = null;
		}
	}

	return db.cancelamentos.update({
		where: { id },
		data: {
			...data,
			...(dataConclusao !== undefined && { data_conclusao: dataConclusao }),
		},
	});
}
