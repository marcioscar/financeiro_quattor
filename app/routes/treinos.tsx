import { Check, Copy, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/treinos";
import {
	addExerciciosToBancoTreino,
	createBancoTreino,
	findBancoTreinoByCicloTreinoGrupo,
	getBancoTreinos,
	getBancoTreinosByCicloTreino,
	updateBancoTreino,
} from "~/models/banco_treino.server";
import { cadastrarTreinosNaSemanaFromBanco } from "~/models/treinos.server";
import {
	CICLOS_OPCOES,
	GRUPOS,
	TREINOS_OPCOES,
} from "~/constants/treinos";
import { cn, toTitleCase } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader() {
	const bancoTreinos = await getBancoTreinos();
	const [videoItems, defaultVideo] = await Promise.all([
		getTreinosVideoItems(),
		getTreinosDefaultVideo(),
	]);
	return {
		bancoTreinos,
		sugestoes: {
			videoItems,
			defaultVideo,
			catalogo: montarCatalogoExercicios(bancoTreinos, videoItems),
			repeticoes: repeticoesFrequentes(bancoTreinos),
		},
	};
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "criar") {
		const ciclo = formData.get("ciclo");
		const treino = formData.get("treino");
		const grupo = formData.get("grupo");
		const exerciciosJson = formData.get("exercicios");

		if (
			typeof ciclo !== "string" ||
			!ciclo.trim() ||
			typeof treino !== "string" ||
			!treino.trim() ||
			typeof grupo !== "string" ||
			!grupo.trim() ||
			typeof exerciciosJson !== "string" ||
			!exerciciosJson
		) {
			return { error: "Preencha todos os campos obrigatórios" };
		}

		let exercicios: Array<Record<string, unknown>>;
		try {
			exercicios = JSON.parse(exerciciosJson) as Array<Record<string, unknown>>;
		} catch {
			return { error: "Dados dos exercícios inválidos" };
		}

		if (!Array.isArray(exercicios) || exercicios.length === 0) {
			return { error: "Adicione pelo menos um exercício" };
		}

		const defaultVideo = await getTreinosDefaultVideo();
		const exerciciosValidados = exercicios.map((ex) => {
			const nome = String(ex.exercicio ?? ex.nome ?? "").trim();
			return {
				exercicio: toTitleCase(nome),
				observacao: String(ex.observacao ?? ex.obs ?? "").trim(),
				video: String(ex.video ?? defaultVideo).trim(),
				repeticoes: String(ex.repeticoes ?? ex.Repeticoes ?? "").trim(),
			};
		});

		const invalidos = exerciciosValidados.filter((ex) => !ex.exercicio);
		if (invalidos.length > 0) {
			return { error: "Todos os exercícios devem ter um nome" };
		}

		const treinoFormatado = treino.trim().replace(/\s+/g, "");

		try {
			const existente = await findBancoTreinoByCicloTreinoGrupo({
				ciclo: ciclo.trim(),
				treino: treinoFormatado,
				grupo: grupo.trim(),
			});

			if (existente) {
				await addExerciciosToBancoTreino(existente.id, exerciciosValidados);
			} else {
				await createBancoTreino({
					ciclo: ciclo.trim(),
					treino: treinoFormatado,
					grupo: grupo.trim(),
					exercicios: exerciciosValidados,
				});
			}
			return { success: true };
		} catch (err) {
			console.error("[treinos] Erro ao cadastrar:", err);
			const msg =
				err instanceof Error ? err.message : "Erro ao cadastrar treino";
			return { error: msg };
		}
	}

	if (intent === "editar") {
		const id = formData.get("id");
		const exerciciosJson = formData.get("exercicios");

		if (
			typeof id !== "string" ||
			!id.trim() ||
			typeof exerciciosJson !== "string" ||
			!exerciciosJson
		) {
			return { error: "Dados inválidos" };
		}

		let exercicios: Array<Record<string, unknown>>;
		try {
			exercicios = JSON.parse(exerciciosJson) as Array<Record<string, unknown>>;
		} catch {
			return { error: "Dados dos exercícios inválidos" };
		}

		if (!Array.isArray(exercicios) || exercicios.length === 0) {
			return { error: "Adicione pelo menos um exercício" };
		}

		const defaultVideo = await getTreinosDefaultVideo();
		const exerciciosValidados = exercicios.map((ex) => {
			const nome = String(ex.exercicio ?? ex.nome ?? "").trim();
			return {
				exercicio: toTitleCase(nome),
				observacao: String(ex.observacao ?? ex.obs ?? "").trim(),
				video: String(ex.video ?? defaultVideo).trim(),
				repeticoes: String(ex.repeticoes ?? ex.Repeticoes ?? "").trim(),
			};
		});

		const invalidos = exerciciosValidados.filter((ex) => !ex.exercicio);
		if (invalidos.length > 0) {
			return { error: "Todos os exercícios devem ter um nome" };
		}

		try {
			await updateBancoTreino(id.trim(), { exercicios: exerciciosValidados });
			return { success: true };
		} catch (err) {
			console.error("[treinos] Erro ao atualizar:", err);
			const msg =
				err instanceof Error ? err.message : "Erro ao atualizar treino";
			return { error: msg };
		}
	}

	if (intent === "cadastrarSemana") {
		const ciclo = formData.get("ciclo");
		const treino = formData.get("treino");

		if (
			typeof ciclo !== "string" ||
			!ciclo.trim() ||
			typeof treino !== "string" ||
			!treino.trim()
		) {
			return { error: "Selecione ciclo e treino nos filtros" };
		}

		try {
			const bancoTreinos = await getBancoTreinosByCicloTreino({
				ciclo: ciclo.trim(),
				treino: treino.trim(),
			});

			if (bancoTreinos.length === 0) {
				return { error: "Nenhum treino encontrado para este ciclo e treino" };
			}

			const { semana, ano, criados, atualizados } =
				await cadastrarTreinosNaSemanaFromBanco(bancoTreinos);

			const partes: string[] = [];
			if (criados.length > 0) {
				partes.push(`${criados.length} grupo(s) cadastrado(s)`);
			}
			if (atualizados.length > 0) {
				partes.push(`${atualizados.length} grupo(s) atualizado(s)`);
			}

			const message =
				partes.length > 0
					? `${partes.join(", ")} na semana ${semana}/${ano}`
					: "Nenhum grupo processado.";

			return { success: true, message };
		} catch (err) {
			console.error("[treinos] Erro ao cadastrar na semana:", err);
			const msg =
				err instanceof Error
					? err.message
					: "Erro ao cadastrar treinos na semana";
			return { error: msg };
		}
	}

	return null;
}

