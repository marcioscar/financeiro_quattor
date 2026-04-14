import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { Checkbox } from "~/components/ui/checkbox";
import type { Route } from "./+types/cancelamentos";
import { getCancelamentos, updateCancelamento } from "~/models/cancelamentos.server";
import { uploadReciboAndGetUrl } from "~/models/pocketbase.server";
import { jsonFieldUploadError, jsonFormError } from "~/lib/upload-errors";
import { DataTable } from "~/components/desp-table";
import { getColumns } from "~/components/cancelamentos/columns-cancel";
import { DialogEditarCancelamento } from "~/components/cancelamentos/dialog-editar-cancelamento";
import type { Cancelamento } from "~/components/cancelamentos/columns-cancel";

export async function loader() {
	const cancelamentos = await getCancelamentos();
	return { cancelamentos };
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "editar") {
		const id = formData.get("id");
		const canceladoStr = formData.get("cancelado");

		if (typeof id !== "string" || !id) {
			return { error: "ID inválido" };
		}

		const cancelado = canceladoStr === "true";

		let recibo: string | undefined;
		const file = formData.get("comprovante");
		if (file instanceof File && file.size > 0) {
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const dataPrefix = new Date().toISOString().slice(0, 10);
				const nomeComData = `cancelamento-${dataPrefix}-${file.name}`;
				recibo = await uploadReciboAndGetUrl(buffer, nomeComData);
			} catch (err) {
				return jsonFieldUploadError("comprovante", err);
			}
		}

		try {
			await updateCancelamento(id, {
				cancelado,
				...(recibo !== undefined && { recibo }),
			});
			return { success: true };
		} catch {
			return jsonFormError(
				"Não foi possível atualizar o cancelamento. Tente novamente.",
			);
		}
	}

	return null;
}

export default function Cancelamentos() {
	const { cancelamentos } = useLoaderData<typeof loader>();
	const [editingCancelamento, setEditingCancelamento] =
		useState<Cancelamento | null>(null);
	const [showPendentes, setShowPendentes] = useState(true);
	const [showCancelados, setShowCancelados] = useState(true);

	const cancelamentosFiltrados = useMemo(() => {
		return cancelamentos.filter((c) => {
			const cancelado = c.cancelado ?? false;
			if (showPendentes && showCancelados) return true;
			if (showPendentes && !showCancelados) return !cancelado;
			if (!showPendentes && showCancelados) return cancelado;
			return false;
		});
	}, [cancelamentos, showPendentes, showCancelados]);

	return (
		<div className="container mx-auto space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold text-orange-500">
					Cancelamentos
				</h1>
			</div>
			<DataTable
				columns={getColumns({
					onEdit: setEditingCancelamento,
				})}
				data={cancelamentosFiltrados}
				getRowId={(row) => row.id}
				onRowClick={setEditingCancelamento}
				filterColumn="aluno"
				filterPlaceholder="Filtrar por aluno..."
				filterExtra={
					<div className="flex items-center gap-4">
						<label className="flex cursor-pointer items-center gap-2 text-sm">
							<Checkbox
								checked={showPendentes}
								onCheckedChange={(v) => setShowPendentes(!!v)}
							/>
							Pendentes
						</label>
						<label className="flex cursor-pointer items-center gap-2 text-sm">
							<Checkbox
								checked={showCancelados}
								onCheckedChange={(v) => setShowCancelados(!!v)}
							/>
							Cancelados
						</label>
					</div>
				}
			/>
			{editingCancelamento && (
				<DialogEditarCancelamento
					cancelamento={editingCancelamento}
					open={!!editingCancelamento}
					onClose={() => setEditingCancelamento(null)}
				/>
			)}
		</div>
	);
}
