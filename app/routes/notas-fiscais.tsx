import { useRef } from "react";
import { useFetcher, useSearchParams } from "react-router";
import {
	AlertCircle,
	Mail,
	MailX,
	ReceiptText,
	Scale,
	Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { DataTable } from "~/components/desp-table";
import { getColumnsNotasFiscais } from "~/components/notas-fiscais/columns-notas-fiscais";
import { getResumoNotasFiscaisMes } from "~/models/notas-fiscais.server";
import {
	getTotalVendasStoneDoMes,
	importarVendasStone,
} from "~/models/vendas-stone.server";
import type { Route } from "./+types/notas-fiscais";

const MESES = [
	{ valor: 1, label: "Janeiro" },
	{ valor: 2, label: "Fevereiro" },
	{ valor: 3, label: "Março" },
	{ valor: 4, label: "Abril" },
	{ valor: 5, label: "Maio" },
	{ valor: 6, label: "Junho" },
	{ valor: 7, label: "Julho" },
	{ valor: 8, label: "Agosto" },
	{ valor: 9, label: "Setembro" },
	{ valor: 10, label: "Outubro" },
	{ valor: 11, label: "Novembro" },
	{ valor: 12, label: "Dezembro" },
];

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function obterAnosDisponiveis(): number[] {
	const anoAtual = new Date().getFullYear();
	return [anoAtual - 1, anoAtual, anoAtual + 1];
}

function parseMesAno(
	mesParam: string | null,
	anoParam: string | null,
): { mes: number; ano: number } {
	const hoje = new Date();
	const mes = mesParam ? Number.parseInt(mesParam, 10) : hoje.getMonth() + 1;
	const ano = anoParam ? Number.parseInt(anoParam, 10) : hoje.getFullYear();
	return {
		mes: mes >= 1 && mes <= 12 ? mes : hoje.getMonth() + 1,
		ano: ano >= 2000 && ano <= 2100 ? ano : hoje.getFullYear(),
	};
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	if (formData.get("intent") !== "importar-stone") return null;

	const file = formData.get("arquivo");
	if (!(file instanceof File) || file.size === 0) {
		return { error: "Selecione o arquivo CSV exportado pela Stone." };
	}
	if (!file.name.toLowerCase().endsWith(".csv")) {
		return { error: "Formato inválido. Envie o arquivo .csv da Stone." };
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const resultado = await importarVendasStone(buffer);
		return { success: true, ...resultado };
	} catch (err) {
		const msg =
			err instanceof Error ? err.message : "Erro ao importar o arquivo.";
		return { error: msg };
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const { mes, ano } = parseMesAno(
		url.searchParams.get("mes"),
		url.searchParams.get("ano"),
	);

	const [resumo, stone] = await Promise.all([
		getResumoNotasFiscaisMes(mes, ano),
		getTotalVendasStoneDoMes(mes, ano),
	]);

	return { resumo, stone };
}

export default function NotasFiscais({ loaderData }: Route.ComponentProps) {
	const { resumo, stone } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const fetcher = useFetcher<{
		success?: boolean;
		error?: string;
		inseridas?: number;
		ignoradas?: number;
	}>();
	const fileInputRef = useRef<HTMLInputElement>(null);

	function atualizarFiltro(chave: "mes" | "ano", valor: string) {
		const params = new URLSearchParams(searchParams);
		params.set(chave, valor);
		setSearchParams(params);
	}

	const quantidadeEnviadas = resumo.notas.filter((n) => n.enviadaPorEmail).length;
	const quantidadeNaoEnviadas = resumo.quantidade - quantidadeEnviadas;
	const diferenca = stone.totalBruto - resumo.valorTotal;

	return (
		<div className="container mx-auto space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold text-orange-500">Notas Fiscais</h1>
				<div className="flex flex-wrap items-center gap-2">
					<Select
						value={String(resumo.mes)}
						onValueChange={(v) => atualizarFiltro("mes", v)}>
						<SelectTrigger className="w-[160px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MESES.map((m) => (
								<SelectItem key={m.valor} value={String(m.valor)}>
									{m.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={String(resumo.ano)}
						onValueChange={(v) => atualizarFiltro("ano", v)}>
						<SelectTrigger className="w-[100px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{obterAnosDisponiveis().map((a) => (
								<SelectItem key={a} value={String(a)}>
									{a}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<fetcher.Form method="post" encType="multipart/form-data">
						<input type="hidden" name="intent" value="importar-stone" />
						<input
							ref={fileInputRef}
							type="file"
							name="arquivo"
							accept=".csv"
							className="hidden"
							onChange={(e) => {
								const form = e.target.form;
								if (form && e.target.files?.[0]) {
									fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
								}
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={fetcher.state !== "idle"}>
							<Upload className="mr-2 size-4" />
							{fetcher.state !== "idle" ? "Importando..." : "Importar CSV Stone"}
						</Button>
					</fetcher.Form>
				</div>
			</div>

			{fetcher.data?.error && (
				<Alert variant="destructive">
					<AlertCircle className="size-4" />
					<AlertTitle>Erro ao importar CSV da Stone</AlertTitle>
					<AlertDescription>{fetcher.data.error}</AlertDescription>
				</Alert>
			)}
			{fetcher.data?.success && fetcher.state === "idle" && (
				<Alert>
					<Upload className="size-4" />
					<AlertTitle>Importação concluída</AlertTitle>
					<AlertDescription>
						{fetcher.data.inseridas} venda(s) nova(s) gravada(s)
						{fetcher.data.ignoradas
							? `, ${fetcher.data.ignoradas} já importada(s) anteriormente (ignorada(s))`
							: ""}
						.
					</AlertDescription>
				</Alert>
			)}

			{resumo.erro && (
				<Alert variant="destructive">
					<AlertCircle className="size-4" />
					<AlertTitle>Erro ao consultar a EVO</AlertTitle>
					<AlertDescription>{resumo.erro}</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Valor total emitido
						</CardTitle>
						<ReceiptText className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatadorMoeda.format(resumo.valorTotal)}
						</div>
						<CardDescription>
							{resumo.quantidade} nota(s) emitida(s) no mês
						</CardDescription>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Enviadas por e-mail
						</CardTitle>
						<Mail className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{quantidadeEnviadas}</div>
						<CardDescription>notas com envio confirmado</CardDescription>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Não enviadas
						</CardTitle>
						<MailX className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{quantidadeNaoEnviadas}</div>
						<CardDescription>emitidas mas sem envio por e-mail</CardDescription>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Conciliação com a Stone
					</CardTitle>
					<Scale className="size-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<div className="text-2xl font-bold">
								{formatadorMoeda.format(stone.totalBruto)}
							</div>
							<CardDescription>
								Vendido na Stone ({stone.quantidade} venda(s) aprovada(s), valor
								bruto)
							</CardDescription>
						</div>
						<div>
							<div className="text-2xl font-bold">
								{formatadorMoeda.format(resumo.valorTotal)}
							</div>
							<CardDescription>Notas fiscais emitidas</CardDescription>
						</div>
						<div>
							<div
								className={`text-2xl font-bold ${
									Math.abs(diferenca) < 0.01
										? ""
										: diferenca > 0
											? "text-orange-500"
											: "text-red-600"
								}`}>
								{formatadorMoeda.format(diferenca)}
							</div>
							<CardDescription>
								Diferença (Stone − NF). Positivo = vendido sem nota
								correspondente ainda.
							</CardDescription>
						</div>
					</div>
				</CardContent>
			</Card>

			<DataTable
				columns={getColumnsNotasFiscais()}
				data={resumo.notas}
				filterColumn="nomeCliente"
				filterPlaceholder="Filtrar por cliente..."
			/>
		</div>
	);
}
