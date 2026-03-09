import {
	Document,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import { toTitleCase } from "~/lib/utils";

type ImageSource = string;

const styles = StyleSheet.create({
	page: {
		padding: 40,
	},
	logoContainer: {
		position: "absolute",
		top: 40,
		right: 40,
		alignItems: "flex-end",
	},
	logoImg: {
		height: 36,
		width: 170,
	},
	conteudo: {
		marginTop: 60,
	},
	grupo: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 8,
		textTransform: "uppercase",
	},
	linhaSeparadora: {
		width: "100%",
		height: 1,
		backgroundColor: "#ddd",
		marginBottom: 8,
	},
	exercicioLinha: {
		flexDirection: "row",
		marginBottom: 4,
	},
	exercicioNumero: {
		fontSize: 12,
		width: 30,
	},
	exercicioNome: {
		fontSize: 20,
		fontWeight: "bold",
		flex: 1,
	},
	repeticoesLinha: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 4,
		marginLeft: 40,
		gap: 6,
	},
	repeticoesIcon: {
		width: 14,
		height: 14,
	},
	repeticoes: {
		fontSize: 20,
		color: "#000",
	},
	blocoExercicio: {
		marginBottom: 16,
	},
	blocoExercicioLinha: {
		width: "100%",
		height: 1,
		backgroundColor: "#eee",
		marginBottom: 12,
	},
	footer: {
		position: "absolute",
		bottom: 30,
		left: 40,
		right: 40,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-start",
		gap: 12,
	},
	footerBolas: {
		height: 28,
		width: 50,
	},
	footerTexto: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#000",
	},
});

function LogoQuattor({ logoSrc }: { logoSrc: ImageSource }) {
	return (
		<View fixed style={styles.logoContainer}>
			<Image src={logoSrc} style={styles.logoImg} />
		</View>
	);
}

type ExercicioItem = {
	exercicio?: string | null;
	repeticoes?: string | null;
};

type GrupoData = {
	grupo: string | null;
	exercicios: ExercicioItem[];
};

function FolhaGrupo({
	grupo,
	exercicios,
	cicloLabel,
	treinoDisplay,
	logoSrc,
	bolasSrc,
	rotateCcwSrc,
}: {
	grupo: string;
	exercicios: ExercicioItem[];
	cicloLabel: string;
	treinoDisplay: string;
	logoSrc: ImageSource;
	bolasSrc: ImageSource;
	rotateCcwSrc: ImageSource;
}) {
	return (
		<Page size='A4' style={styles.page}>
			<LogoQuattor logoSrc={logoSrc} />
			<View style={styles.conteudo}>
				<Text style={styles.grupo}>{grupo}</Text>
				<View style={styles.linhaSeparadora} />
				{exercicios.map((ex, i) => (
					<View key={i}>
						<View style={styles.blocoExercicio}>
							<View style={styles.exercicioLinha}>
								<Text style={styles.exercicioNumero}>{i + 1} -</Text>
								<Text style={styles.exercicioNome}>
									{toTitleCase(String(ex.exercicio ?? "").trim()) || "—"}
								</Text>
							</View>
							<View style={styles.repeticoesLinha}>
								<Image src={rotateCcwSrc} style={styles.repeticoesIcon} />
								<Text style={styles.repeticoes}>
									{String(ex.repeticoes ?? "").trim() || "—"}
								</Text>
							</View>
						</View>
						{i < exercicios.length - 1 && (
							<View style={styles.blocoExercicioLinha} />
						)}
					</View>
				))}
			</View>
			<View fixed style={styles.footer}>
				<Image src={bolasSrc} style={styles.footerBolas} />
				<Text style={styles.footerTexto}>
					{cicloLabel} - {treinoDisplay}
				</Text>
			</View>
		</Page>
	);
}

export function FolhaTreinoPdf({
	grupos,
	ciclo,
	treino,
	logoSrc,
	bolasSrc,
	rotateCcwSrc,
}: {
	grupos: GrupoData[];
	ciclo: string;
	treino: string;
	logoSrc: ImageSource;
	bolasSrc: ImageSource;
	rotateCcwSrc: ImageSource;
}) {
	const cicloLabel = ciclo;
	const treinoDisplay = treino.trim();

	return (
		<Document>
			{grupos
				.filter((g) => g.grupo?.trim() && g.exercicios?.length)
				.map((g, i) => (
					<FolhaGrupo
						key={i}
						grupo={g.grupo!.trim()}
						exercicios={g.exercicios}
						cicloLabel={cicloLabel}
						treinoDisplay={treinoDisplay}
						logoSrc={logoSrc}
						bolasSrc={bolasSrc}
						rotateCcwSrc={rotateCcwSrc}
					/>
				))}
		</Document>
	);
}

export async function renderTreinoPdfToBuffer(
	grupos: GrupoData[],
	ciclo: string,
	treino: string,
	logoSrc: ImageSource,
	bolasSrc: ImageSource,
	rotateCcwSrc: ImageSource,
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(
		<FolhaTreinoPdf
			grupos={grupos}
			ciclo={ciclo}
			treino={treino}
			logoSrc={logoSrc}
			bolasSrc={bolasSrc}
			rotateCcwSrc={rotateCcwSrc}
		/>,
	);
}
