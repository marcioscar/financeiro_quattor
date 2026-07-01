import type { ClientePlanoRow } from "~/components/planos/columns-planos";
import type { ClientePlanoEVO, ProfessorEVO } from "~/models/evo.server";

export function clienteParaLinha(
	cliente: ClientePlanoEVO,
	id?: string,
): ClientePlanoRow {
	return {
		...cliente,
		id: id ?? `${cliente.idCliente}-${cliente.idPlano}`,
	};
}

export function clientesParaLinhas(clientes: ClientePlanoEVO[]): ClientePlanoRow[] {
	return clientes.map((cliente) => clienteParaLinha(cliente));
}

export function criarLinhaManual(nomePlanoPadrao = ""): ClientePlanoRow {
	const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id: `manual-${sufixo}`,
		idCliente: 0,
		nomeCliente: "",
		idPlano: 0,
		nomePlano: nomePlanoPadrao,
		valor: 0,
		dataInicio: null,
		dataFim: null,
		documento: null,
		idProfessor: null,
		nomeProfessor: null,
		nomeConsultor: null,
	};
}

export function linhaParaCliente(linha: ClientePlanoRow): ClientePlanoEVO {
	const { id: _id, ...cliente } = linha;
	return cliente;
}

export function resolverProfessorPorNome(
	nome: string,
	professores: ProfessorEVO[],
): Pick<ClientePlanoEVO, "idProfessor" | "nomeProfessor"> {
	const normalizado = nome.trim();
	if (!normalizado) {
		return { idProfessor: null, nomeProfessor: null };
	}

	const encontrado = professores.find(
		(prof) => prof.nome.trim().toLowerCase() === normalizado.toLowerCase(),
	);

	if (encontrado) {
		return {
			idProfessor: encontrado.id,
			nomeProfessor: encontrado.nome,
		};
	}

	return { idProfessor: null, nomeProfessor: normalizado };
}

type ClienteGravacaoRaw = {
	idCliente?: number;
	nomeCliente?: string;
	idPlano?: number;
	nomePlano?: string;
	valor?: number;
	dataInicio?: string | null;
	dataFim?: string | null;
	documento?: string | null;
	idProfessor?: number | null;
	nomeProfessor?: string | null;
	nomeConsultor?: string | null;
};

export function parseClientesGravacao(
	json: string,
): { clientes: ClientePlanoEVO[] } | { error: string } {
	try {
		const parsed = JSON.parse(json) as ClienteGravacaoRaw[];
		if (!Array.isArray(parsed)) {
			return { error: "Formato de dados inválido." };
		}

		const clientes: ClientePlanoEVO[] = [];

		for (let i = 0; i < parsed.length; i++) {
			const item = parsed[i];
			const nomeCliente = item.nomeCliente?.trim() ?? "";
			const nomePlano = item.nomePlano?.trim() ?? "";
			const valor = Number(item.valor);

			if (!nomeCliente) {
				return { error: `Linha ${i + 1}: informe o nome do cliente.` };
			}
			if (!nomePlano) {
				return { error: `Linha ${i + 1}: informe o nome do plano.` };
			}
			if (!Number.isFinite(valor) || valor < 0) {
				return { error: `Linha ${i + 1}: valor inválido.` };
			}

			clientes.push({
				idCliente: Number(item.idCliente) || 0,
				nomeCliente,
				idPlano: Number(item.idPlano) || 0,
				nomePlano,
				valor,
				dataInicio: item.dataInicio ?? null,
				dataFim: item.dataFim ?? null,
				documento: item.documento ?? null,
				idProfessor:
					item.idProfessor == null ? null : Number(item.idProfessor) || null,
				nomeProfessor: item.nomeProfessor?.trim() || null,
				nomeConsultor: item.nomeConsultor ?? null,
			});
		}

		return { clientes };
	} catch {
		return { error: "Não foi possível ler os dados editados." };
	}
}
