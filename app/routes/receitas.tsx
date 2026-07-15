import { useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { AlertCircle, Upload } from "lucide-react";
import type { Route } from "./+types/receitas";
import {
	getReceitas,
	createReceita,
	updateReceita,
	deleteReceita,
} from "~/models/receitas.server";
import { importarExtratoReceitas } from "~/models/receitas-extrato.server";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/desp-table";
import { getColumnsRec } from "~/components/receitas/columns-rec";
import { DialogNovaReceita } from "~/components/receitas/dialog-nova-receita";
import { DialogEditarReceita } from "~/components/receitas/dialog-editar-receita";
import type { Receita } from "~/components/receitas/columns-rec";

export async function loader() {
	const receitas = await getReceitas();
	return { receitas };
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "importar_extrato") {
		const file = formData.get("arquivo");
		if (!(file instanceof File) || file.size === 0) {
			return { error: "Selecione o arquivo de extrato bancário (.txt)." };
		}

		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			const resultado = await importarExtratoReceitas(buffer);
			return { success: true, ...resultado };
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Erro ao importar o extrato.";
			return { error: msg };
		}
	}

	if (intent === "excluir_receita") {
		const id = formData.get("id");
		if (typeof id === "string" && id) {
			try {
				await deleteReceita(id);
				return { success: true };
			} catch {
				return { error: "Erro ao excluir receita" };
			}
		}
		return { error: "ID inválido" };
	}

	if (intent === "editar_receita") {
		const id = formData.get("id");
		const forma = formData.get("forma");
		const descricao = formData.get("descricao");
		const valorStr = formData.get("valor");
		const dataStr = formData.get("data");
		const status = formData.get("status");

		if (
			typeof id !== "string" ||
			!id ||
			typeof forma !== "string" ||
			!forma.trim() ||
			typeof descricao !== "string" ||
			!descricao.trim() ||
			typeof valorStr !== "string" ||
			!valorStr ||
			typeof dataStr !== "string" ||
			!dataStr ||
			typeof status !== "string" ||
			!status.trim()
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

		try {
			await updateReceita(id, {
				forma: forma.trim(),
				descricao: descricao.trim(),
				valor,
				data,
				status: status.trim(),
			});
			return { success: true };
		} catch {
			return { error: "Erro ao atualizar receita" };
		}
	}

	if (intent === "criar_receita") {
		const forma = formData.get("forma");
		const descricao = formData.get("descricao");
		const valorStr = formData.get("valor");
		const dataStr = formData.get("data");
		const status = formData.get("status");

		if (
			typeof forma !== "string" ||
			!forma.trim() ||
			typeof descricao !== "string" ||
			!descricao.trim() ||
			typeof valorStr !== "string" ||
			!valorStr ||
			typeof dataStr !== "string" ||
			!dataStr ||
			typeof status !== "string" ||
			!status.trim()
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

		try {
			await createReceita({
				forma: forma.trim(),
				descricao: descricao.trim(),
				valor,
				data,
				status: status.trim(),
			});
			return { success: true };
		} catch {
			return { error: "Erro ao cadastrar receita" };
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

export default function Receitas() {
	const { receitas } = useLoaderData<typeof loader>();
	const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
	const fetcherExtrato = useFetcher<{
		success?: boolean;
		error?: string;
		inseridas?: number;
		ignoradas?: number;
	}>();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const totalReceitas = useMemo(() => {
		const hoje = new Date();
		const mesAtual = hoje.getMonth();
		const anoAtual = hoje.getFullYear();
		return receitas.reduce((acc: number, r: Receita) => {
			if (!r.data) return acc;
			const data = new Date(r.data);
			if (data.getUTCMonth() === mesAtual && data.getUTCFullYear() === anoAtual) {
				return acc + (r.valor ?? 0);
			}
			return acc;
		}, 0);
	}, [receitas]);

	return (
		<div className="container mx-auto space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-bold text-orange-500">Receitas</h1>
					<DialogNovaReceita />
					<fetcherExtrato.Form method="post" encType="multipart/form-data">
						<input type="hidden" name="intent" value="importar_extrato" />
						<input
							ref={fileInputRef}
							type="file"
							name="arquivo"
							accept=".txt,.csv"
							className="hidden"
							onChange={(e) => {
								const form = e.target.form;
								if (form && e.target.files?.[0]) {
									fetcherExtrato.submit(form, {
										method: "post",
										encType: "multipart/form-data",
									});
								}
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={fetcherExtrato.state !== "idle"}>
							<Upload className="mr-2 size-4" />
							{fetcherExtrato.state !== "idle"
								? "Importando..."
								: "Importar extrato bancário"}
						</Button>
					</fetcherExtrato.Form>
				</div>
				<div className="rounded-lg border bg-stone-50 px-4 py-2">
					<p className="text-xs font-medium text-stone-500">
						Total do mês
					</p>
					<p className="text-lg font-semibold text-orange-600">
						{formatarMoeda(totalReceitas)}
					</p>
				</div>
			</div>

			{fetcherExtrato.data?.error && (
				<Alert variant="destructive">
					<AlertCircle className="size-4" />
					<AlertTitle>Erro ao importar extrato</AlertTitle>
					<AlertDescription>{fetcherExtrato.data.error}</AlertDescription>
				</Alert>
			)}
			{fetcherExtrato.data?.success && fetcherExtrato.state === "idle" && (
				<Alert>
					<Upload className="size-4" />
					<AlertTitle>Importação concluída</AlertTitle>
					<AlertDescription>
						{fetcherExtrato.data.inseridas} receita(s) nova(s) criada(s)
						{fetcherExtrato.data.ignoradas
							? `, ${fetcherExtrato.data.ignoradas} já importada(s) anteriormente (ignorada(s))`
							: ""}
						.
					</AlertDescription>
				</Alert>
			)}

			<DataTable
				columns={getColumnsRec({ onEdit: setEditingReceita })}
				data={receitas}
				getRowId={(row) => row.id}
				onRowClick={setEditingReceita}
				filterColumn="forma"
				filterPlaceholder="Filtrar por forma..."
			/>
			{editingReceita && (
				<DialogEditarReceita
					receita={editingReceita}
					open={!!editingReceita}
					onClose={() => setEditingReceita(null)}
				/>
			)}
		</div>
	);
}
