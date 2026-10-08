import {
	Document,
	Font,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import { toTitleCase } from "~/lib/utils";
import type { LayoutTreino } from "./layouts";

export { parseLayoutTreino } from "./layouts";

// Sem hifenização: nomes longos quebravam no meio da palavra
// ("Prancha Intensifi-cador").
Font.registerHyphenationCallback((word) => [word]);

type ImageSource = string;

type ExercicioItem = {
	exercicio?: string | null;
	repeticoes?: string | null;
};

type GrupoData = {
	grupo: string | null;
	exercicios: ExercicioItem[];
};

/* ---------- cores ---------- */
const LARANJA = "#f29100";
const LARANJA_NUM = "#e8a94e";
const TINTA = "#14171c";
const CINZA_REPS = "#5b6069";
const CINZA_ESCURO = "#30343b";
const HAIRLINE = "#ededf0";
const ZEBRA = "#f1f2f4";

/* ---------- métricas da página (A4, em pt) ---------- */
const A4_LADO_MAIOR = 841.89;
const A4_LADO_MENOR = 595.28;
const PAD = 36;
const LINE_H = 1.2;

/* ---------- medição de texto ---------- */

/**
 * Largura aproximada de um texto em Helvetica, em pt. Maiúsculas são bem mais
 * largas que minúsculas — importante porque os títulos de grupo são caixa alta.
 */
function larguraTexto(texto: string, fs: number, bold: boolean) {
	let em = 0;
	for (const c of texto) {
		if (c === " ") em += 0.28;
		else if (c >= "0" && c <= "9") em += 0.56;
		else if (c === c.toUpperCase() && c !== c.toLowerCase())
			em += bold ? 0.73 : 0.71;
		else em += bold ? 0.56 : 0.53;
	}
	return em * fs;
}

/** nº de linhas que o texto ocupa numa coluna (folga p/ quebra por palavra) */
function linhas(texto: string, largura: number, fs: number, bold: boolean) {
	return Math.max(
		1,
		Math.ceil((larguraTexto(texto, fs, bold) * 1.08) / Math.max(1, largura)),
	);
}

function nomeExercicio(e: ExercicioItem) {
	return toTitleCase(String(e.exercicio ?? "").trim()) || "—";
}

function repsExercicio(e: ExercicioItem) {
	return String(e.repeticoes ?? "").trim() || "—";
}

/* ---------- protocolos (legenda) ---------- */

/** séries até este tamanho ficam ao lado do exercício; maiores vão p/ legenda */
const REP_CURTA_MAX = 22;

type Linha = { nome: string; reps: string | null; letra: string | null };
type Protocolo = { letra: string; texto: string };

function limparReps(texto: string) {
	return texto.replace(/¡/g, "I").replace(/\s+/g, " ").trim();
}

/**
 * Deixa a série legível de longe: caixa alta corrida vira minúscula e as
 * palavras que mais se repetem são abreviadas ("5 segundos de isometria +
 * 5 repetições" → "5s isometria + 5 rep"). A legenda explica as abreviações.
 */
function abreviar(texto: string) {
	return texto
		.toLocaleLowerCase("pt-BR")
		.replace(/(\d)\s*x\s*(\d)/g, "$1×$2")
		.replace(/(\d)\s*segundos?(\s+de)?\b/g, "$1s")
		.replace(/repeti(ções|çoes|coes|ção|cao)/g, "rep")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Séries longas costumam se repetir no grupo inteiro ("3X5 segundos isometria
 * + 5 repetições + …"). Cada texto longo distinto vira um protocolo (A, B, C…)
 * impresso uma única vez no rodapé; o exercício mostra só a letra. Assim o
 * espaço da página vai para o nome do exercício, em letra grande.
 */
function prepararGrupo(exercicios: ExercicioItem[]) {
	const protocolos: Protocolo[] = [];
	const porChave = new Map<string, string>();
	const itens: Linha[] = exercicios.map((e) => {
		const reps = abreviar(limparReps(repsExercicio(e)));
		if (reps.length <= REP_CURTA_MAX)
			return { nome: nomeExercicio(e), reps, letra: null };
		const chave = reps.replace(/\s+/g, "");
		let letra = porChave.get(chave);
		if (!letra) {
			letra = String.fromCharCode(65 + protocolos.length);
			porChave.set(chave, letra);
			protocolos.push({ letra, texto: reps });
		}
		return { nome: nomeExercicio(e), reps: null, letra };
	});
	return { itens, protocolos };
}

const LEG_PAD = 10;
const LEG_GAP = 6;

function legendaMedidas(protocolos: Protocolo[], largura: number, hMax: number) {
	if (protocolos.length === 0) return { fs: 0, altura: 0, badge: 0 };
	for (let fs = 20; fs >= 11; fs -= 1) {
		const badge = fs * 1.5;
		const larg = largura - LEG_PAD * 2 - badge - 10;
		const altura =
			protocolos.reduce(
				(s, p) =>
					s + Math.max(badge, linhas(p.texto, larg, fs, false) * fs * LINE_H),
				0,
			) +
			LEG_GAP * (protocolos.length - 1) +
			LEG_PAD * 2 +
			LEG_GAP +
			13 * LINE_H + // linha "rep = repetições · s = segundos"
			14; // margem acima da caixa
		if (altura <= hMax || fs === 11) return { fs, altura, badge };
	}
	return { fs: 11, altura: hMax, badge: 16 };
}

function Legenda({
	protocolos,
	fs,
	badge,
}: {
	protocolos: Protocolo[];
	fs: number;
	badge: number;
}) {
	if (protocolos.length === 0) return null;
	return (
		<View
			style={{
				marginTop: 14,
				padding: LEG_PAD,
				borderWidth: 2,
				borderColor: LARANJA,
				borderRadius: 8,
				gap: LEG_GAP,
			}}
		>
			{protocolos.map((p) => (
				<View
					key={p.letra}
					style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
				>
					<Selo letra={p.letra} tamanho={badge} />
					<Text
						style={{
							flex: 1,
							fontSize: fs,
							lineHeight: LINE_H,
							color: TINTA,
						}}
					>
						{p.texto}
					</Text>
				</View>
			))}
			<Text style={{ fontSize: 13, color: CINZA_REPS, textAlign: "right" }}>
				rep = repetições · s = segundos
			</Text>
		</View>
	);
}

/** fundo do selo do protocolo; a letra vai em preto para ler de longe */
const SELO_FUNDO = LARANJA;

/** quadradinho com a letra do protocolo */
function Selo({ letra, tamanho }: { letra: string; tamanho: number }) {
	return (
		<View
			style={{
				width: tamanho,
				height: tamanho,
				borderRadius: tamanho * 0.18,
				backgroundColor: SELO_FUNDO,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Text
				style={{
					color: TINTA,
					fontFamily: "Helvetica-Bold",
					fontSize: tamanho * 0.62,
				}}
			>
				{letra}
			</Text>
		</View>
	);
}

/** maior fonte (de max até min) em que `cabe` é verdadeiro */
function maiorFonte(max: number, min: number, cabe: (fs: number) => boolean) {
	for (let fs = max; fs > min; fs -= 1) if (cabe(fs)) return fs;
	return min;
}

/* ---------- cabeçalho / rodapé compartilhados ---------- */

const HEADER_H = 78; // subtítulo + título + régua
const FOOTER_H = 52;

function tituloFs(grupo: string, largura: number, max: number, min: number) {
	for (let fs = max; fs >= min; fs -= 1) {
		if (linhas(grupo, largura, fs, true) === 1) return fs;
	}
	return min;
}

const base = StyleSheet.create({
	page: {
		paddingTop: PAD,
		paddingBottom: PAD,
		paddingHorizontal: PAD,
		fontFamily: "Helvetica",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		height: HEADER_H - 16,
	},
	logoImg: { height: 30, width: 150 },
	subtitulo: {
		fontSize: 12,
		color: LARANJA,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	titulo: {
		fontFamily: "Helvetica-Bold",
		color: TINTA,
		textTransform: "uppercase",
		letterSpacing: -0.5,
	},
	regua: {
		height: 5,
		width: 80,
		backgroundColor: LARANJA,
		marginTop: 8,
		marginBottom: 3,
	},
	footer: {
		position: "absolute",
		bottom: 22,
		left: PAD,
		right: PAD,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: 10,
	},
	footerBolas: { height: 22, width: 40 },
	footerTexto: { fontSize: 14, fontFamily: "Helvetica-Bold", color: TINTA },
});

type Comum = {
	grupo: string;
	exercicios: ExercicioItem[];
	cicloLabel: string;
	treinoDisplay: string;
	logoSrc: ImageSource;
	bolasSrc: ImageSource;
};

function Cabecalho({
	grupo,
	cicloLabel,
	treinoDisplay,
	logoSrc,
	larguraConteudo,
}: Comum & { larguraConteudo: number }) {
	const larguraTitulo = larguraConteudo - 150 - 16;
	const fs = tituloFs(grupo, larguraTitulo, 36, 18);
	return (
		<>
			<View style={base.header}>
				<View style={{ width: larguraTitulo }}>
					<Text style={base.subtitulo}>
						{cicloLabel} · {treinoDisplay}
					</Text>
					<Text style={[base.titulo, { fontSize: fs }]}>{grupo}</Text>
				</View>
				<Image src={logoSrc} style={base.logoImg} />
			</View>
			<View style={base.regua} />
		</>
	);
}

function Rodape({
	cicloLabel,
	treinoDisplay,
	bolasSrc,
}: Pick<Comum, "cicloLabel" | "treinoDisplay" | "bolasSrc">) {
	return (
		<View fixed style={base.footer}>
			<Image src={bolasSrc} style={base.footerBolas} />
			<Text style={base.footerTexto}>
				{cicloLabel} - {treinoDisplay}
			</Text>
		</View>
	);
}

/* =====================================================================
 * Layout "cartaz": retrato, número em círculo, nome grande e a série
 * (ou a letra do protocolo) logo abaixo do nome.
 * ===================================================================== */

const RETRATO_W = A4_LADO_MENOR - PAD * 2;
const RETRATO_H = A4_LADO_MAIOR - PAD * 2 - HEADER_H - FOOTER_H;

function cartazMedidas(fs: number) {
	const circulo = Math.round(fs * 1.25);
	const gap = Math.round(fs * 0.45);
	return {
		circulo,
		gap,
		larguraTexto: RETRATO_W - circulo - gap,
		fsReps: Math.round(fs * 0.62),
		padV: Math.max(5, fs * 0.25),
	};
}

function cartazAltura(l: Linha, fs: number) {
	const m = cartazMedidas(fs);
	const hNome = linhas(l.nome, m.larguraTexto, fs, true) * fs * 1.12;
	const hReps = m.fsReps * LINE_H + 4;
	return Math.max(m.circulo, hNome + hReps) + m.padV * 2;
}

function PaginaCartaz(props: Comum) {
	const { itens, protocolos } = prepararGrupo(props.exercicios);
	const leg = legendaMedidas(protocolos, RETRATO_W, RETRATO_H * 0.32);
	const h = RETRATO_H - leg.altura;
	const fs = maiorFonte(
		48,
		12,
		(f) => itens.reduce((s, l) => s + cartazAltura(l, f), 0) <= h,
	);
	const m = cartazMedidas(fs);
	const ocupado = itens.reduce((s, l) => s + cartazAltura(l, fs), 0);
	const extra = Math.max(0, Math.min(16, (h - ocupado) / (itens.length * 2)));

	return (
		<Page size='A4' style={base.page}>
			<Cabecalho {...props} larguraConteudo={RETRATO_W} />
			{itens.map((l, i) => (
				<View
					key={i}
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingVertical: m.padV + extra,
						borderBottomWidth: 1,
						borderBottomColor: HAIRLINE,
					}}
				>
					<View
						style={{
							width: m.circulo,
							height: m.circulo,
							borderRadius: m.circulo / 2,
							backgroundColor: TINTA,
							alignItems: "center",
							justifyContent: "center",
							marginRight: m.gap,
						}}
					>
						<Text
							style={{
								color: "#ffffff",
								fontFamily: "Helvetica-Bold",
								fontSize: fs * 0.62,
							}}
						>
							{i + 1}
						</Text>
					</View>
					<View style={{ width: m.larguraTexto }}>
						<Text
							style={{
								fontFamily: "Helvetica-Bold",
								fontSize: fs,
								lineHeight: 1.12,
								color: TINTA,
							}}
						>
							{l.nome}
						</Text>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								marginTop: 4,
								gap: 6,
							}}
						>
							{l.letra ? (
								<>
									<Selo letra={l.letra} tamanho={m.fsReps * 1.15} />
									<Text
										style={{
											fontFamily: "Helvetica-Bold",
											fontSize: m.fsReps,
											color: CINZA_ESCURO,
										}}
									>
										Protocolo {l.letra}
									</Text>
								</>
							) : (
								<Text
									style={{
										fontFamily: "Helvetica-Bold",
										fontSize: m.fsReps,
										color: LARANJA,
									}}
								>
									{l.reps}
								</Text>
							)}
						</View>
					</View>
				</View>
			))}
			<Legenda protocolos={protocolos} fs={leg.fs} badge={leg.badge} />
			<Rodape {...props} />
		</Page>
	);
}

/* =====================================================================
 * Layout "cartoes": paisagem, grade de cartões (um por exercício).
 * ===================================================================== */

const PAISAGEM_W = A4_LADO_MAIOR - PAD * 2;
const PAISAGEM_H = A4_LADO_MENOR - PAD * 2 - HEADER_H - FOOTER_H + 12;
const CARTAO_GAP = 10;
const CARTAO_PAD = 10;

function cartoesGrade(n: number, colunas: number, h: number) {
	const fileiras = Math.ceil(n / colunas);
	return {
		colunas,
		w: (PAISAGEM_W - CARTAO_GAP * (colunas - 1)) / colunas,
		h: (h - CARTAO_GAP * (fileiras - 1)) / fileiras,
	};
}

function cartaoCabe(l: Linha, fs: number, w: number, h: number) {
	const larg = w - CARTAO_PAD * 2 - 4;
	const fsReps = fs * 0.72;
	const hTopo = Math.max(fs * 0.85, fs * 1.1); // número e selo do protocolo
	const hNome = linhas(l.nome, larg, fs, true) * fs * 1.12;
	const hReps = l.reps
		? 6 + linhas(l.reps, larg - 12, fsReps, true) * fsReps * LINE_H
		: 0;
	return hTopo + 4 + hNome + hReps + CARTAO_PAD * 2 + 10 <= h;
}

function PaginaCartoes(props: Comum) {
	const { itens, protocolos } = prepararGrupo(props.exercicios);
	const leg = legendaMedidas(protocolos, PAISAGEM_W, PAISAGEM_H * 0.3);
	const hGrade = PAISAGEM_H - leg.altura;
	// testa 1–4 colunas e fica com a grade que permite a maior letra
	let g = cartoesGrade(itens.length, 1, hGrade);
	let fs = 0;
	for (let c = 1; c <= Math.min(4, itens.length); c++) {
		const grade = cartoesGrade(itens.length, c, hGrade);
		const f = maiorFonte(44, 12, (x) =>
			itens.every((l) => cartaoCabe(l, x, grade.w, grade.h)),
		);
		if (f > fs) {
			fs = f;
			g = grade;
		}
	}
	const fsReps = fs * 0.72;

	return (
		<Page size='A4' orientation='landscape' style={base.page}>
			<Cabecalho {...props} larguraConteudo={PAISAGEM_W} />
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: CARTAO_GAP,
					marginTop: 4,
				}}
			>
				{itens.map((l, i) => (
					<View
						key={i}
						style={{
							width: g.w,
							height: g.h,
							padding: CARTAO_PAD,
							borderWidth: 2,
							borderColor: TINTA,
							borderRadius: 10,
							borderTopWidth: 7,
							borderTopColor: LARANJA,
						}}
					>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 4,
							}}
						>
							<Text
								style={{
									fontFamily: "Helvetica-Bold",
									fontSize: fs * 0.85,
									color: LARANJA,
								}}
							>
								{String(i + 1).padStart(2, "0")}
							</Text>
							{l.letra && <Selo letra={l.letra} tamanho={fs * 1.1} />}
						</View>
						<Text
							style={{
								fontFamily: "Helvetica-Bold",
								fontSize: fs,
								lineHeight: 1.12,
								color: TINTA,
							}}
						>
							{l.nome}
						</Text>
						{l.reps && (
							<>
								<View style={{ flexGrow: 1 }} />
								<Text
									style={{
										fontFamily: "Helvetica-Bold",
										fontSize: fsReps,
										lineHeight: LINE_H,
										color: CINZA_ESCURO,
										borderLeftWidth: 4,
										borderLeftColor: LARANJA,
										paddingLeft: 8,
									}}
								>
									{l.reps}
								</Text>
							</>
						)}
					</View>
				))}
			</View>
			<Legenda protocolos={protocolos} fs={leg.fs} badge={leg.badge} />
			<Rodape {...props} />
		</Page>
	);
}

