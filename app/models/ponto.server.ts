import { db } from "~/db.server";

type EventoPonto = {
	nome: string;
	matricula: number;
	dataHora: Date;
};

type RegistroPontoNovo = {
	nome: string;
	matricula: number;
	entrada: Date;
	saida: Date;
};

type ImportacaoPontoResultado = {
	inseridos: number;
	ignoradosSemPar: number;
	ignoradosDuplicados: number;
};

export type PontoRegistro = {
	id: string;
	nome: string;
	matricula: number;
	entrada: Date;
	saida: Date;
};

export type RelatorioPontoFuncionario = {
	nome: string;
	matricula: number;
	totalHoras: string;
	diasTrabalhados: number;
	diasUteisNoPeriodo: number;
	diasFalta: number;
	faltouAlgumDia: boolean;
};

export type EspelhoPontoDia = {
	dataLabel: string;
	registros: string[];
	totalDia: string;
	tevePonto: boolean;
};

export type EspelhoPontoFuncionario = {
	nome: string;
	matricula: number;
	mes: number;
	ano: number;
	totalMes: string;
	dias: EspelhoPontoDia[];
};

type FuncionarioRegistrado = {
	nome: string;
	matricula: number;
};

function parseDataHora(valor: string): Date | null {
	const normalizado = valor.replace(/\s+/g, " ").trim();
	const [dataParte, horaParte] = normalizado.split(" ");
	if (!dataParte || !horaParte) return null;

	const [ano, mes, dia] = dataParte.split("/").map(Number);
	const [hora, minuto, segundo] = horaParte.split(":").map(Number);

	if (
		[ano, mes, dia, hora, minuto, segundo].some((item) => Number.isNaN(item))
	) {
		return null;
	}

	return new Date(ano, mes - 1, dia, hora, minuto, segundo);
}

function chaveDia(matricula: number, data: Date): string {
	const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
		data.getDate(),
	).padStart(2, "0")}`;
	return `${matricula}|${dia}`;
}

function parseEventosDoArquivo(conteudo: string): EventoPonto[] {
	const linhas = conteudo
		.split(/\r?\n/)
		.map((linha) => linha.trim())
		.filter(Boolean);

	if (linhas.length <= 1) return [];

	const eventos: EventoPonto[] = [];
	for (const linha of linhas.slice(1)) {
		const colunas = linha.split("\t").filter((coluna) => coluna.trim().length > 0);
		if (colunas.length < 7) continue;

		const matricula = parseInt(colunas[2] ?? "", 10);
		if (Number.isNaN(matricula)) continue;

		const nome = (colunas[3] ?? "").trim();
		if (!nome) continue;

		const dataHora = parseDataHora(colunas[6] ?? "");
		if (!dataHora) continue;

		eventos.push({ nome, matricula, dataHora });
	}

	return eventos;
}

function montarRegistros(eventos: EventoPonto[]): {
	registros: RegistroPontoNovo[];
	ignoradosSemPar: number;
} {
	const eventosPorDia = new Map<string, EventoPonto[]>();

	for (const evento of eventos) {
		const chave = chaveDia(evento.matricula, evento.dataHora);
		const lista = eventosPorDia.get(chave) ?? [];
		lista.push(evento);
		eventosPorDia.set(chave, lista);
	}

	const registros: RegistroPontoNovo[] = [];
	let ignoradosSemPar = 0;

	for (const [chave, batidas] of eventosPorDia.entries()) {
		const [matriculaTexto] = chave.split("|");
		const matricula = parseInt(matriculaTexto, 10);
		if (Number.isNaN(matricula)) continue;

		const ordenadas = [...batidas].sort(
			(a, b) => a.dataHora.getTime() - b.dataHora.getTime(),
		);
		const nome = ordenadas[0]?.nome ?? "";
		if (!nome) continue;

		for (let i = 0; i < ordenadas.length; i += 2) {
			const entrada = ordenadas[i]?.dataHora;
			const saida = ordenadas[i + 1]?.dataHora;

			if (!entrada || !saida) {
				ignoradosSemPar += 1;
				continue;
			}

			registros.push({
				nome,
				matricula,
				entrada,
				saida,
			});
		}
	}

	return { registros, ignoradosSemPar };
}

function chaveRegistro(registro: RegistroPontoNovo): string {
	return [
		registro.matricula,
		registro.entrada.getTime(),
		registro.saida.getTime(),
	].join("|");
}

export async function importarRegistrosPontoTxt(
	conteudo: string,
): Promise<ImportacaoPontoResultado> {
	const eventos = parseEventosDoArquivo(conteudo);
	const { registros, ignoradosSemPar } = montarRegistros(eventos);

	if (registros.length === 0) {
		return { inseridos: 0, ignoradosSemPar, ignoradosDuplicados: 0 };
	}

	const matriculas = [...new Set(registros.map((registro) => registro.matricula))];
	const menorEntrada = new Date(
		Math.min(...registros.map((registro) => registro.entrada.getTime())),
	);
	const maiorEntrada = new Date(
		Math.max(...registros.map((registro) => registro.entrada.getTime())),
	);

	const existentes = await db.ponto.findMany({
		where: {
			matricula: { in: matriculas },
			entrada: { gte: menorEntrada, lte: maiorEntrada },
		},
		select: {
			matricula: true,
			entrada: true,
			saida: true,
		},
	});

	const chavesExistentes = new Set(
		existentes.map((registro) =>
			[
				registro.matricula,
				registro.entrada.getTime(),
				registro.saida.getTime(),
			].join("|"),
		),
	);

	const novos = registros.filter((registro) => !chavesExistentes.has(chaveRegistro(registro)));
	const ignoradosDuplicados = registros.length - novos.length;

	if (novos.length > 0) {
		await db.ponto.createMany({
			data: novos,
		});
	}

	return {
		inseridos: novos.length,
		ignoradosSemPar,
		ignoradosDuplicados,
	};
}

export async function getPontos(): Promise<PontoRegistro[]> {
	return db.ponto.findMany({
		orderBy: [{ entrada: "desc" }, { nome: "asc" }],
	});
}

function inicioDoMes(ano: number, mes: number): Date {
	return new Date(ano, mes - 1, 1, 0, 0, 0, 0);
}

function fimDoMes(ano: number, mes: number): Date {
	return new Date(ano, mes, 0, 23, 59, 59, 999);
}

function ehDiaUtil(data: Date): boolean {
	const diaSemana = data.getDay();
	return diaSemana >= 1 && diaSemana <= 5;
}

function chaveDiaRelatorio(data: Date): string {
	return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
		data.getDate(),
	).padStart(2, "0")}`;
}

