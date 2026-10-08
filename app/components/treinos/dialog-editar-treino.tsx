import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import type {
	ExercicioForm,
	SugestoesTreino,
} from "~/components/treinos/linha-exercicio";
import {
	ListaExercicios,
	exercicioVazio,
} from "~/components/treinos/lista-exercicios";
import type { BancoTreinoRow } from "~/components/treinos/columns-treinos";
import { isVideoPlaceholder, sugerirVideo } from "~/lib/treinos-sugestoes";

function toExercicioForm(
	ex: Record<string, unknown>,
	sugestoes: SugestoesTreino,
): ExercicioForm {
	const exercicio = (ex.exercicio ?? ex.nome ?? "") as string;
	const video = String(ex.video ?? "").trim();
	const temVideoReal =
		!isVideoPlaceholder(video) &&
		sugestoes.videoItems.some((item) => item.value === video);
	return {
		exercicio,
		repeticoes: (ex.repeticoes ?? ex.Repeticoes ?? "") as string,
		observacao: (ex.observacao ?? ex.obs ?? "") as string,
		// vídeo já salvo é respeitado; exercício ainda "em produção" ganha sugestão
		video: temVideoReal
			? video
			: (sugerirVideo(exercicio, sugestoes.catalogo, sugestoes.videoItems) ??
				sugestoes.defaultVideo),
		videoManual: temVideoReal,
	};
}

type Props = {
	treino: BancoTreinoRow | null;
	sugestoes: SugestoesTreino;
	open: boolean;
	onClose: () => void;
};

export function DialogEditarTreino({
	treino,
	sugestoes,
	open,
	onClose,
}: Props) {
	const [exercicios, setExercicios] = useState<ExercicioForm[]>([]);
	const fetcher = useFetcher<{ error?: string; success?: boolean }>();
	const submittedRef = useRef(false);

	useEffect(() => {
		if (treino?.exercicios?.length) {
			setExercicios(treino.exercicios.map((ex) => toExercicioForm(ex, sugestoes)));
		} else {
			setExercicios([exercicioVazio(sugestoes.defaultVideo)]);
		}
	}, [treino, open, sugestoes]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!treino?.id) return;

		const formData = new FormData();
		formData.append("intent", "editar");
		formData.append("id", treino.id);
		formData.append(
			"exercicios",
			JSON.stringify(
				exercicios
					.filter((ex) => ex.exercicio.trim())
					.map(({ videoManual: _, ...ex }) => ex),
			),
		);

		fetcher.submit(formData, { method: "post" });
	}

	useEffect(() => {
		if (fetcher.state === "submitting") submittedRef.current = true;
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (fetcher.data?.success) {
				onClose();
			}
		}
	}, [fetcher.state, fetcher.data, onClose]);

	const busy = fetcher.state !== "idle";
	const isValid = exercicios.some((ex) => ex.exercicio.trim());

	if (!treino) return null;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>
						Editar exercícios — {treino.ciclo ?? "-"} / {treino.treino ?? "-"} /{" "}
						{treino.grupo ?? "-"}
					</DialogTitle>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-6">
					<ListaExercicios
						exercicios={exercicios}
						onChange={setExercicios}
						sugestoes={sugestoes}
						disabled={busy}
					/>

					{fetcher.data?.error && (
						<p className="text-sm text-destructive">{fetcher.data.error}</p>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={busy}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={busy || !isValid}>
							{busy ? "Salvando..." : "Salvar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