/* =====================================================================
 * Layout "contraste": retrato, faixas alternadas (o olho acompanha a
 * linha do nome até a série), série/protocolo numa coluna à direita.
 * ===================================================================== */

const FAIXA_PAD_H = 12;

function contrasteMedidas(fs: number, itens: Linha[]) {
	const numW = fs * 1.3;
	const interno = RETRATO_W - FAIXA_PAD_H * 2 - numW;
	const fsReps = fs * 0.8;
	const direita = Math.max(
		fsReps * 1.3,
		...itens.map((l) => (l.reps ? larguraTexto(l.reps, fsReps, true) * 1.08 : 0)),
	);
	return {
		numW,
		fsReps,
		direita,
		nomeW: interno - direita - 12,
		padV: Math.max(6, fs * 0.3),
	};
}

function contrasteAltura(l: Linha, fs: number, m: ReturnType<typeof contrasteMedidas>) {
	return linhas(l.nome, m.nomeW, fs, true) * fs * 1.12 + m.padV * 2;
}

function PaginaContraste(props: Comum) {
	const { itens, protocolos } = prepararGrupo(props.exercicios);
	const leg = legendaMedidas(protocolos, RETRATO_W, RETRATO_H * 0.32);
	const h = RETRATO_H - leg.altura - 3;
	const fs = maiorFonte(48, 12, (f) => {
		const m = contrasteMedidas(f, itens);
		return (
			m.nomeW > 120 && itens.reduce((s, l) => s + contrasteAltura(l, f, m), 0) <= h
		);
	});
	const m = contrasteMedidas(fs, itens);
	const ocupado = itens.reduce((s, l) => s + contrasteAltura(l, fs, m), 0);
	const extra = Math.max(0, Math.min(16, (h - ocupado) / (itens.length * 2)));

	return (
		<Page size='A4' style={base.page}>
			<Cabecalho {...props} larguraConteudo={RETRATO_W} />
			<View style={{ borderTopWidth: 3, borderTopColor: TINTA }}>
				{itens.map((l, i) => (
					<View
						key={i}
						style={{
							flexDirection: "row",
							alignItems: "center",
							paddingVertical: m.padV + extra,
							paddingHorizontal: FAIXA_PAD_H,
							backgroundColor: i % 2 === 0 ? ZEBRA : "#ffffff",
							borderBottomWidth: 1,
							borderBottomColor: "#d5d7db",
						}}
					>
						<Text
							style={{
								width: m.numW,
								fontFamily: "Helvetica-Bold",
								fontSize: fs,
								color: LARANJA,
							}}
						>
							{i + 1}
						</Text>
						<Text
							style={{
								width: m.nomeW,
								marginRight: 12,
								fontFamily: "Helvetica-Bold",
								fontSize: fs,
								lineHeight: 1.12,
								color: TINTA,
							}}
						>
							{l.nome}
						</Text>
						<View style={{ width: m.direita, alignItems: "flex-end" }}>
							{l.letra ? (
								<Selo letra={l.letra} tamanho={m.fsReps * 1.3} />
							) : (
								<Text
									style={{
										fontFamily: "Helvetica-Bold",
										fontSize: m.fsReps,
										color: TINTA,
									}}
								>
									{l.reps}
								</Text>
							)}
						</View>
					</View>
				))}
			</View>
			<Legenda protocolos={protocolos} fs={leg.fs} badge={leg.badge} />
			<Rodape {...props} />
		</Page>
	);
}

