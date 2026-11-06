import { ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Toggle } from "~/components/ui/toggle";
import {
	compararSalariosEntreMeses,
	mesCivilAnterior,
	type MesCivil,
} from "~/lib/folha-diferencas";
import { cn } from "~/lib/utils";

const MESES_NOME = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
];

/** Pares de meses consecutivos, os mesmos cobertos pelo comparativo mensal. */
const QUANTIDADE_DE_PARES = 3;

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const formatoPercentual = new Intl.NumberFormat("pt-BR", {
	maximumFractionDigits: 1,
	minimumFractionDigits: 1,
	signDisplay: "always",
});

function rotuloMes({ ano, mes }: MesCivil): string {
	return `${MESES_NOME[mes]}/${String(ano).slice(-2)}`;
}

function formatarDiferenca(valor: number): string {
	return `${valor > 0 ? "+" : "-"}${formatoMoeda.format(Math.abs(valor))}`;
}

type Props = {
	folhas: Parameters<typeof compararSalariosEntreMeses>[0];
};

export function CardDiferencasSalarios({ folhas }: Props) {
	const [parSelecionado, setParSelecionado] = useState(0);

	const pares = useMemo(
		() =>
			Array.from({ length: QUANTIDADE_DE_PARES }, (_, i) => ({
				atual: mesCivilAnterior(i),
				anterior: mesCivilAnterior(i + 1),
			})),
		[],
	);
	const { anterior, atual } = pares[parSelecionado];

	const { maiores, semPagamentoNoAnterior, semPagamentoNoAtual } = useMemo(
		() => compararSalariosEntreMeses(folhas, anterior, atual),
		[folhas, anterior, atual],
	);

	return (
		<Card>
			<CardHeader>
				<div className='flex items-center gap-2'>
					<ArrowLeftRight className='h-5 w-5 text-orange-500' />
					<CardTitle>Maiores diferenças de salário</CardTitle>
				</div>
				<CardDescription>
					Os 10 salários pagos que mais mudaram de um mês para o outro
				</CardDescription>
				<CardAction className='flex flex-wrap gap-1'>
					{pares.map((par, i) => (
						<Toggle
							key={rotuloMes(par.atual)}
							size='sm'
							variant='outline'
							pressed={i === parSelecionado}
							onPressedChange={() => setParSelecionado(i)}>
							{rotuloMes(par.anterior)} → {rotuloMes(par.atual)}
						</Toggle>
					))}
				</CardAction>
			</CardHeader>
			<CardContent className='space-y-3'>
				{maiores.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Funcionário</TableHead>
								<TableHead className='text-right'>
									{rotuloMes(anterior)}
								</TableHead>
								<TableHead className='text-right'>{rotuloMes(atual)}</TableHead>
								<TableHead className='text-right'>Diferença</TableHead>
								<TableHead className='text-right'>%</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{maiores.map((item) => {
								const cor =
									item.diferenca > 0 ? "text-orange-600" : "text-green-600";
								return (
									<TableRow key={item.id}>
										<TableCell>
											<div className='font-medium'>{item.nome}</div>
											<div className='text-xs text-muted-foreground'>
												{item.funcao}
											</div>
										</TableCell>
										<TableCell className='text-right'>
											{formatoMoeda.format(item.valorAnterior)}
										</TableCell>
										<TableCell className='text-right'>
											{formatoMoeda.format(item.valorAtual)}
										</TableCell>
										<TableCell className={cn("text-right font-medium", cor)}>
											{formatarDiferenca(item.diferenca)}
										</TableCell>
										<TableCell className={cn("text-right", cor)}>
											{formatoPercentual.format(item.percentual)}%
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<div className='flex h-[120px] items-center justify-center rounded-lg border border-dashed bg-muted/30'>
						<p className='text-sm text-muted-foreground'>
							Nenhuma diferença entre quem recebeu nos dois meses
						</p>
					</div>
				)}

				{semPagamentoNoAnterior.length > 0 && (
					<p className='text-xs text-muted-foreground'>
						Sem pagamento em {rotuloMes(anterior)}:{" "}
						{semPagamentoNoAnterior.join(", ")}
					</p>
				)}
				{semPagamentoNoAtual.length > 0 && (
					<p className='text-xs text-muted-foreground'>
						Sem pagamento em {rotuloMes(atual)}:{" "}
						{semPagamentoNoAtual.join(", ")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
