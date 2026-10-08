import {
	CalendarPlus,
	ChevronDown,
	FileDown,
	Pencil,
	Plus,
	VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { BancoTreinoRow } from "~/components/treinos/columns-treinos";
import { LAYOUTS_TREINO } from "~/components/treinos/layouts";
import { GRUPOS, TREINOS_OPCOES } from "~/constants/treinos";
import { isVideoPlaceholder, videoSrc } from "~/lib/treinos-sugestoes";
import { cn, toTitleCase } from "~/lib/utils";

/** valor do Select para os registros antigos que ficaram sem ciclo */
const SEM_CICLO = "__sem_ciclo__";

const treinoNorm = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "");
const numeroCiclo = (c: string | null | undefined) =>
	Number(/\d+/.exec(c ?? "")?.[0] ?? 0);

function CartaoGrupo({
	treino,
	videosExistentes,
	onEditar,
}: {
	treino: BancoTreinoRow;
	videosExistentes: Set<string>;
	onEditar: () => void;
}) {
	const exs = treino.exercicios ?? [];
	const temVideo = (v: string | null | undefined) =>
		!isVideoPlaceholder(v) && videosExistentes.has(String(v));
	const semVideo = exs.filter((e) => !temVideo(e.video)).length;

	return (
		<button
			type='button'
			onClick={onEditar}
			className='group flex flex-col rounded-lg border bg-card p-3 text-left transition hover:border-orange-300 hover:shadow-sm'>
			<div className='mb-2 flex items-start justify-between gap-2'>
				<div>
					<div className='text-sm font-semibold'>{treino.grupo}</div>
					<div className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
						{exs.length} exercício{exs.length !== 1 && "s"}
						{semVideo > 0 && (
							<span className='flex items-center gap-0.5 rounded bg-amber-100 px-1 text-amber-800'>
								<VideoOff className='size-3' />
								{semVideo} sem vídeo
							</span>
						)}
					</div>
				</div>
				<Pencil className='size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100' />
			</div>
			<ol className='space-y-1'>
				{exs.map((e, i) => (
					<li key={i} className='flex items-center gap-2 text-xs'>
						{temVideo(e.video) ? (
							<img
								src={videoSrc(String(e.video))}
								alt=''
								loading='lazy'
								className='size-6 shrink-0 rounded border bg-white object-cover'
							/>
						) : (
							<span className='flex size-6 shrink-0 items-center justify-center rounded border border-dashed border-amber-300 bg-amber-50'>
								<VideoOff className='size-3 text-amber-600' />
							</span>
						)}
						<span className='min-w-0 flex-1 truncate'>
							{toTitleCase(String(e.exercicio ?? "").trim()) || "—"}
						</span>
						<span className='max-w-[40%] shrink-0 truncate text-muted-foreground'>
							{e.repeticoes}
						</span>
					</li>
				))}
			</ol>
		</button>
	);
}

/**
 * Treinos já cadastrados, navegando por ciclo → treino. Cada grupo vira um
 * cartão com os exercícios; grupos que faltam aparecem como atalho para o
 * formulário de cadastro.
 */