/* =====================================================================
 * Layout "compacto" (antigo): o grupo inteiro em uma página; a fonte
 * encolhe o quanto for preciso.
 * ===================================================================== */

const COMPACTO = {
	W: A4_LADO_MENOR - PAD * 2,
	FS_MAX: 26,
	FS_MIN: 9,
	NUM_W: 30,
	GAP: 14,
	FOOTER_H: 70,
	HEADER_EXTRA: 26,
	TITULO_FS_MAX: 34,
	TITULO_FS_MIN: 18,
};
const COMPACTO_TITULO_W = COMPACTO.W - 150 - 16;
/** média por caractere usada só para dimensionar a coluna de repetições */
const CHAR_W_REG = 0.53;

function compactoTitulo(grupo: string) {
	for (let fs = COMPACTO.TITULO_FS_MAX; fs >= COMPACTO.TITULO_FS_MIN; fs -= 1) {
		if (linhas(grupo, COMPACTO_TITULO_W, fs, true) === 1) return { fs, linhas: 1 };
	}
	return {
		fs: COMPACTO.TITULO_FS_MIN,
		linhas: linhas(grupo, COMPACTO_TITULO_W, COMPACTO.TITULO_FS_MIN, true),
	};
}

function compactoLayout(grupo: string, exercicios: ExercicioItem[]) {
	const t = compactoTitulo(grupo);
	const alturaHeader =
		Math.max(t.linhas * t.fs * LINE_H + 16, 30) + COMPACTO.HEADER_EXTRA;
	const usableH = A4_LADO_MAIOR - PAD - alturaHeader - COMPACTO.FOOTER_H;
	const nomes = exercicios.map(nomeExercicio);
	const reps = exercicios.map(repsExercicio);
	const maiorRep = Math.max(...reps.map((r) => r.length));
	const repLonga = maiorRep > 40;

	for (let fs = COMPACTO.FS_MAX; fs >= COMPACTO.FS_MIN; fs -= 0.5) {
		const fsReps = fs * (repLonga ? 0.72 : 0.82);
		const padV = Math.max(4, fs * 0.42);
		const alvoChars = Math.min(maiorRep, repLonga ? 34 : 24);
		const repsW = Math.min(
			COMPACTO.W * (repLonga ? 0.58 : 0.45),
			Math.max(80, alvoChars * fsReps * CHAR_W_REG + 10),
		);
		const nomeW = COMPACTO.W - COMPACTO.NUM_W - repsW - COMPACTO.GAP;

		let total = 0;
		for (let i = 0; i < nomes.length; i++) {
			const ln = Math.max(
				linhas(nomes[i], nomeW, fs, true),
				linhas(reps[i], repsW, fsReps, false),
			);
			total += ln * fs * LINE_H + padV * 2;
		}

		if (total <= usableH) {
			const extra = Math.min(12, (usableH - total) / (nomes.length * 2));
			const alturaConteudo = total + nomes.length * 2 * Math.max(0, extra);
			const alturaBloco = Math.min(usableH, alturaConteudo + nomes.length * 10);
			return {
				titulo: t,
				fs,
				fsReps,
				repsW,
				alturaBloco,
				repLonga,
				padV: padV + Math.max(0, extra),
			};
		}
	}

	return {
		titulo: t,
		fs: COMPACTO.FS_MIN,
		fsReps: COMPACTO.FS_MIN * (repLonga ? 0.72 : 0.82),
		repsW: COMPACTO.W * (repLonga ? 0.58 : 0.45),
		alturaBloco: usableH,
		repLonga,
		padV: 4,
	};
}

