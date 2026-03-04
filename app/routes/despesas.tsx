import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/despesas";
import {
	getDespesas,
	createDespesa,
	updateDespesa,
	deleteDespesa,
} from "~/models/despesas.server";
import { uploadReciboAndGetUrl } from "~/models/pocketbase.server";
import { DataTable } from "~/components/desp-table";
import { getColumns } from "~/components/columns-desp";
import { DialogNovaDespesa } from "~/components/despesas/dialog-nova-despesa";
import { DialogEditarDespesa } from "~/components/despesas/dialog-editar-despesa";
import type { Despesa } from "~/components/columns-desp";

export async function loader() {
	const despesas = await getDespesas();
	return { despesas };
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const intent = formData.get("intent");

		if (intent === "excluir") {
			const id = formData.get("id");
			if (typeof id === "string" && id) {
				try {
					await deleteDespesa(id);
					return { success: true };
				} catch {
					return { error: "Erro ao excluir despesa" };
				}
			}
			return { error: "ID inválido" };
		}

		if (intent === "editar") {
			const id = formData.get("id");
			const conta = formData.get("conta");
			const descricao = formData.get("descricao");
			const valorStr = formData.get("valor");
			const dataStr = formData.get("data");
			const tipo = formData.get("tipo");

			if (
				typeof id !== "string" ||
				!id ||
				typeof conta !== "string" ||
				!conta.trim() ||
				typeof descricao !== "string" ||
				!descricao.trim() ||
				typeof valorStr !== "string" ||
				!valorStr ||
				typeof dataStr !== "string" ||
				!dataStr ||
				typeof tipo !== "string" ||
				!tipo.trim()
			) {
				return { error: "Preencha todos os campos" };
			}

			const valor = parseFloat(valorStr.replace(",", "."));
			if (isNaN(valor) || valor < 0) {
				return { error: "Valor inválido" };
			}

			const data = new Date(dataStr);
			if (isNaN(data.getTime())) {
				return { error: "Data inválida" };
			}

			let reciboPath: string | undefined;
			const file = formData.get("comprovante");
			if (file instanceof File && file.size > 0) {
				try {
					const buffer = Buffer.from(await file.arrayBuffer());
					const dataPrefix = dataStr.slice(0, 10);
					const nomeComData = `${dataPrefix}-${file.name}`;
					reciboPath = await uploadReciboAndGetUrl(buffer, nomeComData);
				} catch (err) {
					const msg =
						err instanceof Error
							? err.message
							: "Falha ao fazer upload do comprovante";
					return { error: msg };
				}
			}

			try {
				await updateDespesa(id, {
					conta: conta.trim(),
					descricao: descricao.trim(),
					valor,
					data,
					tipo: tipo.trim(),
					...(reciboPath !== undefined && { recibo_path: reciboPath }),
				});
				return { success: true };
			} catch {
				return { error: "Erro ao atualizar despesa" };
			}
		}

		if (intent === "criar") {
		const conta = formData.get("conta");
		const descricao = formData.get("descricao");
		const valorStr = formData.get("valor");
		const dataStr = formData.get("data");
		const tipo = formData.get("tipo");

		if (
			typeof conta !== "string" ||
			!conta.trim() ||
			typeof descricao !== "string" ||
			!descricao.trim() ||
			typeof valorStr !== "string" ||
			!valorStr ||
			typeof dataStr !== "string" ||
			!dataStr ||
			typeof tipo !== "string" ||
			!tipo.trim()
		) {
			return { error: "Preencha todos os campos" };
		}

		const valor = parseFloat(valorStr.replace(",", "."));
		if (isNaN(valor) || valor < 0) {
			return { error: "Valor inválido" };
		}

		const data = new Date(dataStr);
		if (isNaN(data.getTime())) {
			return { error: "Data inválida" };
		}

		let reciboPath: string | null = null;
		const file = formData.get("comprovante");
		if (file instanceof File && file.size > 0) {
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const dataPrefix = dataStr.slice(0, 10);
				const nomeComData = `${dataPrefix}-${file.name}`;
				reciboPath = await uploadReciboAndGetUrl(buffer, nomeComData);
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Falha ao fazer upload do comprovante";
				return { error: msg };
			}
		}

		try {
			await createDespesa({
				conta: conta.trim(),
				descricao: descricao.trim(),
				valor,
				data,
				tipo: tipo.trim(),
				pago: false,
				recibo_path: reciboPath,
			});
			return { success: true };
		} catch {
			return { error: "Erro ao cadastrar despesa" };
		}
	}

	return null;
}

function formatarMoeda(valor: number | null | undefined): string {
	if (valor == null) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(valor);
}

export default function Despesas() {
	const { despesas } = useLoaderData<typeof loader>();
	const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

	const totalDespesas = useMemo(() => {
		const hoje = new Date();
		const mesAtual = hoje.getMonth();
		const anoAtual = hoje.getFullYear();
		return despesas.reduce((acc, d) => {
			if (!d.data) return acc;
			const data = new Date(d.data);
			if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
				return acc + (d.valor ?? 0);
			}
			return acc;
		}, 0);
	}, [despesas]);

	return (
		<div className="container mx-auto space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-bold text-orange-500">Despesas</h1>
					<DialogNovaDespesa />
				</div>
				<div className="rounded-lg border bg-stone-50 px-4 py-2">
					<p className="text-xs font-medium text-stone-500">
						Total do mês
					</p>
					<p className="text-lg font-semibold text-orange-600">
						{formatarMoeda(totalDespesas)}
					</p>
				</div>
			</div>
			<DataTable
				columns={getColumns({
					variant: "despesas",
					onEdit: setEditingDespesa,
				})}
				data={despesas}
				getRowId={(row) => row.id}
				onRowClick={setEditingDespesa}
				filterColumn="conta"
				filterPlaceholder="Filtrar por conta..."
			/>
			{editingDespesa && (
				<DialogEditarDespesa
					despesa={editingDespesa}
					open={!!editingDespesa}
					onClose={() => setEditingDespesa(null)}
				/>
			)}
		</div>
	);
}
