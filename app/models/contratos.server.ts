import { db } from "~/db.server";
import {
	calcularPrecoMensal,
	calcularRepasseProfessor,
	calcularResumoRepasse,
} from "~/lib/plano-preco-mensal";
import { getFiltroPlanoPorId, type FiltroPlanoId } from "~/lib/planos-evo-filtros";
import type { ClientePlanoEVO, ProfessorEVO } from "~/models/evo.server";

type ItemContratoGravado = {
	id_cliente?: number | null;
	id_plano?: number | null;
	nome_cliente?: string | null;
	nome_plano?: string | null;
	valor_total?: number | null;
	mensalidade?: number | null;
	repasse?: number | null;
	data_inicio?: string | null;
	data_fim?: string | null;
	nome_professor?: string | null;
	id_professor?: number | null;
};

export type ContratoMesGravado = {
	mes: number;
	ano: number;
	planoFiltro: FiltroPlanoId;
	professorFiltro: string;
	totalAlunos: number;
	totalRepasse: number;
	gravadoEm: Date;
	clientes: ClientePlanoEVO[];
	/** Todos os clientes gravados no mês/ano/plano, sem filtro de professor — usado para montar a lista de professores do filtro. */
	clientesCompletos: ClientePlanoEVO[];
};

type ItemContratoInput = {
	id_cliente: number;
	id_plano: number;
	nome_cliente: string;
	nome_plano: string;
	valor_total: number;
	mensalidade: number | null;
	repasse: number | null;
	data_inicio: string | null;
	data_fim: string | null;
	nome_professor: string | null;
	id_professor: number | null;
};

export type SalvarContratosInput = {
	mes: number;
	ano: number;
	planoFiltro: FiltroPlanoId;
	professorFiltro: string;
	clientes: ClientePlanoEVO[];
};

function clienteParaItem(cliente: ClientePlanoEVO): ItemContratoInput {
	const mensalidade = calcularPrecoMensal(cliente.valor, cliente.nomePlano);
	const repasse = calcularRepasseProfessor(cliente.valor, cliente.nomePlano);

	return {
		id_cliente: cliente.idCliente,
		id_plano: cliente.idPlano,
		nome_cliente: cliente.nomeCliente,
		nome_plano: cliente.nomePlano,
		valor_total: cliente.valor,
		mensalidade,
		repasse,
		data_inicio: cliente.dataInicio,
		data_fim: cliente.dataFim,
		nome_professor: cliente.nomeProfessor,
		id_professor: cliente.idProfessor,
	};
}

function ordenarPorNome(clientes: ClientePlanoEVO[]): ClientePlanoEVO[] {
	return [...clientes].sort((a, b) =>
		a.nomeCliente.localeCompare(b.nomeCliente, "pt-BR"),
	);
}

function itemParaCliente(item: ItemContratoGravado): ClientePlanoEVO {
	return {
		idCliente: item.id_cliente ?? 0,
		nomeCliente: item.nome_cliente?.trim() ?? "",
		idPlano: item.id_plano ?? 0,
		nomePlano: item.nome_plano?.trim() ?? "",
		valor: item.valor_total ?? 0,
		dataInicio: item.data_inicio ?? null,
		dataFim: item.data_fim ?? null,
		documento: null,
		idProfessor: item.id_professor ?? null,
		nomeProfessor: item.nome_professor?.trim() || null,
		nomeConsultor: null,
	};
}

