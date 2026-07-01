import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { calcularResumoRepasse } from "~/lib/plano-preco-mensal";
import {
	agruparClientesRepasse,
	calcularAlturaPaginaRepasse,
	calcularValoresLinha,
	formatarMoedaPdf,
	montarSubtituloRepassePdf,
	montarTituloRepassePdf,
	professorDefinido,
	truncarTextoPdf,
	type SecaoRepasseProfessor,
} from "~/lib/planos-repasse-pdf";
import type { ClientePlanoEVO } from "~/models/evo.server";

const LARGURA_PAGINA_A4 = 595;

const styles = StyleSheet.create({
	page: {
		padding: 28,
		fontSize: 9,
		fontFamily: "Helvetica",
	},
	titulo: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 4,
	},
	subtitulo: {
		fontSize: 10,
		color: "#555",
		marginBottom: 12,
	},
	secaoProfessor: {
		marginBottom: 16,
	},
	nomeProfessor: {
		fontSize: 11,
		fontWeight: "bold",
		marginBottom: 6,
		color: "#c2410c",
	},
	tabela: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderStyle: "solid",
	},
	linha: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		borderBottomStyle: "solid",
	},
	header: {
		backgroundColor: "#f5f5f5",
		fontWeight: "bold",
	},
	celula: {
		paddingVertical: 5,
		paddingHorizontal: 4,
	},
	colCliente: { width: "24%" },
	colPlano: { width: "22%" },
	colInicio: { width: "11%" },
	colFim: { width: "11%" },
	colMensal: { width: "14%" },
	colRepasse: { width: "14%" },
	subtotal: {
		marginTop: 6,
		fontSize: 10,
		fontWeight: "bold",
		textAlign: "right",
	},
	resumoFinal: {
		marginTop: 18,
		padding: 12,
		backgroundColor: "#fff7ed",
		borderWidth: 1,
		borderColor: "#fdba74",
	},
	resumoTitulo: {
		fontSize: 12,
		fontWeight: "bold",
		marginBottom: 4,
		color: "#c2410c",
	},
	resumoValor: {
		fontSize: 14,
		fontWeight: "bold",
	},
	rodape: {
		marginTop: 8,
		fontSize: 8,
		color: "#888",
	},
});

function CabecalhoTabela() {
	return (
		<View style={[styles.linha, styles.header]}>
			<Text style={[styles.celula, styles.colCliente]}>Aluno</Text>
			<Text style={[styles.celula, styles.colPlano]}>Plano</Text>
			<Text style={[styles.celula, styles.colInicio]}>Início</Text>
			<Text style={[styles.celula, styles.colFim]}>Vencimento</Text>
			<Text style={[styles.celula, styles.colMensal]}>Mensal</Text>
			<Text style={[styles.celula, styles.colRepasse]}>50%</Text>
		</View>
	);
}

function LinhaAluno(cliente: ClientePlanoEVO, index: number) {
	const { mensalidade, repasse } = calcularValoresLinha(cliente);

	return (
		<View
			key={`${cliente.idCliente}-${cliente.idPlano}-${index}`}
			style={styles.linha}
		>
			<Text style={[styles.celula, styles.colCliente]} wrap={false}>
				{truncarTextoPdf(cliente.nomeCliente)}
			</Text>
			<Text style={[styles.celula, styles.colPlano]} wrap={false}>
				{truncarTextoPdf(cliente.nomePlano, 24)}
			</Text>
			<Text style={[styles.celula, styles.colInicio]}>
				{cliente.dataInicio ?? "—"}
			</Text>
			<Text style={[styles.celula, styles.colFim]}>{cliente.dataFim ?? "—"}</Text>
			<Text style={[styles.celula, styles.colMensal]}>
				{mensalidade == null ? "—" : formatarMoedaPdf(mensalidade)}
			</Text>
			<Text style={[styles.celula, styles.colRepasse]}>
				{repasse == null ? "—" : formatarMoedaPdf(repasse)}
			</Text>
		</View>
	);
}

function SecaoProfessor({ secao }: { secao: SecaoRepasseProfessor }) {
	const exibirProfessor = professorDefinido(secao.professor);
	const labelSubtotal = exibirProfessor
		? `Subtotal ${secao.professor}:`
		: "Subtotal:";

	return (
		<View style={styles.secaoProfessor}>
			{exibirProfessor && (
				<Text style={styles.nomeProfessor}>Professor: {secao.professor}</Text>
			)}
			<View style={styles.tabela}>
				<CabecalhoTabela />
				{secao.clientes.map((cliente, index) =>
					LinhaAluno(cliente, index),
				)}
			</View>
			<Text style={styles.subtotal}>
				{labelSubtotal} {formatarMoedaPdf(secao.totalRepasse)}
			</Text>
		</View>
	);
}

export function RepasseProfessorPdf({
	mes,
	ano,
	planoLabel,
	professorFiltro,
	clientes,
	dividirPorProfessor,
}: {
	mes: number;
	ano: number;
	planoLabel: string;
	professorFiltro: string;
	clientes: ClientePlanoEVO[];
	dividirPorProfessor: boolean;
}) {
	const secoes = agruparClientesRepasse(clientes, dividirPorProfessor);
	const resumo = calcularResumoRepasse(clientes);
	const nomeProfessor = secoes[0]?.professor;
	const titulo = montarTituloRepassePdf(
		planoLabel,
		professorFiltro,
		nomeProfessor,
	);
	const subtitulo = montarSubtituloRepassePdf(
		mes,
		ano,
		professorFiltro,
		nomeProfessor,
		clientes.length,
	);
	const alturaPagina = calcularAlturaPaginaRepasse(secoes, resumo.alunosSemMensalidade);

	return (
		<Document>
			<Page
				size={[LARGURA_PAGINA_A4, alturaPagina]}
				style={styles.page}
				wrap={false}
			>
				<Text style={styles.titulo}>{titulo}</Text>
				<Text style={styles.subtitulo}>{subtitulo}</Text>

				{secoes.map((secao) => (
					<SecaoProfessor
						key={secao.professor || "sem-professor"}
						secao={secao}
					/>
				))}

				<View style={styles.resumoFinal}>
					<Text style={styles.resumoTitulo}>
						Total a pagar aos professores (50%)
					</Text>
					<Text style={styles.resumoValor}>
						{formatarMoedaPdf(resumo.totalRepasse)}
					</Text>
					{resumo.alunosSemMensalidade > 0 && (
						<Text style={styles.rodape}>
							{resumo.alunosSemMensalidade} aluno(s) sem mensalidade calculável
							não incluídos no total.
						</Text>
					)}
				</View>

				<Text style={styles.rodape}>
					Quattor Academia · Gerado em{" "}
					{new Date().toLocaleString("pt-BR")}
				</Text>
			</Page>
		</Document>
	);
}

export async function renderRepasseProfessorPdfToBuffer(
	mes: number,
	ano: number,
	planoLabel: string,
	professorFiltro: string,
	clientes: ClientePlanoEVO[],
	dividirPorProfessor: boolean,
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(
		<RepasseProfessorPdf
			mes={mes}
			ano={ano}
			planoLabel={planoLabel}
			professorFiltro={professorFiltro}
			clientes={clientes}
			dividirPorProfessor={dividirPorProfessor}
		/>,
	);
}
