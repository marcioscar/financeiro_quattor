import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/contas";
import {
	getContasAPagar,
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
	const contas = await getContasAPagar();
	return { contas };
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
				return { error: "Erro ao excluir conta" };
			}
		}
		return { error: "ID inválido" };
	}

	if (intent === "editar_conta_pagar") {
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

		let boletoPath: string | undefined;
		const file = formData.get("boleto");
		if (file instanceof File && file.size > 0) {
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const dataPrefix = dataStr.slice(0, 10);
				const nomeComData = `${dataPrefix}-${file.name}`;
				boletoPath = await uploadReciboAndGetUrl(buffer, nomeComData);
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: "Falha ao fazer upload do boleto";
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
				...(boletoPath !== undefined && { boleto_path: boletoPath }),
			});
			return { success: true };
		} catch {
			return { error: "Erro ao atualizar conta" };
		}
	}

	if (intent === "criar_conta_pagar") {
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

		let boletoPath: string | null = null;
		const file = formData.get("boleto");
		if (file instanceof File && file.size > 0) {
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const dataPrefix = dataStr.slice(0, 10);
				const nomeComData = `${dataPrefix}-${file.name}`;
				boletoPath = await uploadReciboAndGetUrl(buffer, nomeComData);
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: "Falha ao fazer upload do boleto";
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
				boleto_path: boletoPath,
			});
			return { success: true };
		} catch {
			return { error: "Erro ao cadastrar conta" };
		}
	}

	return null;
}

export default function Contas() {
	const { contas } = useLoaderData<typeof loader>();
	const [editingConta, setEditingConta] = useState<Despesa | null>(null);

	return (
		<div className="container mx-auto space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-green-600">
					Contas a pagar
				</h1>
				<DialogNovaDespesa variant="contas_a_pagar" />
			</div>
			<DataTable
				columns={getColumns({
					variant: "contas_a_pagar",
					onEdit: setEditingConta,
				})}
				data={contas}
				getRowId={(row) => row.id}
				onRowClick={setEditingConta}
				filterColumn="conta"
				filterPlaceholder="Filtrar por conta..."
			/>
			{editingConta && (
				<DialogEditarDespesa
					despesa={editingConta}
					open={!!editingConta}
					onClose={() => setEditingConta(null)}
					variant="contas_a_pagar"
				/>
			)}
		</div>
	);
}