function PaginaCompacta(props: Comum) {
	const { grupo, exercicios, cicloLabel, treinoDisplay, logoSrc, bolasSrc } =
		props;
	const { titulo, fs, fsReps, repsW, padV, alturaBloco, repLonga } =
		compactoLayout(grupo, exercicios);

	return (
		<Page size='A4' style={base.page}>
			<View style={{ ...base.header, height: undefined }}>
				<View style={{ width: COMPACTO_TITULO_W }}>
					<Text style={[base.subtitulo, { fontSize: 10, marginBottom: 6 }]}>
						{cicloLabel} · {treinoDisplay}
					</Text>
					<Text style={[base.titulo, { fontSize: titulo.fs }]}>{grupo}</Text>
				</View>
				<Image src={logoSrc} style={base.logoImg} />
			</View>
			<View style={[base.regua, { width: 64, height: 4, marginTop: 12, marginBottom: 8 }]} />
			<View style={{ height: alturaBloco, justifyContent: "space-between" }}>
				{exercicios.map((ex, i) => (
					<View
						key={i}
						style={{
							flexDirection: "row",
							alignItems: "center",
							borderBottomWidth: 0.75,
							borderBottomColor: HAIRLINE,
							paddingVertical: padV,
						}}
					>
						<Text
							style={{
								width: COMPACTO.NUM_W,
								fontFamily: "Helvetica-Bold",
								color: LARANJA_NUM,
								fontSize: fs * 0.8,
							}}
						>
							{String(i + 1).padStart(2, "0")}
						</Text>
						<Text
							style={{
								flex: 1,
								paddingRight: COMPACTO.GAP,
								fontFamily: "Helvetica-Bold",
								color: TINTA,
								fontSize: fs,
							}}
						>
							{nomeExercicio(ex)}
						</Text>
						<Text
							style={{
								color: CINZA_REPS,
								fontSize: fsReps,
								width: repsW,
								textAlign: repLonga ? "left" : "right",
							}}
						>
							{repsExercicio(ex)}
						</Text>
					</View>
				))}
			</View>
			<View fixed style={[base.footer, { bottom: 26, justifyContent: "flex-end" }]}>
				<Image src={bolasSrc} style={base.footerBolas} />
				<Text style={[base.footerTexto, { fontSize: 13 }]}>
					{cicloLabel} - {treinoDisplay}
				</Text>
			</View>
		</Page>
	);
}