function obterDiasUteisDoPeriodo(ano: number, mes: number): string[] {
	const hoje = new Date();
	const ultimoDiaDoMes = fimDoMes(ano, mes);
	const fimPeriodo =
		hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes
			? new Date(
					hoje.getFullYear(),
					hoje.getMonth(),
					hoje.getDate(),
					23,
					59,
					59,
					999,
				)
			: ultimoDiaDoMes;

	const diasUteis: string[] = [];
	const cursor = inicioDoMes(ano, mes);

	while (cursor <= fimPeriodo) {
		if (ehDiaUtil(cursor)) {
			diasUteis.push(chaveDiaRelatorio(cursor));
		}
		cursor.setDate(cursor.getDate() + 1);
	}

	return diasUteis;
}

function formatarTotalHoras(totalMinutos: number): string {
	const horas = Math.floor(totalMinutos / 60);
	const minutos = totalMinutos % 60;
	return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function formatarHora(data: Date): string {
	return new Date(data).toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function formatarDataLabel(data: Date): string {
	return new Date(data).toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function montarEspelhoDia(data: Date, pontosDoDia: PontoRegistro[]): {
	dia: EspelhoPontoDia;
	minutosDoDia: number;
} {
	const ordenados = [...pontosDoDia].sort(
		(a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime(),
	);

	let minutosDoDia = 0;
	const registros = ordenados.map((registro) => {
		const entrada = new Date(registro.entrada);
		const saida = new Date(registro.saida);
		const diferenca = Math.floor((saida.getTime() - entrada.getTime()) / (1000 * 60));
		if (diferenca > 0) minutosDoDia += diferenca;
		return `${formatarHora(entrada)} - ${formatarHora(saida)}`;
	});

	return {
		dia: {
			dataLabel: formatarDataLabel(data),
			registros,
			totalDia: formatarTotalHoras(minutosDoDia),
			tevePonto: registros.length > 0,
		},
		minutosDoDia,
	};
}

function construirEspelhoFuncionario(
	funcionario: FuncionarioRegistrado,
	pontosMes: PontoRegistro[],
	mes: number,
	ano: number,
): EspelhoPontoFuncionario {
	const pontosPorDia = new Map<string, PontoRegistro[]>();
	for (const ponto of pontosMes) {
		const dataChave = chaveDiaRelatorio(new Date(ponto.entrada));
		const lista = pontosPorDia.get(dataChave) ?? [];
		lista.push(ponto);
		pontosPorDia.set(dataChave, lista);
	}

	const diasNoMes = new Date(ano, mes, 0).getDate();
	const dias: EspelhoPontoDia[] = [];
	let totalMinutosMes = 0;

	for (let dia = 1; dia <= diasNoMes; dia++) {
		const data = new Date(ano, mes - 1, dia);
		const chave = chaveDiaRelatorio(data);
		const pontosDoDia = pontosPorDia.get(chave) ?? [];
		const { dia: espelhoDia, minutosDoDia } = montarEspelhoDia(data, pontosDoDia);
		totalMinutosMes += minutosDoDia;
		dias.push(espelhoDia);
	}

	return {
		nome: funcionario.nome,
		matricula: funcionario.matricula,
		mes,
		ano,
		totalMes: formatarTotalHoras(totalMinutosMes),
		dias,
	};
}

async function getFuncionariosRegistrados(): Promise<FuncionarioRegistrado[]> {
	const registros = await db.ponto.findMany({
		select: {
			nome: true,
			matricula: true,
			entrada: true,
		},
		orderBy: [{ entrada: "desc" }],
	});

	const porMatricula = new Map<number, FuncionarioRegistrado>();
	for (const registro of registros) {
		if (!porMatricula.has(registro.matricula)) {
			porMatricula.set(registro.matricula, {
				nome: registro.nome,
				matricula: registro.matricula,
			});
		}
	}

	return Array.from(porMatricula.values()).sort((a, b) =>
		a.nome.localeCompare(b.nome, "pt-BR"),
	);
}

export async function getRelatorioPontoMensal(
	mes: number,
	ano: number,
): Promise<RelatorioPontoFuncionario[]> {
	const pontos = await db.ponto.findMany({
		where: {
			entrada: {
				gte: inicioDoMes(ano, mes),
				lte: fimDoMes(ano, mes),
			},
		},
		orderBy: [{ nome: "asc" }, { entrada: "asc" }],
	});

	const diasUteis = obterDiasUteisDoPeriodo(ano, mes);

	const porFuncionario = new Map<
		number,
		{
			nome: string;
			matricula: number;
			totalMinutos: number;
			diasTrabalhados: Set<string>;
		}
	>();

	for (const ponto of pontos) {
		const item = porFuncionario.get(ponto.matricula) ?? {
			nome: ponto.nome,
			matricula: ponto.matricula,
			totalMinutos: 0,
			diasTrabalhados: new Set<string>(),
		};

		const diferencaMinutos = Math.floor(
			(new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime()) /
				(1000 * 60),
		);
		if (diferencaMinutos > 0) {
			item.totalMinutos += diferencaMinutos;
		}

		item.diasTrabalhados.add(chaveDiaRelatorio(new Date(ponto.entrada)));
		item.nome = ponto.nome;

		porFuncionario.set(ponto.matricula, item);
	}

	return Array.from(porFuncionario.values())
		.map((funcionario) => {
			const diasTrabalhados = funcionario.diasTrabalhados.size;
			const diasFalta = Math.max(0, diasUteis.length - diasTrabalhados);
			return {
				nome: funcionario.nome,
				matricula: funcionario.matricula,
				totalHoras: formatarTotalHoras(funcionario.totalMinutos),
				diasTrabalhados,
				diasUteisNoPeriodo: diasUteis.length,
				diasFalta,
				faltouAlgumDia: diasFalta > 0,
			};
		})
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function getEspelhoPontoFuncionarioMes(params: {
	nome: string;
	mes: number;
	ano: number;
}): Promise<EspelhoPontoFuncionario | null> {
	const { nome, mes, ano } = params;
	const inicio = inicioDoMes(ano, mes);
	const fim = fimDoMes(ano, mes);

	const funcionarioBase =
		(await db.ponto.findFirst({
			where: { nome },
			orderBy: [{ entrada: "desc" }],
			select: {
				nome: true,
				matricula: true,
			},
		}));

	if (!funcionarioBase) return null;

	const pontosMes = await db.ponto.findMany({
		where: {
			matricula: funcionarioBase.matricula,
			entrada: { gte: inicio, lte: fim },
		},
		orderBy: [{ entrada: "asc" }],
	});

	return construirEspelhoFuncionario(funcionarioBase, pontosMes, mes, ano);
}

export async function getEspelhoPontoTodosFuncionariosMes(params: {
	mes: number;
	ano: number;
}): Promise<EspelhoPontoFuncionario[]> {
	const { mes, ano } = params;
	const inicio = inicioDoMes(ano, mes);
	const fim = fimDoMes(ano, mes);

	const [funcionarios, pontosMes] = await Promise.all([
		getFuncionariosRegistrados(),
		db.ponto.findMany({
			where: {
				entrada: { gte: inicio, lte: fim },
			},
			orderBy: [{ entrada: "asc" }],
		}),
	]);

	const pontosPorMatricula = new Map<number, PontoRegistro[]>();
	for (const ponto of pontosMes) {
		const lista = pontosPorMatricula.get(ponto.matricula) ?? [];
		lista.push(ponto);
		pontosPorMatricula.set(ponto.matricula, lista);
	}

	return funcionarios.map((funcionario) =>
		construirEspelhoFuncionario(
			funcionario,
			pontosPorMatricula.get(funcionario.matricula) ?? [],
			mes,
			ano,
		),
	);
}