export function professoresDosClientes(
	clientes: ClientePlanoEVO[],
): ProfessorEVO[] {
	const mapa = new Map<number, string>();

	for (const cliente of clientes) {
		if (cliente.idProfessor == null || !cliente.nomeProfessor) continue;
		mapa.set(cliente.idProfessor, cliente.nomeProfessor);
	}

	return [...mapa.entries()]
		.map(([id, nome]) => ({ id, nome }))
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

async function buscarRegistroContratos(
	mes: number,
	ano: number,
	planoFiltro: FiltroPlanoId,
	professorFiltro: string,
): Promise<ContratoMesGravado | null> {
	const registro = await db.contratos.findUnique({
		where: {
			contrato_mes_plano_professor: {
				mes,
				ano,
				plano_filtro: planoFiltro,
				professor_filtro: professorFiltro,
			},
		},
	});

	if (!registro || registro.itens.length === 0) return null;

	const clientes = ordenarPorNome(registro.itens.map(itemParaCliente));

	return {
		mes: registro.mes,
		ano: registro.ano,
		planoFiltro,
		professorFiltro,
		totalAlunos: registro.total_alunos,
		totalRepasse: registro.total_repasse,
		gravadoEm: registro.gravado_em,
		clientes,
		clientesCompletos: clientes,
	};
}

/**
 * Junta todos os registros gravados (um por professor) de um mês/ano/plano
 * quando não existe um registro consolidado com professor_filtro "todos".
 * Cada registro salvo com um professor específico contém um subconjunto
 * disjunto de alunos, então basta concatenar os itens.
 */
async function buscarRegistroCombinadoPorProfessores(
	mes: number,
	ano: number,
	planoFiltro: FiltroPlanoId,
): Promise<ContratoMesGravado | null> {
	const registros = await db.contratos.findMany({
		where: { mes, ano, plano_filtro: planoFiltro },
	});
	if (registros.length === 0) return null;

	const clientes = ordenarPorNome(
		registros.flatMap((registro) => registro.itens.map(itemParaCliente)),
	);
	if (clientes.length === 0) return null;

	const resumo = calcularResumoRepasse(clientes);
	const gravadoEm = registros.reduce(
		(maisRecente, registro) =>
			registro.gravado_em > maisRecente ? registro.gravado_em : maisRecente,
		registros[0].gravado_em,
	);

	return {
		mes,
		ano,
		planoFiltro,
		professorFiltro: "todos",
		totalAlunos: resumo.totalAlunos,
		totalRepasse: resumo.totalRepasse,
		gravadoEm,
		clientes,
		clientesCompletos: clientes,
	};
}

/**
 * Busca contratos gravados no banco. Se não houver registro exato para o
 * professor filtrado, reaproveita os demais registros salvos do mesmo
 * mês/ano/plano (consolidado "todos" ou a soma dos registros por professor)
 * em vez de consultar a EVO novamente.
 */
export async function buscarContratosMes(
	mes: number,
	ano: number,
	planoFiltro: FiltroPlanoId,
	professorFiltro: string,
): Promise<ContratoMesGravado | null> {
	const registro = await buscarRegistroContratos(
		mes,
		ano,
		planoFiltro,
		professorFiltro,
	);
	if (registro) return registro;

	if (professorFiltro === "todos") {
		return buscarRegistroCombinadoPorProfessores(mes, ano, planoFiltro);
	}

	const idProfessor = Number.parseInt(professorFiltro, 10);
	if (!Number.isFinite(idProfessor)) return null;

	const registroTodos =
		(await buscarRegistroContratos(mes, ano, planoFiltro, "todos")) ??
		(await buscarRegistroCombinadoPorProfessores(mes, ano, planoFiltro));
	if (!registroTodos) return null;

	const clientesFiltrados = registroTodos.clientes.filter(
		(c) => c.idProfessor === idProfessor,
	);
	if (clientesFiltrados.length === 0) return null;

	const resumo = calcularResumoRepasse(clientesFiltrados);

	return {
		...registroTodos,
		professorFiltro,
		clientes: clientesFiltrados,
		totalAlunos: resumo.totalAlunos,
		totalRepasse: resumo.totalRepasse,
	};
}

function resolverNomeProfessorFiltro(
	professorFiltro: string,
	clientes: ClientePlanoEVO[],
): string | null {
	if (professorFiltro === "todos") return null;
	const id = Number.parseInt(professorFiltro, 10);
	if (!Number.isFinite(id)) return null;
	return clientes.find((c) => c.idProfessor === id)?.nomeProfessor ?? null;
}

export async function salvarContratosMes(
	input: SalvarContratosInput,
): Promise<{ totalAlunos: number; totalRepasse: number }> {
	const filtro = getFiltroPlanoPorId(input.planoFiltro);
	if (!filtro) {
		throw new Error("Tipo de plano inválido.");
	}

	if (input.clientes.length === 0) {
		throw new Error("Não há alunos para gravar com os filtros atuais.");
	}

	const itens = input.clientes.map(clienteParaItem);
	const resumo = calcularResumoRepasse(input.clientes);
	const nomeProfessor = resolverNomeProfessorFiltro(
		input.professorFiltro,
		input.clientes,
	);

	const dados = {
		mes: input.mes,
		ano: input.ano,
		plano_filtro: input.planoFiltro,
		plano_label: filtro.label,
		professor_filtro: input.professorFiltro,
		nome_professor: nomeProfessor,
		total_alunos: resumo.totalAlunos,
		total_repasse: resumo.totalRepasse,
		gravado_em: new Date(),
		itens,
	};

	await db.contratos.upsert({
		where: {
			contrato_mes_plano_professor: {
				mes: input.mes,
				ano: input.ano,
				plano_filtro: input.planoFiltro,
				professor_filtro: input.professorFiltro,
			},
		},
		create: dados,
		update: dados,
	});

	return {
		totalAlunos: resumo.totalAlunos,
		totalRepasse: resumo.totalRepasse,
	};
}