/* ---------- documento ---------- */

const PAGINAS_POR_LAYOUT = {
	cartaz: PaginaCartaz,
	cartoes: PaginaCartoes,
	contraste: PaginaContraste,
	compacto: PaginaCompacta,
} satisfies Record<LayoutTreino, unknown>;

export function FolhaTreinoPdf({
	grupos,
	ciclo,
	treino,
	logoSrc,
	bolasSrc,
	layout = "contraste",
}: {
	grupos: GrupoData[];
	ciclo: string;
	treino: string;
	logoSrc: ImageSource;
	bolasSrc: ImageSource;
	layout?: LayoutTreino;
}) {
	const Paginas = PAGINAS_POR_LAYOUT[layout];

	return (
		<Document>
			{grupos
				.filter((g) => g.grupo?.trim() && g.exercicios?.length)
				.map((g, i) => (
					<Paginas
						key={i}
						grupo={g.grupo!.trim()}
						exercicios={g.exercicios}
						cicloLabel={ciclo}
						treinoDisplay={treino.trim()}
						logoSrc={logoSrc}
						bolasSrc={bolasSrc}
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
	layout: LayoutTreino = "contraste",
) {
	const ReactPDF = await import("@react-pdf/renderer");
	return ReactPDF.renderToBuffer(
		<FolhaTreinoPdf
			grupos={grupos}
			ciclo={ciclo}
			treino={treino}
			logoSrc={logoSrc}
			bolasSrc={bolasSrc}
			layout={layout}
		/>,
	);
}
