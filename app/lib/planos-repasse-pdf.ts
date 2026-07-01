import {
	calcularPrecoMensal,
	calcularRepasseProfessor,
	calcularResumoRepasse,
} from "~/lib/plano-preco-mensal";
import type { ClientePlanoEVO } from "~/models/evo.server";

export type SecaoRepasseProfessor = {
	professor: string;
	clientes: ClientePlanoEVO[];
	totalRepasse: number;
};

export function professorDefinido(nome: string | null | undefined): boolean {
	const valor = nome?.trim();
	return Boolean(valor && valor.toLowerCase() !== "sem professor");
}

function chaveAgrupamentoProfessor(nome: string | null | undefined): string {
	return professorDefinido(nome) ? nome!.trim() : "";
}

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

export function formatarMoedaPdf(valor: number): string {
	return formatadorMoeda.format(valor);
}

export function truncarTextoPdf(texto: string, maxCaracteres = 28): string {
	const valor = texto.trim();
	if (valor.length <= maxCaracteres) return valor;
	return `${valor.slice(0, maxCaracteres - 1).trimEnd()}…`;
}

export function agruparPorProfessor(
	clientes: ClientePlanoEVO[],
): SecaoRepasseProfessor[] {
	const mapa = new Map<string, ClientePlanoEVO[]>();

	for (const cliente of clientes) {
		const professor = chaveAgrupamentoProfessor(cliente.nomeProfessor);
		const lista = mapa.get(professor) ?? [];
		lista.push(cliente);
		mapa.set(professor, lista);
	}

	return [...mapa.entries()]
		.map(([professor, lista]) => ({
			professor,
			clientes: lista.sort((a, b) =>
				a.nomeCliente.localeCompare(b.nomeCliente, "pt-BR"),
			),
			totalRepasse: calcularResumoRepasse(lista).totalRepasse,
		}))
		.sort((a, b) => {
			if (!a.professor) return 1;
			if (!b.professor) return -1;
			return a.professor.localeCompare(b.professor, "pt-BR");
		});
}

export function calcularValoresLinha(cliente: ClientePlanoEVO) {
	return {
		mensalidade: calcularPrecoMensal(cliente.valor, cliente.nomePlano),
		repasse: calcularRepasseProfessor(cliente.valor, cliente.nomePlano),
	};
}

export function nomeMesReferencia(mes: number): string {
	const nomes = [
		"Janeiro",
		"Fevereiro",
		"Março",
		"Abril",
		"Maio",
		"Junho",
		"Julho",
		"Agosto",
		"Setembro",
		"Outubro",
		"Novembro",
		"Dezembro",
	];
	return nomes[mes - 1] ?? String(mes);
}

export function slugNomeArquivo(texto: string): string {
	return texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
}

export function montarTituloRepassePdf(
	planoLabel: string,
	professorFiltro: string,
	nomeProfessor?: string | null,
): string {
	if (professorFiltro !== "todos") {
		const professor = nomeProfessor?.trim() || "Professor";
		return `Repasse ${planoLabel} — ${professor}`;
	}
	return `Repasse ${planoLabel}`;
}

export function montarSubtituloRepassePdf(
	mes: number,
	ano: number,
	professorFiltro: string,
	nomeProfessor: string | null | undefined,
	totalAlunos: number,
): string {
	const mesLabel = nomeMesReferencia(mes);
	const sufixoAlunos = totalAlunos !== 1 ? "s" : "";
	const base = `Referência: ${mesLabel}/${ano} · ${totalAlunos} aluno${sufixoAlunos}`;

	if (professorFiltro !== "todos") {
		const professor = nomeProfessor?.trim() || "Professor";
		return `${base} · ${professor}`;
	}

	return base;
}

const ALTURA_PADDING_PAGINA = 56;
const ALTURA_TITULO_SUBTITULO = 58;
const ALTURA_CABECALHO_TABELA = 22;
const ALTURA_LINHA_ALUNO = 20;
const ALTURA_PROFESSOR = 24;
const ALTURA_SUBTOTAL = 20;
const ALTURA_MARGEM_SECAO = 16;
const ALTURA_RESUMO_FINAL = 88;
const ALTURA_RODAPE = 16;
const ALTURA_MINIMA_PAGINA = 200;

export function calcularAlturaPaginaRepasse(
	secoes: SecaoRepasseProfessor[],
	alunosSemMensalidade = 0,
): number {
	let altura = ALTURA_PADDING_PAGINA + ALTURA_TITULO_SUBTITULO;

	for (const secao of secoes) {
		if (professorDefinido(secao.professor)) {
			altura += ALTURA_PROFESSOR;
		}
		altura += ALTURA_CABECALHO_TABELA;
		altura += secao.clientes.length * ALTURA_LINHA_ALUNO;
		altura += ALTURA_SUBTOTAL + ALTURA_MARGEM_SECAO;
	}

	altura += ALTURA_RESUMO_FINAL + ALTURA_RODAPE;
	if (alunosSemMensalidade > 0) {
		altura += 14;
	}

	return Math.max(altura, ALTURA_MINIMA_PAGINA);
}

export function montarNomeArquivoRepassePdf(
	planoLabel: string,
	professorFiltro: string,
	nomeProfessor: string | null | undefined,
	mes: number,
	ano: number,
): string {
	const sufixoProfessor =
		professorFiltro !== "todos"
			? `_${slugNomeArquivo(nomeProfessor?.trim() || "professor")}`
			: "";

	return (
		`repasse_${slugNomeArquivo(planoLabel)}` +
		`${sufixoProfessor}_${String(mes).padStart(2, "0")}_${ano}.pdf`
	);
}