export function TreinosCadastrados({
	bancoTreinos,
	videoItems,
	cicloInicial,
	selecao,
	onEditar,
	onCadastrarGrupo,
}: {
	bancoTreinos: BancoTreinoRow[];
	videoItems: Array<{ value: string }>;
	cicloInicial: string;
	/** ciclo/treino escolhidos no formulário: a lista acompanha */
	selecao: { ciclo: string; treino: string };
	onEditar: (t: BancoTreinoRow) => void;
	onCadastrarGrupo: (ciclo: string, treino: string, grupo: string) => void;
}) {
	const [ciclo, setCiclo] = useState(cicloInicial);
	const [treino, setTreino] = useState<string>(TREINOS_OPCOES[0]);
	const fetcherSemana = useFetcher<{ error?: string; message?: string }>();

	useEffect(() => {
		if (selecao.ciclo) setCiclo(selecao.ciclo);
		if (selecao.treino) setTreino(selecao.treino);
	}, [selecao.ciclo, selecao.treino]);

	const videosExistentes = useMemo(
		() => new Set(videoItems.map((v) => v.value)),
		[videoItems],
	);

	const ciclos = useMemo(() => {
		const nomes = [...new Set(bancoTreinos.map((b) => b.ciclo).filter(Boolean))] as string[];
		return nomes.sort((a, b) => numeroCiclo(b) - numeroCiclo(a));
	}, [bancoTreinos]);
	const temSemCiclo = bancoTreinos.some((b) => !b.ciclo);

	const doCiclo = useMemo(
		() =>
			bancoTreinos.filter((b) =>
				ciclo === SEM_CICLO ? !b.ciclo : b.ciclo === ciclo,
			),
		[bancoTreinos, ciclo],
	);

	const doTreino = useMemo(
		() =>
			doCiclo
				.filter((b) => treinoNorm(b.treino) === treinoNorm(treino))
				.sort(
					(a, b) =>
						GRUPOS.indexOf(a.grupo as (typeof GRUPOS)[number]) -
						GRUPOS.indexOf(b.grupo as (typeof GRUPOS)[number]),
				),
		[doCiclo, treino],
	);

	function trocarCiclo(c: string) {
		setCiclo(c);
		// se o treino atual não existe no ciclo escolhido, pula para o primeiro que tem
		const doNovo = bancoTreinos.filter((b) =>
			c === SEM_CICLO ? !b.ciclo : b.ciclo === c,
		);
		const temAtual = doNovo.some((b) => treinoNorm(b.treino) === treinoNorm(treino));
		if (!temAtual) {
			const primeiro = TREINOS_OPCOES.find((t) =>
				doNovo.some((b) => treinoNorm(b.treino) === treinoNorm(t)),
			);
			if (primeiro) setTreino(primeiro);
		}
	}

	const faltando = GRUPOS.filter((g) => !doTreino.some((b) => b.grupo === g));
	const cicloReal = ciclo !== SEM_CICLO;
	const qs = `ciclo=${encodeURIComponent(ciclo)}&treino=${encodeURIComponent(treino)}`;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Treinos cadastrados</CardTitle>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div className='flex flex-wrap items-center gap-2'>
					<Select value={ciclo} onValueChange={trocarCiclo}>
						<SelectTrigger className='w-[160px]'>
							<SelectValue placeholder='Ciclo' />
						</SelectTrigger>
						<SelectContent>
							{ciclos.map((c) => (
								<SelectItem key={c} value={c}>
									{c}
								</SelectItem>
							))}
							{temSemCiclo && <SelectItem value={SEM_CICLO}>Sem ciclo</SelectItem>}
						</SelectContent>
					</Select>

					<div className='flex flex-wrap gap-1'>
						{TREINOS_OPCOES.map((t) => {
							const n = doCiclo.filter(
								(b) => treinoNorm(b.treino) === treinoNorm(t),
							).length;
							return (
								<Button
									key={t}
									type='button'
									size='sm'
									variant={treino === t ? "default" : "ghost"}
									onClick={() => setTreino(t)}
									className={cn(
										treino === t && "bg-orange-500 hover:bg-orange-600",
										n === 0 && treino !== t && "text-muted-foreground/60",
									)}>
									{t}
									<span className='text-[10px] opacity-70'>{n}</span>
								</Button>
							);
						})}
					</div>

					{cicloReal && doTreino.length > 0 && (
						<div className='ml-auto flex gap-2'>
							<fetcherSemana.Form method='post'>
								<input type='hidden' name='intent' value='cadastrarSemana' />
								<input type='hidden' name='ciclo' value={ciclo} />
								<input type='hidden' name='treino' value={treino} />
								<Button
									type='submit'
									size='sm'
									disabled={fetcherSemana.state !== "idle"}>
									<CalendarPlus className='mr-1 size-4' />
									{fetcherSemana.state !== "idle"
										? "Cadastrando..."
										: "Cadastrar na semana atual"}
								</Button>
							</fetcherSemana.Form>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' size='sm'>
										<FileDown className='mr-1 size-4' />
										Gerar PDF
										<ChevronDown className='ml-1 size-4' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									{LAYOUTS_TREINO.map((l) => (
										<DropdownMenuItem key={l.id} asChild>
											<a
												href={`/treinos/pdf?${qs}&layout=${l.id}`}
												target='_blank'
												rel='noopener noreferrer'>
												{l.nome}
											</a>
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}
				</div>

				{(fetcherSemana.data?.error || fetcherSemana.data?.message) && (
					<p
						className={cn(
							"text-sm",
							fetcherSemana.data.error ? "text-destructive" : "text-green-700",
						)}>
						{fetcherSemana.data.error ?? fetcherSemana.data.message}
					</p>
				)}

				{doTreino.length === 0 ? (
					<p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
						Nenhum grupo cadastrado em {cicloReal ? ciclo : "Sem ciclo"} / {treino}.
					</p>
				) : (
					<div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
						{doTreino.map((t) => (
							<CartaoGrupo
								key={t.id}
								treino={t}
								videosExistentes={videosExistentes}
								onEditar={() => onEditar(t)}
							/>
						))}
					</div>
				)}

				{cicloReal && faltando.length > 0 && (
					<div className='flex flex-wrap items-center gap-1.5 text-xs'>
						<span className='text-muted-foreground'>Faltam:</span>
						{faltando.map((g) => (
							<Button
								key={g}
								type='button'
								variant='outline'
								size='sm'
								onClick={() => onCadastrarGrupo(ciclo, treino, g)}
								className='h-7 border-dashed text-xs'>
								<Plus className='size-3' />
								{g}
							</Button>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
