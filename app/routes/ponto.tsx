import { useMemo, useState } from "react";
import {
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import {
	CheckCircle2Icon,
	FileDownIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type { Route } from "./+types/ponto";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { DataTable } from "~/components/desp-table";
import { columnsPonto } from "~/components/ponto/columns-ponto";
import { getPontos, importarRegistrosPontoTxt } from "~/models/ponto.server";

const MAX_TXT_SIZE_BYTES = 2 * 1024 * 1024;
const TODOS = "Todos";
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

type ActionData = {
	error?: string;
	success?: boolean;
	mensagem?: string;
};

function arquivoNaoEhTxt(file: File): boolean {
	const nomeEhTxt = file.name.toLowerCase().endsWith(".txt");
	const mimeEhTexto = file.type === "text/plain" || file.type === "";
	return !nomeEhTxt || !mimeEhTexto;
}

function formatarHorasMinutos(totalMs: number): string {
	if (totalMs <= 0) return "00:00";
	const totalMinutos = Math.floor(totalMs / (1000 * 60));
	const horas = Math.floor(totalMinutos / 60);
	const minutos = totalMinutos % 60;
	return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

export async function loader() {
	const pontos = await getPontos();
	return { pontos };
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const arquivo = formData.get("arquivoPonto");

	if (!(arquivo instanceof File) || arquivo.size === 0) {
		return {
			error: "Selecione um arquivo .txt antes de enviar.",
		} satisfies ActionData;
	}

	if (arquivoNaoEhTxt(arquivo)) {
		return {
			error: "Arquivo inválido. Envie apenas arquivos .txt.",
		} satisfies ActionData;
	}

	if (arquivo.size > MAX_TXT_SIZE_BYTES) {
		return {
			error: "Arquivo muito grande. Limite de 2MB.",
		} satisfies ActionData;
	}

	const conteudo = await arquivo.text();
	if (!conteudo.trim()) {
		return { error: "O arquivo está vazio." } satisfies ActionData;
	}

	try {
		const resultado = await importarRegistrosPontoTxt(conteudo);
		const mensagem = `Importação concluída: ${resultado.inseridos} registro(s) inserido(s), ${resultado.ignoradosDuplicados} duplicado(s) ignorado(s) e ${resultado.ignoradosSemPar} sem par ignorado(s).`;
		return {
			success: true,
			mensagem,
		} satisfies ActionData;
	} catch {
		return {
			error: "Erro ao processar o arquivo e gravar no banco.",
		} satisfies ActionData;
	}
}

export default function Ponto() {
	const { pontos } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const enviando = navigation.state === "submitting";
	const hoje = new Date();
	const [mesSelecionado, setMesSelecionado] = useState(
		String(hoje.getMonth() + 1),
	);
	const [anoSelecionado, setAnoSelecionado] = useState(
		String(hoje.getFullYear()),
	);
	const [filtroNome, setFiltroNome] = useState<string | null>();
	const anchorRef = useComboboxAnchor();

	const anosDisponiveis = useMemo(() => {
		const anos = new Set(
			pontos.map((ponto) => new Date(ponto.entrada).getFullYear()),
		);
		anos.add(hoje.getFullYear());
		return [...anos].sort((a, b) => b - a);
	}, [pontos, hoje]);

	const pontosMesAno = useMemo(() => {
		const mes = parseInt(mesSelecionado, 10);
		const ano = parseInt(anoSelecionado, 10);
		return pontos.filter((ponto) => {
			const entrada = new Date(ponto.entrada);
			return entrada.getMonth() + 1 === mes && entrada.getFullYear() === ano;
		});
	}, [pontos, mesSelecionado, anoSelecionado]);

	const nomes = useMemo(
		() => [TODOS, ...new Set(pontosMesAno.map((ponto) => ponto.nome)).values()],
		[pontosMesAno],
	);

	const pontosFiltrados = useMemo(() => {
		if (!filtroNome || filtroNome === TODOS) return pontosMesAno;
		return pontosMesAno.filter((ponto) => ponto.nome === filtroNome);
	}, [pontosMesAno, filtroNome]);
	const nomeSelecionado =
		filtroNome && filtroNome !== TODOS ? filtroNome : null;

	const totalHorasMesAtual = useMemo(() => {
		const hoje = new Date();
		const mesAtual = hoje.getMonth();
		const anoAtual = hoje.getFullYear();

		const totalMs = pontosFiltrados.reduce((acumulado, ponto) => {
			const entrada = new Date(ponto.entrada);
			if (
				entrada.getMonth() !== mesAtual ||
				entrada.getFullYear() !== anoAtual
			) {
				return acumulado;
			}

			const saida = new Date(ponto.saida);
			const diferenca = saida.getTime() - entrada.getTime();
			if (diferenca <= 0) return acumulado;
			return acumulado + diferenca;
		}, 0);

		return formatarHorasMinutos(totalMs);
	}, [pontosFiltrados]);

	return (
		<div className='space-y-6'>
			<Card className='max-w-lg'>
				<CardHeader className='pb-2 text-base font-medium text-orange-500'>
					<CardTitle>Importar ponto</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-3'>
					<form
						method='post'
						encType='multipart/form-data'
						className='flex flex-col gap-2 sm:flex-row sm:items-center'>
						<Input
							type='file'
							name='arquivoPonto'
							accept='.txt,text/plain'
							required
							className='sm:flex-1'
						/>
						<Button type='submit' size='sm' disabled={enviando}>
							{enviando ? "Enviando arquivo..." : "Enviar arquivo TXT"}
						</Button>
					</form>

					{actionData?.error && (
						<Alert variant='destructive'>
							<TriangleAlertIcon />
							<AlertTitle>Falha no upload</AlertTitle>
							<AlertDescription>{actionData.error}</AlertDescription>
						</Alert>
					)}

					{actionData?.success && (
						<Alert>
							<CheckCircle2Icon />
							<AlertTitle>Upload concluído</AlertTitle>
							<AlertDescription>
								{actionData.mensagem ?? "Arquivo recebido com sucesso."}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			<div className='space-y-3'>
				<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
					<div className='rounded-lg border bg-stone-50 px-4 py-2'>
						<p className='text-xs font-medium text-stone-500'>
							Total de horas no mês
						</p>
						<p className='text-lg font-semibold text-orange-600'>
							{totalHorasMesAtual}
						</p>
					</div>

					<div className='flex w-full max-w-2xl flex-col gap-2'>
						<div ref={anchorRef} className='w-full sm:max-w-sm sm:self-end'>
							<Combobox
								value={filtroNome}
								onValueChange={(value) => setFiltroNome(value)}
								items={nomes}>
								<ComboboxInput
									placeholder='Filtrar por funcionário'
									showClear
								/>
								<ComboboxContent anchor={anchorRef}>
									<ComboboxList>
										{(nome) => (
											<ComboboxItem key={nome} value={nome}>
												{nome}
											</ComboboxItem>
										)}
									</ComboboxList>
									<ComboboxEmpty>Nenhum funcionário encontrado</ComboboxEmpty>
								</ComboboxContent>
							</Combobox>
						</div>

						<div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end'>
							<Button asChild variant='outline' size='sm'>
								<Link
									to={`/ponto/espelho-todos-pdf?mes=${mesSelecionado}&ano=${anoSelecionado}`}
									target='_blank'
									rel='noreferrer'>
									<FileDownIcon data-icon='inline-start' />
									Todos
								</Link>
							</Button>

							{nomeSelecionado ? (
								<Button asChild variant='outline' size='sm'>
									<Link
										to={`/ponto/espelho-pdf?mes=${mesSelecionado}&ano=${anoSelecionado}&nome=${encodeURIComponent(nomeSelecionado)}`}
										target='_blank'
										rel='noreferrer'>
										<FileDownIcon data-icon='inline-start' />
										Espelho do funcionário
									</Link>
								</Button>
							) : (
								<Button variant='outline' size='sm' disabled>
									<FileDownIcon data-icon='inline-start' />
									Funcionário
								</Button>
							)}

							<Button asChild variant='outline' size='sm'>
								<Link
									to={`/ponto/pdf?mes=${mesSelecionado}&ano=${anoSelecionado}`}
									target='_blank'
									rel='noreferrer'>
									<FileDownIcon data-icon='inline-start' />
									cadastro
								</Link>
							</Button>

							<Select value={mesSelecionado} onValueChange={setMesSelecionado}>
								<SelectTrigger className='w-full sm:w-44'>
									<SelectValue placeholder='Mês' />
								</SelectTrigger>
								<SelectContent>
									{MESES.map((mes) => (
										<SelectItem key={mes.valor} value={String(mes.valor)}>
											{mes.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
								<SelectTrigger className='w-full sm:w-32'>
									<SelectValue placeholder='Ano' />
								</SelectTrigger>
								<SelectContent>
									{anosDisponiveis.map((ano) => (
										<SelectItem key={ano} value={String(ano)}>
											{ano}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				<DataTable
					columns={columnsPonto}
					data={pontosFiltrados}
					filterColumn=''
				/>
			</div>
		</div>
	);
}
