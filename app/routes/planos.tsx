import { useEffect, useMemo, useRef, useState } from "react";
import {
	AlertCircle,
	FileDown,
	Loader2,
	Plus,
	RefreshCw,
	Save,
	Users,
	Wallet,
} from "lucide-react";
import {
	useFetcher,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from "react-router";
import { DataTable } from "~/components/desp-table";
import {
	getColumnsPlanos,
	type ClientePlanoRow,
} from "~/components/planos/columns-planos";
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
import { calcularResumoRepasse } from "~/lib/plano-preco-mensal";
import {
	clientesParaLinhas,
	criarLinhaManual,
	linhaParaCliente,
	parseClientesGravacao,
	resolverProfessorPorNome,
} from "~/lib/planos-edicao";
import {
	FILTROS_PLANO_EVO,
	getFiltroPlanoPorId,
	type FiltroPlanoId,
} from "~/lib/planos-evo-filtros";
import {
	buscarContratosMes,
	professoresDosClientes,
	salvarContratosMes,
} from "~/models/contratos.server";
import { getClientesAtivosPorPlanoComConexao } from "~/models/evo.server";
import type { Route } from "./+types/planos";

export type FonteDadosPlanos = "banco" | "evo";

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

function parseIdProfessor(valor: string | null): number | undefined {
	if (!valor || valor === "todos") return undefined;
	const id = Number.parseInt(valor, 10);
	return Number.isFinite(id) ? id : undefined;
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

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const planoParam = url.searchParams.get("plano");
	const professorParam = url.searchParams.get("professor");
	const { mes, ano } = parseMesAno(
		url.searchParams.get("mes"),
		url.searchParams.get("ano"),
	);
	const forcarEvo = url.searchParams.get("fonte") === "evo";

	const filtro = getFiltroPlanoPorId(planoParam);
	if (!filtro) {
		return {
			planoSelecionado: null as FiltroPlanoId | null,
			professorSelecionado: null as string | null,
			mes,
			ano,
			fonte: null as FonteDadosPlanos | null,
			gravadoEm: null as string | null,
			clientes: [],
			professores: [],
			erro: null as string | null,
		};
	}

	const professorFiltro = professorParam ?? "todos";

	if (!forcarEvo) {
		const salvo = await buscarContratosMes(
			mes,
			ano,
			filtro.id,
			professorFiltro,
		);

		if (salvo) {
			return {
				planoSelecionado: filtro.id,
				professorSelecionado: professorFiltro,
				mes,
				ano,
				fonte: "banco" as const,
				gravadoEm: salvo.gravadoEm.toISOString(),
				clientes: salvo.clientes,
				professores: professoresDosClientes(salvo.clientes),
				erro: null,
			};
		}
	}

	const idProfessor = parseIdProfessor(professorFiltro);
	const resultado = await getClientesAtivosPorPlanoComConexao(
		filtro.id,
		idProfessor,
	);

	return {
		planoSelecionado: filtro.id,
		professorSelecionado: professorFiltro,
		mes,
		ano,
		fonte: "evo" as const,
		gravadoEm: null,
		clientes: resultado.clientes,
		professores: resultado.professores,
		erro: resultado.erro ?? null,
	};
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	if (formData.get("intent") !== "gravar") return null;

	const planoParam = formData.get("plano");
	const professorParam = formData.get("professor");
	const mesParam = formData.get("mes");
	const anoParam = formData.get("ano");

	const filtro = getFiltroPlanoPorId(
		typeof planoParam === "string" ? planoParam : null,
	);
	if (!filtro) {
		return { error: "Selecione um plano válido antes de gravar." };
	}

	const { mes, ano } = parseMesAno(
		typeof mesParam === "string" ? mesParam : null,
		typeof anoParam === "string" ? anoParam : null,
	);

	const professorFiltro =
		typeof professorParam === "string" && professorParam
			? professorParam
			: "todos";

	const dadosJson = formData.get("dados");
	if (typeof dadosJson !== "string" || !dadosJson) {
		return { error: "Dados da tabela não encontrados. Recarregue a página." };
	}

	const parseado = parseClientesGravacao(dadosJson);
	if ("error" in parseado) {
		return { error: parseado.error };
	}

	try {
		const salvo = await salvarContratosMes({
			mes,
			ano,
			planoFiltro: filtro.id,
			professorFiltro,
			clientes: parseado.clientes,
		});

		return {
			success: true,
			mes,
			ano,
			totalAlunos: salvo.totalAlunos,
			totalRepasse: salvo.totalRepasse,
		};
	} catch (err) {
		const msg =
			err instanceof Error ? err.message : "Não foi possível gravar os contratos.";
		return { error: msg };
	}
}

export default function Planos() {
	const {
		planoSelecionado,
		professorSelecionado,
		mes,
		ano,
		fonte,
		gravadoEm,
		clientes,
		professores,
		erro,
	} = useLoaderData<typeof loader>();
	const [searchParams, setSearchParams] = useSearchParams();
	const navigation = useNavigation();
	const fetcher = useFetcher<{
		success?: boolean;
		error?: string;
		mes?: number;
		ano?: number;
		totalAlunos?: number;
		totalRepasse?: number;
	}>();
	const carregando = navigation.state === "loading";
	const gravando = fetcher.state !== "idle";

	const [linhasEditaveis, setLinhasEditaveis] = useState<ClientePlanoRow[]>([]);
	const [fonteAposSalvar, setFonteAposSalvar] =
		useState<FonteDadosPlanos | null>(null);
	const posSalvamentoProcessado = useRef(false);

	const filtroAtual = planoSelecionado
		? getFiltroPlanoPorId(planoSelecionado)
		: undefined;

	useEffect(() => {
		if (planoSelecionado && !erro && !carregando) {
			setLinhasEditaveis(clientesParaLinhas(clientes));
		}
	}, [
		planoSelecionado,
		professorSelecionado,
		mes,
		ano,
		fonte,
		clientes,
		erro,
		carregando,
	]);

	useEffect(() => {
		setFonteAposSalvar(null);
	}, [planoSelecionado, professorSelecionado, mes, ano, fonte]);

	useEffect(() => {
		if (fetcher.state === "submitting" || fetcher.state === "loading") {
			posSalvamentoProcessado.current = false;
		}
	}, [fetcher.state]);

	useEffect(() => {
		if (posSalvamentoProcessado.current) return;
		if (fetcher.state !== "idle" || !fetcher.data?.success) return;

		posSalvamentoProcessado.current = true;
		setFonteAposSalvar("banco");

		const params = new URLSearchParams(searchParams);
		if (fetcher.data.mes) params.set("mes", String(fetcher.data.mes));
		if (fetcher.data.ano) params.set("ano", String(fetcher.data.ano));
		params.delete("fonte");
		if (params.toString() !== searchParams.toString()) {
			setSearchParams(params, { replace: true });
		}
	}, [fetcher.data, fetcher.state, mes, ano, searchParams, setSearchParams]);

	const fonteExibida = fonteAposSalvar ?? fonte;

	const resumo = useMemo(
		() => calcularResumoRepasse(linhasEditaveis),
		[linhasEditaveis],
	);

	const colunas = useMemo(
		() =>
			getColumnsPlanos({
				professores,
				onUpdate: (id, patch) => {
					setLinhasEditaveis((atual) =>
						atual.map((linha) => {
							if (linha.id !== id) return linha;
							const atualizada = { ...linha, ...patch };
							if ("nomeProfessor" in patch) {
								return {
									...atualizada,
									...resolverProfessorPorNome(
										atualizada.nomeProfessor ?? "",
										professores,
									),
								};
							}
							return atualizada;
						}),
					);
				},
				onRemove: (id) => {
					setLinhasEditaveis((atual) => atual.filter((linha) => linha.id !== id));
				},
			}),
		[professores],
	);

	const nomeProfessorFiltro =
		professorSelecionado && professorSelecionado !== "todos"
			? professores.find((p) => String(p.id) === professorSelecionado)?.nome
			: null;

	function atualizarSearchParams(
		patch: Record<string, string | null | undefined>,
	) {
		const params = new URLSearchParams(searchParams);
		for (const [chave, valor] of Object.entries(patch)) {
			if (valor == null || valor === "") {
				params.delete(chave);
			} else {
				params.set(chave, valor);
			}
		}
		setSearchParams(params);
	}

	function atualizarFiltros(plano: string | null, professor: string | null) {
		atualizarSearchParams({
			plano,
			professor: professor && professor !== "todos" ? professor : null,
			fonte: null,
		});
	}

	function handleMesChange(valor: string) {
		atualizarSearchParams({ mes: valor, fonte: null });
	}

	function handleAnoChange(valor: string) {
		atualizarSearchParams({ ano: valor, fonte: null });
	}

	function atualizarDaEvo() {
		atualizarSearchParams({ fonte: "evo" });
	}

	function handlePlanoChange(valor: string) {
		atualizarFiltros(valor, null);
	}

	function handleProfessorChange(valor: string) {
		if (!planoSelecionado) return;
		atualizarFiltros(planoSelecionado, valor);
	}

	function adicionarLinha() {
		const nomePlanoPadrao = filtroAtual?.label ?? "";
		setLinhasEditaveis((atual) => [
			...atual,
			criarLinhaManual(nomePlanoPadrao),
		]);
	}

	function montarUrlPdfRepasse(): string {
		const params = new URLSearchParams();
		if (planoSelecionado) params.set("plano", planoSelecionado);
		params.set("professor", professorSelecionado ?? "todos");
		params.set("mes", String(mes));
		params.set("ano", String(ano));
		if (fonteExibida === "evo") params.set("fonte", "evo");
		return `/planos/pdf?${params.toString()}`;
	}

	function gravarNoBanco() {
		if (!planoSelecionado) return;

		fetcher.submit(
			{
				intent: "gravar",
				plano: planoSelecionado,
				professor: professorSelecionado ?? "todos",
				mes: String(mes),
				ano: String(ano),
				dados: JSON.stringify(linhasEditaveis.map(linhaParaCliente)),
			},
			{ method: "post" },
		);
	}

	const mesSalvoLabel = fetcher.data?.mes
		? MESES.find((m) => m.valor === fetcher.data?.mes)?.label
		: null;

	return (
		<div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<Users className="size-6 text-orange-500" />
					<h1 className="text-2xl font-bold text-orange-500">
						Consulta por Plano
					</h1>
				</div>
			</div>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
				<div className="space-y-2">
					<label className="text-sm font-medium">Plano</label>
					<Select
						value={planoSelecionado ?? undefined}
						onValueChange={handlePlanoChange}>
						<SelectTrigger className="w-full min-w-[220px]">
							<SelectValue placeholder="Selecione o plano" />
						</SelectTrigger>
						<SelectContent>
							{FILTROS_PLANO_EVO.map((filtro) => (
								<SelectItem key={filtro.id} value={filtro.id}>
									{filtro.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<label className="text-sm font-medium">Professor</label>
					<Select
						value={professorSelecionado ?? "todos"}
						onValueChange={handleProfessorChange}
						disabled={!planoSelecionado || carregando}>
						<SelectTrigger className="w-full min-w-[220px]">
							<SelectValue placeholder="Todos os professores" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="todos">Todos os professores</SelectItem>
							{professores.map((prof) => (
								<SelectItem key={prof.id} value={String(prof.id)}>
									{prof.nome}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{carregando && (
					<div className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						{searchParams.get("fonte") === "evo"
							? "Consultando EVO…"
							: "Carregando…"}
					</div>
				)}
			</div>

			{!planoSelecionado && (
				<Alert>
					<AlertCircle />
					<AlertTitle>Selecione um plano</AlertTitle>
					<AlertDescription>
						Escolha um dos planos disponíveis (Judô, Boxe, Pilates, Karatê,
						Krav Maga, Kung Fu, Muay Thai ou Quattor Prime) para consultar os
						alunos com contrato ativo vigente.
					</AlertDescription>
				</Alert>
			)}

			{erro && (
				<Alert variant="destructive">
					<AlertCircle />
					<AlertTitle>Erro na consulta</AlertTitle>
					<AlertDescription>{erro}</AlertDescription>
				</Alert>
			)}

			{planoSelecionado && !erro && (
				<>
					<Card className="min-w-0 w-full max-w-full overflow-hidden">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2 text-lg">
								<Wallet className="size-5 shrink-0 text-orange-500" />
								Resumo do repasse
							</CardTitle>
							<CardDescription className="truncate">
								{filtroAtual?.label}
								{nomeProfessorFiltro
									? ` — Professor: ${nomeProfessorFiltro}`
									: " — Todos os professores"}
								{fonteExibida === "banco"
									? gravadoEm
										? ` — Salvo em ${new Date(gravadoEm).toLocaleString("pt-BR")}`
										: " — Salvo no banco"
									: fonteExibida === "evo"
										? " — Dados da EVO"
										: ""}
							</CardDescription>
						</CardHeader>
						<CardContent className="min-w-0 space-y-4">
							<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="min-w-0 rounded-lg border bg-muted/30 p-4">
									<p className="text-sm text-muted-foreground">
										Alunos filtrados
									</p>
									<p className="text-2xl font-bold">{resumo.totalAlunos}</p>
								</div>
								<div className="min-w-0 rounded-lg border bg-muted/30 p-4">
									<p className="text-sm text-muted-foreground">
										Repasse professor (50%)
									</p>
									<p className="text-2xl font-bold text-orange-500">
										{formatadorMoeda.format(resumo.totalRepasse)}
									</p>
								</div>
							</div>

							{resumo.alunosSemMensalidade > 0 && (
								<p className="text-sm text-amber-600 dark:text-amber-400">
									{resumo.alunosSemMensalidade} aluno
									{resumo.alunosSemMensalidade !== 1 ? "s" : ""} sem mensalidade
									calculável (não entram no total de repasse).
								</p>
							)}

							<div className="flex min-w-0 flex-col gap-4 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-end">
								<div className="min-w-0 space-y-2">
									<label className="text-sm font-medium">
										Mês de referência
									</label>
									<div className="flex max-w-full flex-wrap gap-2">
										<Select
											value={String(mes)}
											onValueChange={handleMesChange}>
											<SelectTrigger className="w-full max-w-[150px]">
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
											value={String(ano)}
											onValueChange={handleAnoChange}>
											<SelectTrigger className="w-full max-w-[100px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{obterAnosDisponiveis().map((ano) => (
													<SelectItem key={ano} value={String(ano)}>
														{ano}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2 sm:ml-auto">
									<Button
										type="button"
										variant="outline"
										disabled={resumo.totalAlunos === 0}
										asChild>
										<a
											href={montarUrlPdfRepasse()}
											target="_blank"
											rel="noopener noreferrer">
											<FileDown className="mr-2 size-4" />
											Gerar PDF
										</a>
									</Button>
									{fonteExibida === "banco" && (
										<Button
											type="button"
											variant="outline"
											disabled={carregando}
											onClick={atualizarDaEvo}>
											<RefreshCw className="mr-2 size-4" />
											Atualizar da EVO
										</Button>
									)}
									<Button
										type="button"
										disabled={gravando || resumo.totalAlunos === 0}
										onClick={gravarNoBanco}>
										{gravando ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : (
											<Save className="mr-2 size-4" />
										)}
										{gravando
											? "Gravando…"
											: fonteExibida === "banco"
												? "Atualizar no banco"
												: "Gravar no banco"}
									</Button>
								</div>
							</div>

							{fetcher.data?.error && (
								<Alert variant="destructive">
									<AlertCircle />
									<AlertTitle>Erro ao gravar</AlertTitle>
									<AlertDescription>{fetcher.data.error}</AlertDescription>
								</Alert>
							)}

							{fetcher.data?.success && fetcher.state === "idle" && (
								<Alert>
									<AlertCircle />
									<AlertTitle>Gravado com sucesso</AlertTitle>
									<AlertDescription>
										{fetcher.data.totalAlunos} aluno
										{fetcher.data.totalAlunos !== 1 ? "s" : ""} salvos para{" "}
										{mesSalvoLabel}/{fetcher.data.ano} — total de repasse{" "}
										{formatadorMoeda.format(fetcher.data.totalRepasse ?? 0)}.
										Se já existia registro para este mês, plano e professor, os
										dados foram atualizados. Use &quot;Gerar PDF&quot; para
										enviar ao professor.
									</AlertDescription>
								</Alert>
							)}
						</CardContent>
					</Card>

					<div className="min-w-0 w-full max-w-full">
						<DataTable<ClientePlanoRow, unknown>
							columns={colunas}
							data={linhasEditaveis}
							filterColumn="nomeCliente"
							filterPlaceholder="Filtrar por cliente..."
							filterExtra={
								<Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
									<Plus className="mr-2 size-4" />
									Adicionar aluno
								</Button>
							}
						/>
					</div>
				</>
			)}
		</div>
	);
}
