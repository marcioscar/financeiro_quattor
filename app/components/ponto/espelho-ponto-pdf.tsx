import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { EspelhoPontoFuncionario } from "~/models/ponto.server";

const styles = StyleSheet.create({
	page: { padding: 24, fontSize: 9 },
	titulo: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
	subtitulo: { fontSize: 10, marginBottom: 10, color: "#555" },
	resumo: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 12,
	},
	resumoItem: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderStyle: "solid",
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	tabela: { borderWidth: 1, borderColor: "#ddd", borderStyle: "solid" },
	linha: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		borderBottomStyle: "solid",
	},
	header: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
	celula: { paddingVertical: 4, paddingHorizontal: 6 },
	colunaData: { width: "23%" },
	colunaRegistros: { width: "52%" },
	colunaHoras: { width: "15%" },
	colunaStatus: { width: "10%" },
});

function linhaDia(
	dia: EspelhoPontoFuncionario["dias"][number],
	index: number,
) {
	return (
		<View key={`${dia.dataLabel}-${index}`} style={styles.linha}>
			<Text style={[styles.celula, styles.colunaData]}>{dia.dataLabel}</Text>
			<Text style={[styles.celula, styles.colunaRegistros]}>
				{dia.registros.length > 0 ? dia.registros.join(" | ") : "-"}
			</Text>
			<Text style={[styles.celula, styles.colunaHoras]}>{dia.totalDia}</Text>
			<Text style={[styles.celula, styles.colunaStatus]}>
				{dia.tevePonto ? "OK" : "-"}
			</Text>
		</View>
	);
}

export function EspelhoPontoPdf({
	espelho,
}: {
	espelho: EspelhoPontoFuncionario;
}) {
	return (
		<Document>
			<Page size='A4' style={styles.page}>
				<Text style={styles.titulo}>Espelho de Ponto</Text>
				<Text style={styles.subtitulo}>
					Funcionário: {espelho.nome} | Matrícula: {espelho.matricula} | Período:{" "}
					{String(espelho.mes).padStart(2, "0")}/{espelho.ano}
				</Text>

				<View style={styles.resumo}>
					<View style={styles.resumoItem}>
						<Text>Total de horas no mês: {espelho.totalMes}</Text>
					</View>
				</View>

				<View style={styles.tabela}>
					<View style={[styles.linha, styles.header]}>
						<Text style={[styles.celula, styles.colunaData]}>Dia</Text>
						<Text style={[styles.celula, styles.colunaRegistros]}>
							Registros (entrada - saída)
						</Text>
						<Text style={[styles.celula, styles.colunaHoras]}>Horas dia</Text>
						<Text style={[styles.celula, styles.colunaStatus]}>Ponto</Text>
					</View>
					{espelho.dias.map((dia, index) => linhaDia(dia, index))}
				</View>
			</Page>
		</Document>
	);
}

export function EspelhoPontoTodosPdf({
	espelhos,
}: {
	espelhos: EspelhoPontoFuncionario[];
}) {
	return (
		<Document>
			{espelhos.map((espelho) => (
				<Page
					key={`${espelho.matricula}-${espelho.mes}-${espelho.ano}`}
					size='A4'
					style={styles.page}>
					<Text style={styles.titulo}>Espelho de Ponto</Text>
					<Text style={styles.subtitulo}>
						Funcionário: {espelho.nome} | Matrícula: {espelho.matricula} |
						Período: {String(espelho.mes).padStart(2, "0")}/{espelho.ano}
					</Text>

					<View style={styles.resumo}>
						<View style={styles.resumoItem}>
							<Text>Total de horas no mês: {espelho.totalMes}</Text>
						</View>
					</View>

					<View style={styles.tabela}>
						<View style={[styles.linha, styles.header]}>
							<Text style={[styles.celula, styles.colunaData]}>Dia</Text>
							<Text style={[styles.celula, styles.colunaRegistros]}>
								Registros (entrada - saída)
							</Text>
							<Text style={[styles.celula, styles.colunaHoras]}>Horas dia</Text>
							<Text style={[styles.celula, styles.colunaStatus]}>Ponto</Text>
						</View>
						{espelho.dias.map((dia, index) => linhaDia(dia, index))}
					</View>
				</Page>
			))}
		</Document>
	);
}

export async function renderEspelhoPontoPdfToBuffer(
	espelho: EspelhoPontoFuncionario,
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(<EspelhoPontoPdf espelho={espelho} />);
}

export async function renderEspelhoPontoTodosPdfToBuffer(
	espelhos: EspelhoPontoFuncionario[],
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(<EspelhoPontoTodosPdf espelhos={espelhos} />);
}
