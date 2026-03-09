import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { getAlunosAtivos, getCancelamentosNoMes } from "~/models/evo.server";
import { getDespesasFixasDoMes } from "~/models/despesas.server";
import { getRecebimentosDoMesAtual } from "~/models/recebimentos.server";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Users,
	AlertCircle,
	Wallet,
	Ticket,
	UserMinus,
	TrendingUp,
} from "lucide-react";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Financeiro Quattor" },
		{ name: "description", content: "Financeiro Quattor" },
	];
}

export async function loader() {
	const hoje = new Date();
	const [alunosResult, recebimentosResult, cancelamentosResult, despesasFixas] =
		await Promise.all([
			getAlunosAtivos(hoje),
			getRecebimentosDoMesAtual(),
			getCancelamentosNoMes(hoje),
			getDespesasFixasDoMes(hoje),
		]);
	return {
		totalAlunosAtivos: alunosResult.alunos.length,
		erroAlunos: alunosResult.erro,
		recebimentosMes: recebimentosResult.valor,
		erroRecebimentos: recebimentosResult.erro,
		totalCancelamentos: cancelamentosResult.total,
		erroCancelamentos: cancelamentosResult.erro,
		despesasFixasMes: despesasFixas,
	};
}

export default function Home() {
	const {
		totalAlunosAtivos,
		erroAlunos,
		recebimentosMes,
		erroRecebimentos,
		totalCancelamentos,
		erroCancelamentos,
		despesasFixasMes,
	} = useLoaderData<typeof loader>();

	const ticketMedio =
		totalAlunosAtivos > 0 ? recebimentosMes / totalAlunosAtivos : 0;
	const pontoEquilibrio = ticketMedio > 0 ? despesasFixasMes / ticketMedio : 0;

	return (
		<div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
			<Card>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<Wallet className='h-5 w-5' />
						<CardTitle>Receita Recorrente Mensal</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{erroRecebimentos && (
						<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<p className='text-sm'>{erroRecebimentos}</p>
						</div>
					)}
					{!erroRecebimentos && (
						<div className='flex items-baseline gap-2'>
							<span className='text-4xl font-mono tabular-nums'>
								{new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(recebimentosMes)}
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<Users className='h-5 w-5' />
						<CardTitle>Alunos ativos </CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{erroAlunos && (
						<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<p className='text-sm'>{erroAlunos}</p>
						</div>
					)}
					{!erroAlunos && (
						<div className='flex justify-center items-baseline gap-2'>
							<span className='text-4xl font-mono tabular-nums'>
								{totalAlunosAtivos}
							</span>
						</div>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<UserMinus className='h-5 w-5' />
						<CardTitle>Taxa de Evasão (mês)</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{erroCancelamentos && (
						<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<p className='text-sm'>{erroCancelamentos}</p>
						</div>
					)}
					{!erroCancelamentos && (
						<div className='space-y-1'>
							<div className='flex items-baseline gap-2'>
								<span className='text-4xl font-mono tabular-nums'>
									{totalAlunosAtivos > 0
										? ((totalCancelamentos / totalAlunosAtivos) * 100).toFixed(
												2,
											) + "%"
										: "—"}
								</span>
							</div>
							<p className='text-sm text-muted-foreground'>
								{totalCancelamentos}{" "}
								{totalCancelamentos === 1 ? "cancelamento" : "cancelamentos"} no
								mês
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<TrendingUp className='h-5 w-5' />
						<CardTitle>Ponto de Equilíbrio</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{erroAlunos ? (
						<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<p className='text-sm'>{erroAlunos}</p>
						</div>
					) : ticketMedio > 0 ? (
						<div className='space-y-1'>
							<div className='flex items-baseline gap-2'>
								<span className='text-4xl font-mono tabular-nums'>
									{Math.ceil(pontoEquilibrio)}
								</span>
								<span className='text-muted-foreground'>alunos</span>
							</div>
						</div>
					) : (
						<span className='text-muted-foreground'>—</span>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<Ticket className='h-5 w-5' />
						<CardTitle>Ticket Médio</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{erroAlunos && (
						<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<p className='text-sm'>{erroAlunos}</p>
						</div>
					)}
					{!erroAlunos && totalAlunosAtivos > 0 && (
						<div className='flex items-baseline gap-2'>
							<span className='text-4xl font-mono tabular-nums'>
								{new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(recebimentosMes / totalAlunosAtivos)}
							</span>
						</div>
					)}
					{!erroAlunos && totalAlunosAtivos === 0 && (
						<span className='text-muted-foreground'>—</span>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
