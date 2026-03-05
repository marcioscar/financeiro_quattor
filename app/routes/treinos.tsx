import { CalendarPlus, FileDown, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { toTitleCase } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const GRUPO_ITEMS = GRUPOS.map((g) => ({ value: g, label: g }));

export async function loader() {
	const bancoTreinos = await getBancoTreinos();
	return { bancoTreinos };
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

		const exerciciosValidados = exercicios.map((ex) => {
			const nome = String(ex.exercicio ?? ex.nome ?? "").trim();
			return {
				exercicio: toTitleCase(nome),
				observacao: String(ex.observacao ?? ex.obs ?? "").trim(),
				video: String(ex.video ?? "producao.gif").trim(),
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

		const exerciciosValidados = exercicios.map((ex) => {
			const nome = String(ex.exercicio ?? ex.nome ?? "").trim();
			return {
				exercicio: toTitleCase(nome),
				observacao: String(ex.observacao ?? ex.obs ?? "").trim(),
				video: String(ex.video ?? "producao.gif").trim(),
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

			const { semana, criados, atualizados } =
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
					? `${partes.join(", ")} na semana ${semana}`
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

import { DataTable } from "~/components/desp-table";
import {
	getColumnsTreinos,
	type BancoTreinoRow,
} from "~/components/treinos/columns-treinos";
import { DialogEditarTreino } from "~/components/treinos/dialog-editar-treino";
import {
	LinhaExercicio,
	type ExercicioForm,
} from "~/components/treinos/linha-exercicio";

const exercicioInicial: ExercicioForm = {
	exercicio: "",
	repeticoes: "",
	observacao: "",
	video: "producao.gif",
};

export default function Treinos() {
	const { bancoTreinos } = useLoaderData<typeof loader>();
	const fetcher = useFetcher<{
		error?: string;
		success?: boolean;
		message?: string;
	}>();
	const fetcherSemana = useFetcher<{
		error?: string;
		success?: boolean;
		message?: string;
	}>();
	const submittedRef = useRef(false);
	const anchorGrupoRef = useComboboxAnchor();

	const [ciclo, setCiclo] = useState("");
	const [treino, setTreino] = useState("");
	const [grupo, setGrupo] = useState<{ value: string; label: string } | null>(
		null,
	);
	const [exercicios, setExercicios] = useState<ExercicioForm[]>([
		{ ...exercicioInicial },
	]);
	const [filtroCiclo, setFiltroCiclo] = useState<string>("todos");
	const [filtroTreino, setFiltroTreino] = useState<string>("todos");
	const [editingTreino, setEditingTreino] = useState<BancoTreinoRow | null>(
		null,
	);

	const filteredTreinos = useMemo(() => {
		let result = [...bancoTreinos] as BancoTreinoRow[];
		if (filtroCiclo && filtroCiclo !== "todos") {
			result = result.filter((t) => (t.ciclo ?? "") === filtroCiclo);
		}
		if (filtroTreino && filtroTreino !== "todos") {
			const treinoNorm = (v: string) => (v ?? "").replace(/\s+/g, "");
			result = result.filter(
				(t) => treinoNorm(t.treino ?? "") === treinoNorm(filtroTreino),
			);
		}
		return result;
	}, [bancoTreinos, filtroCiclo, filtroTreino]);

	const resetExercicios = useCallback(() => {
		setExercicios([{ ...exercicioInicial }]);
	}, []);

	const resetForm = useCallback(() => {
		setCiclo("");
		setTreino("");
		setGrupo(null);
		setExercicios([{ ...exercicioInicial }]);
	}, []);

	const addExercicio = useCallback(() => {
		setExercicios((prev) => [...prev, { ...exercicioInicial }]);
	}, []);

	const updateExercicio = useCallback((index: number, ex: ExercicioForm) => {
		setExercicios((prev) => {
			const next = [...prev];
			next[index] = ex;
			return next;
		});
	}, []);

	const removeExercicio = useCallback((index: number) => {
		setExercicios((prev) => {
			if (prev.length <= 1) return prev;
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!ciclo || !treino || !grupo?.value) return;

		const form = e.currentTarget;
		const formData = new FormData();
		formData.append("intent", "criar");
		formData.append("ciclo", ciclo);
		formData.append("treino", treino);
		formData.append("grupo", grupo.value);
		formData.append("exercicios", JSON.stringify(exercicios));

		fetcher.submit(formData, { method: "post" });
	}

	useEffect(() => {
		if (fetcher.state === "submitting") submittedRef.current = true;
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (fetcher.data?.success) {
				resetExercicios();
			}
		}
	}, [fetcher.state, fetcher.data, resetExercicios]);

	const busy = fetcher.state !== "idle";
	const isValid =
		ciclo &&
		treino &&
		grupo?.value &&
		exercicios.some((ex) => ex.exercicio.trim());

	return (
		<div className='container mx-auto space-y-6 py-6'>
			<h1 className='text-2xl font-bold text-orange-500'>Banco de Treinos</h1>

			<Card>
				<CardHeader>
					<CardTitle>Cadastrar treino</CardTitle>
				</CardHeader>
				<CardContent>
					<fetcher.Form onSubmit={handleSubmit} className='space-y-6'>
						<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
							<Field>
								<FieldLabel>Ciclo</FieldLabel>
								<Select
									value={ciclo}
									onValueChange={setCiclo}
									disabled={busy}
									required>
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
							</Field>

							<Field>
								<FieldLabel>Nome do treino</FieldLabel>
								<Select
									value={treino}
									onValueChange={setTreino}
									disabled={busy}
									required>
									<SelectTrigger className='w-full'>
										<SelectValue placeholder='Treino 1-6' />
									</SelectTrigger>
									<SelectContent>
										{TREINOS_OPCOES.map((t) => (
											<SelectItem key={t} value={t}>
												{t}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<div ref={anchorGrupoRef} className='space-y-2'>
								<Field>
									<FieldLabel>Grupo</FieldLabel>
									<Combobox
										value={grupo}
										onValueChange={setGrupo}
										items={GRUPO_ITEMS}>
										<ComboboxInput
											placeholder='Buscar grupo...'
											showClear
											disabled={busy}
										/>
										<ComboboxContent anchor={anchorGrupoRef}>
											<ComboboxList>
												{(item) => (
													<ComboboxItem key={item.value} value={item}>
														{item.label}
													</ComboboxItem>
												)}
											</ComboboxList>
											<ComboboxEmpty>Nenhum grupo encontrado</ComboboxEmpty>
										</ComboboxContent>
									</Combobox>
								</Field>
							</div>

						</div>

						<div className='space-y-4'>
							<div className='flex items-center justify-between'>
								<FieldLabel>Exercícios</FieldLabel>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={addExercicio}
									disabled={busy}>
									<Plus className='mr-1 size-4' />
									Adicionar exercício
								</Button>
							</div>
							<div className='space-y-4'>
								{exercicios.map((ex, i) => (
									<LinhaExercicio
										key={i}
										exercicio={ex}
										onChange={(e) => updateExercicio(i, e)}
										onRemove={() => removeExercicio(i)}
										disabled={busy}
									/>
								))}
							</div>
						</div>

						{fetcher.data?.error && (
							<p className='text-sm text-destructive'>{fetcher.data.error}</p>
						)}

						<div className='flex justify-end gap-2'>
							<Button
								type='button'
								variant='outline'
								onClick={resetForm}
								disabled={busy}>
								Limpar
							</Button>
							<Button type='submit' disabled={busy || !isValid}>
								{busy ? "Salvando..." : "Cadastrar treino"}
							</Button>
						</div>
					</fetcher.Form>
				</CardContent>
			</Card>

			{bancoTreinos.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Treinos cadastrados</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='mb-4 flex flex-wrap items-center gap-2'>
							<Select
								value={filtroCiclo}
								onValueChange={setFiltroCiclo}
							>
								<SelectTrigger className='w-[180px]'>
									<SelectValue placeholder='Filtrar por ciclo' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='todos'>Todos os ciclos</SelectItem>
									{CICLOS_OPCOES.map((c) => (
										<SelectItem key={c} value={c}>
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={filtroTreino}
								onValueChange={setFiltroTreino}
							>
								<SelectTrigger className='w-[180px]'>
									<SelectValue placeholder='Filtrar por treino' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='todos'>Todos os treinos</SelectItem>
									{TREINOS_OPCOES.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{filtroCiclo !== "todos" && filtroTreino !== "todos" && (
								<>
									<fetcherSemana.Form method='post'>
										<input type='hidden' name='intent' value='cadastrarSemana' />
										<input type='hidden' name='ciclo' value={filtroCiclo} />
										<input type='hidden' name='treino' value={filtroTreino} />
										<Button
											type='submit'
											variant='default'
											size='sm'
											disabled={fetcherSemana.state !== "idle"}
										>
											<CalendarPlus className='mr-1 size-4' />
											{fetcherSemana.state !== "idle"
												? "Cadastrando..."
												: "Cadastrar na semana atual"}
										</Button>
									</fetcherSemana.Form>
									<Button
										variant='outline'
										size='sm'
										asChild
									>
										<a
											href={`/treinos/pdf?ciclo=${encodeURIComponent(filtroCiclo)}&treino=${encodeURIComponent(filtroTreino)}`}
											target='_blank'
											rel='noopener noreferrer'
										>
											<FileDown className='mr-1 size-4' />
											Gerar PDF
										</a>
									</Button>
								</>
							)}
						</div>
						{(fetcherSemana.data?.error || fetcherSemana.data?.message) && (
							<p
								className={`mb-2 text-sm ${
									fetcherSemana.data.error
										? "text-destructive"
										: "text-muted-foreground"
								}`}
							>
								{fetcherSemana.data.error ?? fetcherSemana.data.message}
							</p>
						)}
						<DataTable
							columns={getColumnsTreinos(setEditingTreino)}
							data={filteredTreinos}
							getRowId={(row) => row.id}
							onRowClick={setEditingTreino}
							filterColumn=''
						/>
					</CardContent>
				</Card>
			)}

			{editingTreino && (
				<DialogEditarTreino
					treino={editingTreino}
					open={!!editingTreino}
					onClose={() => setEditingTreino(null)}
				/>
			)}
		</div>
	);
}