import type { BancoTreinoRow } from "~/components/treinos/columns-treinos";
import { TreinosCadastrados } from "~/components/treinos/treinos-cadastrados";
import { DialogEditarTreino } from "~/components/treinos/dialog-editar-treino";
import type { ExercicioForm } from "~/components/treinos/linha-exercicio";
import {
	ListaExercicios,
	exercicioVazio,
} from "~/components/treinos/lista-exercicios";
import {
	getTreinosDefaultVideo,
	getTreinosVideoItems,
	montarCatalogoExercicios,
	repeticoesFrequentes,
} from "~/lib/treinos-videos.server";

/** "Treino 5" e "Treino5" são o mesmo treino */
const treinoNorm = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "");
const numeroCiclo = (c: string | null | undefined) =>
	Number(/\d+/.exec(c ?? "")?.[0] ?? 0);

function Passo({
	numero,
	titulo,
	children,
}: {
	numero: number;
	titulo: string;
	children: React.ReactNode;
}) {
	return (
		<div className='space-y-2'>
			<div className='flex items-center gap-2 text-sm font-medium'>
				<span className='flex size-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white'>
					{numero}
				</span>
				{titulo}
			</div>
			{children}
		</div>
	);
}

export default function Treinos() {
	const { bancoTreinos, sugestoes } = useLoaderData<typeof loader>();
	const { defaultVideo } = sugestoes;
	const fetcher = useFetcher<{
		error?: string;
		success?: boolean;
		message?: string;
	}>();
	const submittedRef = useRef(false);

	// começa no ciclo mais recente já cadastrado
	const cicloMaisRecente = useMemo(() => {
		const n = Math.max(0, ...bancoTreinos.map((b) => numeroCiclo(b.ciclo)));
		return CICLOS_OPCOES.find((c) => numeroCiclo(c) === n) ?? "";
	}, [bancoTreinos]);

	const [ciclo, setCiclo] = useState<string>(cicloMaisRecente);
	const [treino, setTreino] = useState("");
	const [grupo, setGrupo] = useState("");
	const [exercicios, setExercicios] = useState<ExercicioForm[]>([
		exercicioVazio(defaultVideo),
	]);
	const [salvoMsg, setSalvoMsg] = useState("");
	const [editingTreino, setEditingTreino] = useState<BancoTreinoRow | null>(
		null,
	);
	const formRef = useRef<HTMLDivElement>(null);

	/** grupos já cadastrados no ciclo/treino escolhidos */
	const existentes = useMemo(() => {
		const m = new Map<string, BancoTreinoRow>();
		if (!ciclo || !treino) return m;
		for (const b of bancoTreinos as BancoTreinoRow[]) {
			if (b.ciclo === ciclo && treinoNorm(b.treino) === treinoNorm(treino) && b.grupo) {
				m.set(b.grupo, b);
			}
		}
		return m;
	}, [bancoTreinos, ciclo, treino]);

	const grupoExistente = grupo ? existentes.get(grupo) : undefined;

	/** mesmo treino e grupo no ciclo anterior mais recente, para copiar */
	const anterior = useMemo(() => {
		if (!ciclo || !treino || !grupo || grupoExistente) return undefined;
		return (bancoTreinos as BancoTreinoRow[])
			.filter(
				(b) =>
					b.grupo === grupo &&
					treinoNorm(b.treino) === treinoNorm(treino) &&
					numeroCiclo(b.ciclo) < numeroCiclo(ciclo) &&
					b.exercicios?.length,
			)
			.sort((a, b) => numeroCiclo(b.ciclo) - numeroCiclo(a.ciclo))[0];
	}, [bancoTreinos, ciclo, treino, grupo, grupoExistente]);

	function copiarAnterior() {
		if (!anterior) return;
		const copiados = anterior.exercicios.map((ex) => ({
			exercicio: ex.exercicio ?? "",
			repeticoes: ex.repeticoes ?? "",
			observacao: ex.observacao ?? "",
			video: ex.video || defaultVideo,
			videoManual: true,
		}));
		// não apaga o que já foi digitado: os copiados entram depois
		setExercicios((atuais) => [
			...atuais.filter((ex) => ex.exercicio.trim()),
			...copiados,
		]);
	}

	function limpar() {
		setGrupo("");
		setExercicios([exercicioVazio(defaultVideo)]);
	}

	const preenchidos = exercicios.filter((ex) => ex.exercicio.trim());

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!ciclo || !treino || !grupo || preenchidos.length === 0) return;

		const formData = new FormData();
		formData.append("intent", "criar");
		formData.append("ciclo", ciclo);
		formData.append("treino", treino);
		formData.append("grupo", grupo);
		formData.append(
			"exercicios",
			JSON.stringify(preenchidos.map(({ videoManual: _, ...ex }) => ex)),
		);
		setSalvoMsg(
			`${grupo} salvo em ${ciclo} / ${treino} (${preenchidos.length} exercício${preenchidos.length > 1 ? "s" : ""})`,
		);
		fetcher.submit(formData, { method: "post" });
	}

	useEffect(() => {
		if (fetcher.state === "submitting") submittedRef.current = true;
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (fetcher.data?.success) {
				// mantém ciclo e treino: o próximo passo é cadastrar outro grupo
				setGrupo("");
				setExercicios([exercicioVazio(defaultVideo)]);
			}
		}
	}, [fetcher.state, fetcher.data, defaultVideo]);

	const busy = fetcher.state !== "idle";
	const isValid = ciclo && treino && grupo && preenchidos.length > 0;
	const mostrarSalvo =
		fetcher.state === "idle" && fetcher.data?.success && !grupo && salvoMsg;

	return (
		<div className='container mx-auto space-y-6 py-6'>
			<h1 className='text-2xl font-bold text-orange-500'>Banco de Treinos</h1>

			<Card ref={formRef} className='scroll-mt-4'>
				<CardHeader>
					<CardTitle>Cadastrar treino</CardTitle>
				</CardHeader>
				<CardContent>
					<fetcher.Form onSubmit={handleSubmit} className='space-y-6'>
						<div className='grid gap-6 lg:grid-cols-[200px_1fr]'>
							<Passo numero={1} titulo='Ciclo'>
								<Select value={ciclo} onValueChange={setCiclo} disabled={busy}>
									<SelectTrigger className='w-full'>
										<SelectValue placeholder='Selecione o ciclo' />
									</SelectTrigger>
									<SelectContent>
										{CICLOS_OPCOES.map((c) => (
											<SelectItem key={c} value={c}>
												{c}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Passo>

							<Passo numero={2} titulo='Treino'>
								<div className='flex flex-wrap gap-1.5'>
									{TREINOS_OPCOES.map((t) => (
										<Button
											key={t}
											type='button'
											size='sm'
											variant={treino === t ? "default" : "outline"}
											onClick={() => setTreino(t)}
											disabled={busy}
											className={cn(
												"min-w-20",
												treino === t && "bg-orange-500 hover:bg-orange-600",
											)}>
											{t}
										</Button>
									))}
								</div>
							</Passo>
						</div>

						<Passo numero={3} titulo='Grupo muscular'>
							{!treino && (
								<p className='text-xs text-muted-foreground'>
									Escolha o treino para ver quais grupos já foram cadastrados.
								</p>
							)}
							<div className='flex flex-wrap gap-1.5'>
								{GRUPOS.map((g) => {
									const ja = existentes.get(g);
									return (
										<Button
											key={g}
											type='button'
											size='sm'
											variant={grupo === g ? "default" : "outline"}
											onClick={() => setGrupo(g)}
											disabled={busy}
											className={cn(
												"h-8 text-xs",
												grupo === g && "bg-orange-500 hover:bg-orange-600",
												ja && grupo !== g && "border-green-300 bg-green-50 text-green-800 hover:bg-green-100",
											)}>
											{ja && <Check className='size-3.5' />}
											{g}
											{ja && (
												<span className='text-[10px] opacity-70'>
													{ja.exercicios.length}
												</span>
											)}
										</Button>
									);
								})}
							</div>
						</Passo>

						{grupoExistente && (
							<div className='flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
								<span>
									<strong>{grupo}</strong> já tem {grupoExistente.exercicios.length}{" "}
									exercício(s) neste treino. Os que você cadastrar aqui serão
									adicionados ao final.
								</span>
								<Button
									type='button'
									size='sm'
									variant='outline'
									onClick={() => setEditingTreino(grupoExistente)}>
									<Pencil className='mr-1 size-3.5' />
									Editar os existentes
								</Button>
							</div>
						)}

						{anterior && (
							<div className='flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm'>
								<span className='text-muted-foreground'>
									Quer partir do {anterior.ciclo}? {grupo} tinha{" "}
									{anterior.exercicios.length} exercício(s) lá.
								</span>
								<Button
									type='button'
									size='sm'
									variant='outline'
									onClick={copiarAnterior}
									disabled={busy}>
									<Copy className='mr-1 size-3.5' />
									Copiar do {anterior.ciclo}
								</Button>
							</div>
						)}

						<Passo numero={4} titulo='Exercícios'>
							<p className='text-xs text-muted-foreground'>
								O vídeo é escolhido sozinho pelo nome do exercício. Se não for o
								certo, é só trocar.
							</p>
							<ListaExercicios
								exercicios={exercicios}
								onChange={setExercicios}
								sugestoes={sugestoes}
								disabled={busy}
							/>
						</Passo>

						{fetcher.data?.error && (
							<p className='text-sm text-destructive'>{fetcher.data.error}</p>
						)}
						{mostrarSalvo && (
							<p className='flex items-center gap-1 text-sm text-green-700'>
								<Check className='size-4' />
								{salvoMsg}
							</p>
						)}

						<div className='flex justify-end gap-2'>
							<Button type='button' variant='outline' onClick={limpar} disabled={busy}>
								Limpar
							</Button>
							<Button
								type='submit'
								disabled={busy || !isValid}
								className='bg-orange-500 hover:bg-orange-600'>
								{busy
									? "Salvando..."
									: preenchidos.length > 0
										? `Cadastrar ${preenchidos.length} exercício${preenchidos.length > 1 ? "s" : ""}`
										: "Cadastrar treino"}
							</Button>
						</div>
					</fetcher.Form>
				</CardContent>
			</Card>

			<TreinosCadastrados
				bancoTreinos={bancoTreinos as BancoTreinoRow[]}
				videoItems={sugestoes.videoItems}
				cicloInicial={cicloMaisRecente}
				selecao={{ ciclo, treino }}
				onEditar={setEditingTreino}
				onCadastrarGrupo={(c, t, g) => {
					setCiclo(c);
					setTreino(t);
					setGrupo(g);
					formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
				}}
			/>

			{editingTreino && (
				<DialogEditarTreino
					treino={editingTreino}
					sugestoes={sugestoes}
					open={!!editingTreino}
					onClose={() => setEditingTreino(null)}
				/>
			)}
		</div>
	);
}
