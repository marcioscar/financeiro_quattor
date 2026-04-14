import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { FieldLabel } from "~/components/ui/field";
import {
	LinhaExercicio,
	type ExercicioForm,
} from "~/components/treinos/linha-exercicio";
import type { BancoTreinoRow } from "~/components/treinos/columns-treinos";

const exercicioInicial: ExercicioForm = {
	exercicio: "",
	repeticoes: "",
	observacao: "",
	video: "",
};

function toExercicioForm(ex: Record<string, unknown> | null | undefined): ExercicioForm {
	if (!ex) return { ...exercicioInicial };
	return {
		exercicio: (ex.exercicio ?? ex.nome ?? "") as string,
		repeticoes: (ex.repeticoes ?? ex.Repeticoes ?? "") as string,
		observacao: (ex.observacao ?? ex.obs ?? "") as string,
		video: (ex.video ?? "") as string,
	};
}

function resolveVideoValue(
	video: string,
	videoItems: Array<{ value: string; label: string }>,
	defaultVideo: string,
): string {
	const normalizedVideo = video.trim();
	if (normalizedVideo && videoItems.some((item) => item.value === normalizedVideo)) {
		return normalizedVideo;
	}
	return defaultVideo;
}

type Props = {
	treino: BancoTreinoRow | null;
	videoItems: Array<{ value: string; label: string }>;
	defaultVideo: string;
	open: boolean;
	onClose: () => void;
};

export function DialogEditarTreino({
	treino,
	videoItems,
	defaultVideo,
	open,
	onClose,
}: Props) {
	const [exercicios, setExercicios] = useState<ExercicioForm[]>([]);
	const fetcher = useFetcher<{ error?: string; success?: boolean }>();
	const submittedRef = useRef(false);

	useEffect(() => {
		if (treino?.exercicios?.length) {
			setExercicios(
				treino.exercicios.map((ex) => {
					const exercicio = toExercicioForm(ex);
					return {
						...exercicio,
						video: resolveVideoValue(exercicio.video, videoItems, defaultVideo),
					};
				}),
			);
		} else {
			setExercicios([{ ...exercicioInicial, video: defaultVideo }]);
		}
	}, [treino, open, defaultVideo, videoItems]);

	const addExercicio = useCallback(() => {
		setExercicios((prev) => [
			...prev,
			{ ...exercicioInicial, video: defaultVideo },
		]);
	}, [defaultVideo]);

	const updateExercicio = useCallback((index: number, ex: ExercicioForm) => {
		setExercicios((prev) => {
			const next = [...prev];
			next[index] = ex;
			return next;
		});
	}, []);

	const removeExercicio = useCallback((index: number) => {
		setExercicios((prev) => {
			if (prev.length <= 1) return prev;
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!treino?.id) return;

		const formData = new FormData();
		formData.append("intent", "editar");
		formData.append("id", treino.id);
		formData.append("exercicios", JSON.stringify(exercicios));

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
			<DialogContent className="max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						Editar exercícios — {treino.ciclo ?? "-"} / {treino.treino ?? "-"} /{" "}
						{treino.grupo ?? "-"}
					</DialogTitle>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<FieldLabel>Exercícios</FieldLabel>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addExercicio}
								disabled={busy}
							>
								<Plus className="mr-1 size-4" />
								Adicionar exercício
							</Button>
						</div>
						<div className="space-y-4">
							{exercicios.map((ex, i) => (
								<LinhaExercicio
									key={i}
									exercicio={ex}
									videoItems={videoItems}
									onChange={(e) => updateExercicio(i, e)}
									onRemove={() => removeExercicio(i)}
									disabled={busy}
								/>
							))}
						</div>
					</div>

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
