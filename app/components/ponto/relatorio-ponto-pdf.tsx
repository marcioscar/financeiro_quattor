import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RelatorioPontoFuncionario } from "~/models/ponto.server";

const styles = StyleSheet.create({
	page: {
		padding: 28,
		fontSize: 10,
	},
	titulo: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 4,
	},
	subtitulo: {
		fontSize: 10,
		color: "#555",
		marginBottom: 14,
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
		paddingVertical: 6,
		paddingHorizontal: 8,
		justifyContent: "center",
	},
	colunaNome: { width: "50%" },
	colunaMatricula: { width: "20%" },
	colunaHoras: { width: "30%" },
});

function linhaTabela(funcionario: RelatorioPontoFuncionario, index: number) {
	return (
		<View key={`${funcionario.matricula}-${index}`} style={styles.linha}>
			<Text style={[styles.celula, styles.colunaNome]}>{funcionario.nome}</Text>
			<Text style={[styles.celula, styles.colunaMatricula]}>
				{funcionario.matricula}
			</Text>
			<Text style={[styles.celula, styles.colunaHoras]}>
				{funcionario.totalHoras}
			</Text>
		</View>
	);
}

export function RelatorioPontoPdf({
	mes,
	ano,
	funcionarios,
}: {
	mes: number;
	ano: number;
	funcionarios: RelatorioPontoFuncionario[];
}) {
	return (
		<Document>
			<Page size='A4' style={styles.page}>
				<Text style={styles.titulo}>Relatório Mensal de Ponto</Text>
				<Text style={styles.subtitulo}>
					Período: {String(mes).padStart(2, "0")}/{ano}
				</Text>

				<View style={styles.tabela}>
					<View style={[styles.linha, styles.header]}>
						<Text style={[styles.celula, styles.colunaNome]}>Nome</Text>
						<Text style={[styles.celula, styles.colunaMatricula]}>Matrícula</Text>
						<Text style={[styles.celula, styles.colunaHoras]}>Total horas</Text>
					</View>
					{funcionarios.map((funcionario, index) => linhaTabela(funcionario, index))}
				</View>
			</Page>
		</Document>
	);
}

export async function renderRelatorioPontoPdfToBuffer(
	mes: number,
	ano: number,
	funcionarios: RelatorioPontoFuncionario[],
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(
		<RelatorioPontoPdf mes={mes} ano={ano} funcionarios={funcionarios} />,
	);
}
